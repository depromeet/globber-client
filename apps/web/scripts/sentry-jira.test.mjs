import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { afterEach, beforeEach, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

import * as discord from "../src/app/webhooks/_lib/discord.ts";

const require = createRequire(import.meta.url);
const serverEnv = Object.fromEntries(
  ["SENTRY_JIRA_ENABLED", "JIRA_EMAIL", "JIRA_API_TOKEN", "SENTRY_WEBHOOK_SECRET", "DISCORD_WEBHOOK_URL"].map(key => [
    key,
    { get: () => (key === "SENTRY_JIRA_ENABLED" ? process.env[key] === "true" : process.env[key]) },
  ])
);
const config = { serverEnv: Object.defineProperties({}, serverEnv) };
const jiraModule = { exports: {} };
const jiraSource = await readFile(new URL("../src/app/webhooks/_lib/sentry-jira.ts", import.meta.url), "utf8");
const jiraCode = ts.transpileModule(jiraSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function("require", "module", "exports", jiraCode)(
  name => (name === "@/config/env" ? config : require(name)),
  jiraModule,
  jiraModule.exports
);
const jira = jiraModule.exports;
const { enqueueSentryIssue, processSentryJiraJobs } = jira;
const routeSource = await readFile(new URL("../src/app/webhooks/sentry/route.ts", import.meta.url), "utf8");
const routeCode = ts.transpileModule(routeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const webhook = () => {
  const tasks = [];
  const messages = [];
  const module = { exports: {} };
  const load = name => {
    if (name === "next/server") return { after: task => tasks.push(task), NextResponse: { json: Response.json } };
    // route는 import 시점이 아니라 요청 때 serverEnv를 읽으므로, 테스트가 바꾼 process.env가 그대로 보이게 넘긴다
    if (name === "@/config/env") return config;
    if (name === "../_lib/sentry-jira") return jira;
    if (name === "../_lib/discord") return { ...discord, sendToDiscord: async (...args) => messages.push(args) };
    return require(name);
  };
  new Function("require", "module", "exports", routeCode)(load, module, module.exports);
  return { post: module.exports.POST, tasks, messages };
};

const originalDirectory = process.cwd();
const originalFetch = globalThis.fetch;
const originalEnabled = process.env.SENTRY_JIRA_ENABLED;
const originalEmail = process.env.JIRA_EMAIL;
const originalToken = process.env.JIRA_API_TOKEN;
let directory;
let calls;

const issue = {
  id: "7823474975",
  shortId: "GLOBBER-FRONTEND-M",
  title: "Error creating WebGL context.",
  level: "error",
  web_url: "https://globber.sentry.io/issues/7823474975/",
  culprit: "/globe/:id",
  project: { slug: "globber-frontend" },
};
const jobFile = () => join(directory, ".data/sentry-jira/7823474975.json");
const readJob = async () => JSON.parse(await readFile(jobFile(), "utf8"));
const json = (value, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", ...headers } });
const assignees = new Set([
  "712020:c9117a16-ff0d-4a60-b7b0-c53e73b55192",
  "557058:6fbe6346-903e-432b-965d-e8c92609a600",
  "712020:426f9d32-35b9-4e88-9ad7-9d98ce60f77a",
  "712020:8eac9db3-bbfe-4b9a-945a-21645bea892d",
  "712020:65504c72-616b-46d6-8ed2-8bf741dd10cb",
]);

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "globber-sentry-jira-"));
  process.chdir(directory);
  process.env.SENTRY_JIRA_ENABLED = "true";
  process.env.JIRA_EMAIL = "test@example.com";
  process.env.JIRA_API_TOKEN = "test-token";
  calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return options.method === "GET" ? json({ issues: [] }) : json({ key: "GLB-999" }, 201);
  };
});

afterEach(async () => {
  process.chdir(originalDirectory);
  globalThis.fetch = originalFetch;
  if (originalEnabled === undefined) delete process.env.SENTRY_JIRA_ENABLED;
  else process.env.SENTRY_JIRA_ENABLED = originalEnabled;
  if (originalEmail === undefined) delete process.env.JIRA_EMAIL;
  else process.env.JIRA_EMAIL = originalEmail;
  if (originalToken === undefined) delete process.env.JIRA_API_TOKEN;
  else process.env.JIRA_API_TOKEN = originalToken;
  await rm(directory, { recursive: true, force: true });
});

test("fatal/error만 저장하고 레벨 누락·warning/info/debug는 제외한다", async () => {
  for (const level of [undefined, "warning", "info", "debug", "critical", "ERROR"]) {
    await enqueueSentryIssue({ ...issue, level });
  }
  await assert.rejects(readJob(), { code: "ENOENT" });
  for (const level of ["fatal", "error"]) {
    await enqueueSentryIssue({ ...issue, id: level === "fatal" ? "1" : issue.id, level });
  }
  assert.equal((await readJob()).status, "pending");
  assert.equal(JSON.parse(await readFile(join(directory, ".data/sentry-jira/1.json"), "utf8")).issue.level, "fatal");
});

test("Sentry ID가 없거나 경로를 포함하면 저장하지 않는다", async () => {
  for (const id of [undefined, "../1", "", "123/4"]) {
    await assert.rejects(enqueueSentryIssue({ ...issue, id }));
  }
});

test("동일 이슈의 동시 재전송·동시 처리는 티켓 하나와 동일 담당자를 유지한다", async () => {
  await Promise.all(Array.from({ length: 10 }, () => enqueueSentryIssue(issue)));
  const before = await readJob();
  assert.ok(assignees.has(before.assignee));
  await Promise.all(Array.from({ length: 10 }, () => processSentryJiraJobs()));
  const post = calls.filter(call => call.options.method === "POST");
  assert.equal(post.length, 1);
  const { fields } = JSON.parse(post[0].options.body);
  assert.equal(fields.assignee.accountId, before.assignee);
  assert.equal(fields.project.key, "GLB");
  assert.equal(fields.issuetype.id, "10010");
  assert.deepEqual(fields.labels, ["sentry", `sentry-${issue.id}`]);
  assert.equal(fields.description.type, "doc");
  assert.ok(post[0].url.startsWith("https://api.atlassian.com/ex/jira/54dfd193-6391-490d-9b3f-3b001d64107b/"));
  await enqueueSentryIssue(issue);
  await processSentryJiraJobs();
  assert.equal(calls.filter(call => call.options.method === "POST").length, 1);
  assert.equal((await readJob()).jiraKey, "GLB-999");
});

test("Jira에 연결된 티켓이 있으면 새 티켓을 생성하지 않는다", async () => {
  await enqueueSentryIssue(issue);
  globalThis.fetch = async () => json({ issues: [{ key: "GLB-128" }] });
  await processSentryJiraJobs();
  assert.equal((await readJob()).jiraKey, "GLB-128");
});

test("생성 응답 유실은 재생성하지 않고 검색으로만 복구한다", async () => {
  await enqueueSentryIssue(issue);
  const before = await readJob();
  globalThis.fetch = async (_url, options) => {
    calls.push(options.method);
    if (options.method === "POST") throw new TypeError("fetch failed");
    return json({ issues: [] });
  };
  await processSentryJiraJobs();
  assert.equal((await readJob()).status, "creating");
  await enqueueSentryIssue(issue);
  await processSentryJiraJobs();
  assert.equal(calls.filter(method => method === "POST").length, 1);
  assert.equal((await readJob()).assignee, before.assignee);
  globalThis.fetch = async () => json({ issues: [{ key: "GLB-129" }] });
  await processSentryJiraJobs();
  assert.equal((await readJob()).jiraKey, "GLB-129");
});

test("429는 Retry-After 이후 같은 담당자로 재시도한다", async () => {
  await enqueueSentryIssue(issue);
  globalThis.fetch = async (_url, options) =>
    options.method === "GET" ? json({ issues: [] }) : json({}, 429, { "Retry-After": "120" });
  const start = Date.now();
  await processSentryJiraJobs();
  const job = await readJob();
  assert.equal(job.status, "pending");
  assert.ok(job.nextAttemptAt >= start + 120_000);
  globalThis.fetch = originalFetch;
  await processSentryJiraJobs(); // 다음 시도 시각 전에는 네트워크를 호출하지 않는다.
  await writeFile(jobFile(), JSON.stringify({ ...job, nextAttemptAt: 0 }));
  let assigned;
  globalThis.fetch = async (_url, options) => {
    if (options.method === "GET") return json({ issues: [] });
    assigned = JSON.parse(options.body).fields.assignee.accountId;
    return json({ key: "GLB-130" }, 201);
  };
  await processSentryJiraJobs();
  assert.equal(assigned, job.assignee);
});

test("확정적인 생성 거절은 실패로 보관하고 반복 생성하지 않는다", async () => {
  await enqueueSentryIssue(issue);
  let posts = 0;
  globalThis.fetch = async (_url, options) => {
    if (options.method === "GET") return json({ issues: [] });
    posts++;
    return json({}, 403);
  };
  await processSentryJiraJobs();
  await processSentryJiraJobs();
  assert.equal((await readJob()).status, "failed");
  assert.equal(posts, 1);
});

test("검색 API의 429도 Retry-After를 준수한다", async () => {
  await enqueueSentryIssue(issue);
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return json({}, 429, { "Retry-After": "180" });
  };
  const start = Date.now();
  await processSentryJiraJobs();
  const job = await readJob();
  assert.equal(job.status, "pending");
  assert.ok(job.nextAttemptAt >= start + 180_000);
  await processSentryJiraJobs();
  assert.equal(requests, 1);
});

test("인증값이 없어도 대기 작업을 보존하고, 검색 실패 뒤 재시도한다", async () => {
  await enqueueSentryIssue(issue);
  delete process.env.JIRA_API_TOKEN;
  await processSentryJiraJobs();
  assert.equal(calls.length, 0);
  assert.equal((await readJob()).status, "pending");
  process.env.JIRA_API_TOKEN = "test-token";
  globalThis.fetch = async () => json({}, 503);
  await processSentryJiraJobs();
  assert.equal((await readJob()).status, "pending");
  globalThis.fetch = async (_url, options) =>
    options.method === "GET" ? json({ issues: [] }) : json({ key: "GLB-131" }, 201);
  await processSentryJiraJobs();
  assert.equal((await readJob()).jiraKey, "GLB-131");
});

test("서명된 웹훅은 Discord 알림을 유지하면서 fatal/error만 Jira에 전달한다", async () => {
  const originalSecret = process.env.SENTRY_WEBHOOK_SECRET;
  const originalDiscord = process.env.DISCORD_WEBHOOK_URL;
  process.env.SENTRY_WEBHOOK_SECRET = "test-secret";
  process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/test/test";
  try {
    const route = webhook();
    for (const level of ["warning", "info", "debug", "fatal", "error"]) {
      const body = JSON.stringify({
        action: "created",
        data: { issue: { ...issue, id: level === "fatal" ? "1" : issue.id, level } },
      });
      const signature = createHmac("sha256", "test-secret").update(body).digest("hex");
      const response = await route.post(
        new Request("https://globber.world/webhooks/sentry", {
          method: "POST",
          body,
          headers: { "sentry-hook-signature": signature, "sentry-hook-resource": "issue" },
        })
      );
      assert.equal(response.status, 200);
      await route.tasks.shift()();
    }
    assert.equal(route.messages.length, 5);
    assert.equal(calls.filter(call => call.options.method === "POST").length, 2);
    const rejected = await route.post(
      new Request("https://globber.world/webhooks/sentry", { method: "POST", body: "{}" })
    );
    assert.equal(rejected.status, 401);
    assert.equal(route.tasks.length, 0);
    const invalidBody = "null";
    const invalid = await route.post(
      new Request("https://globber.world/webhooks/sentry", {
        method: "POST",
        body: invalidBody,
        headers: {
          "sentry-hook-signature": createHmac("sha256", "test-secret").update(invalidBody).digest("hex"),
          "sentry-hook-resource": "issue",
        },
      })
    );
    assert.equal(invalid.status, 400);
  } finally {
    if (originalSecret === undefined) delete process.env.SENTRY_WEBHOOK_SECRET;
    else process.env.SENTRY_WEBHOOK_SECRET = originalSecret;
    if (originalDiscord === undefined) delete process.env.DISCORD_WEBHOOK_URL;
    else process.env.DISCORD_WEBHOOK_URL = originalDiscord;
  }
});

test("큐 비활성·인증 누락 시 저장소 접근 없이 Discord를 전달하고 활성 저장 실패는 503을 반환한다", async () => {
  const originalSecret = process.env.SENTRY_WEBHOOK_SECRET;
  const originalDiscord = process.env.DISCORD_WEBHOOK_URL;
  process.env.SENTRY_WEBHOOK_SECRET = "test-secret";
  process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/test/test";
  // 디렉터리 대신 파일을 두어 저장소 접근을 실패시킨다.
  await writeFile(join(directory, ".data"), "읽기 전용 저장소 대역");
  const post = async route => {
    const body = JSON.stringify({ action: "created", data: { issue } });
    return route.post(
      new Request("https://globber.world/webhooks/sentry", {
        method: "POST",
        body,
        headers: {
          "sentry-hook-signature": createHmac("sha256", "test-secret").update(body).digest("hex"),
          "sentry-hook-resource": "issue",
        },
      })
    );
  };
  try {
    for (const missing of ["SENTRY_JIRA_ENABLED", "JIRA_EMAIL", "JIRA_API_TOKEN"]) {
      const previous = process.env[missing];
      delete process.env[missing];
      const route = webhook();
      assert.equal((await post(route)).status, 200);
      await route.tasks.shift()();
      assert.equal(route.messages.length, 1);
      assert.equal(calls.length, 0);
      process.env[missing] = previous;
    }
    const route = webhook();
    assert.equal((await post(route)).status, 503);
    assert.equal(route.tasks.length, 0);
  } finally {
    if (originalSecret === undefined) delete process.env.SENTRY_WEBHOOK_SECRET;
    else process.env.SENTRY_WEBHOOK_SECRET = originalSecret;
    if (originalDiscord === undefined) delete process.env.DISCORD_WEBHOOK_URL;
    else process.env.DISCORD_WEBHOOK_URL = originalDiscord;
  }
});
