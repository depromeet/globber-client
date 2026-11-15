import { randomInt, randomUUID } from "node:crypto";
import { link, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

import { serverEnv } from "@/config/env";

export const sentryIssueSchema = z.object({
  id: z.string().regex(/^\d+$/).optional(),
  shortId: z.string().min(1),
  title: z.string().min(1),
  culprit: z.string().nullable().optional(),
  level: z.string().optional(),
  web_url: z.string().url(),
  count: z.string().optional(),
  userCount: z.number().int().nonnegative().optional(),
  project: z.object({ slug: z.string().optional() }).optional(),
});

export type SentryIssue = z.infer<typeof sentryIssueSchema>;

const ASSIGNEES = [
  "712020:c9117a16-ff0d-4a60-b7b0-c53e73b55192", // 장영주
  "557058:6fbe6346-903e-432b-965d-e8c92609a600", // 박건우
  "712020:426f9d32-35b9-4e88-9ad7-9d98ce60f77a", // 오유민
  "712020:8eac9db3-bbfe-4b9a-945a-21645bea892d", // 정지오
  "712020:65504c72-616b-46d6-8ed2-8bf741dd10cb", // 이승현
] as const;

const JIRA_API = "https://api.atlassian.com/ex/jira/54dfd193-6391-490d-9b3f-3b001d64107b/rest/api/3";
const RETRY_INTERVAL_MS = 60_000;
const dataDirectory = () => join(process.cwd(), ".data/sentry-jira");

const jobSchema = z.object({
  issue: sentryIssueSchema.extend({ id: z.string().regex(/^\d+$/), level: z.enum(["fatal", "error"]) }),
  assignee: z.enum(ASSIGNEES),
  status: z.enum(["pending", "creating", "done", "failed"]),
  nextAttemptAt: z.number().optional(),
  jiraKey: z.string().optional(),
});
type Job = z.infer<typeof jobSchema>;

// shortcut: Docker 단일 Node 프로세스에서 직렬 처리함. 다중 프로세스로 확장할 때 공유 큐와 원자적 잠금으로 교체.
const worker = globalThis as typeof globalThis & {
  sentryJiraDrain?: Promise<void>;
  sentryJiraTimer?: ReturnType<typeof setInterval>;
};

const saveJob = async (job: Job, createOnly = false) => {
  const directory = dataDirectory();
  await mkdir(directory, { recursive: true });
  const file = join(directory, `${job.issue.id}.json`);
  const temporary = join(directory, `${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(job), { mode: 0o600, flush: true });
    if (createOnly) {
      try {
        await link(temporary, file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    } else {
      await rename(temporary, file);
    }
  } finally {
    await rm(temporary, { force: true });
  }
};

export const isSentryJiraEnabled = () =>
  serverEnv.SENTRY_JIRA_ENABLED && Boolean(serverEnv.JIRA_EMAIL && serverEnv.JIRA_API_TOKEN);

export const enqueueSentryIssue = async (issue: SentryIssue) => {
  if (!isSentryJiraEnabled()) return;
  if (issue.level !== "fatal" && issue.level !== "error") return;
  const job = jobSchema.parse({
    issue,
    assignee: ASSIGNEES[randomInt(ASSIGNEES.length)],
    status: "pending",
  });
  // 같은 Sentry ID의 작업을 덮어쓰지 않아 재전송 때도 담당자를 유지한다.
  await saveJob(job, true);
};

class JiraHttpError extends Error {
  readonly status: number;
  readonly retryAt: number;

  constructor(status: number, retryAt: number) {
    super(`Jira HTTP ${status}`);
    this.status = status;
    this.retryAt = retryAt;
  }
}

const jiraRequest = async (path: string, body?: object) => {
  const response = await fetch(`${JIRA_API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${serverEnv.JIRA_EMAIL}:${serverEnv.JIRA_API_TOKEN}`).toString("base64")}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const retryAfter = response.headers.get("Retry-After");
    const delay = retryAfter === null ? NaN : Number(retryAfter) * 1000;
    const retryAt = Number.isFinite(delay) ? Date.now() + delay : Date.parse(retryAfter ?? "");
    throw new JiraHttpError(response.status, Math.max(Date.now() + RETRY_INTERVAL_MS, retryAt || 0));
  }
  return response.json() as Promise<unknown>;
};

const processJob = async (job: Job) => {
  if (job.status === "done" || job.status === "failed" || (job.nextAttemptAt ?? 0) > Date.now()) return;
  const label = `sentry-${job.issue.id}`;
  const query = new URLSearchParams({
    jql: `project = GLB AND labels = "${label}"`,
    fields: "key",
    maxResults: "2",
  });
  let search: { issues: { key: string }[] };
  try {
    search = z
      .object({ issues: z.array(z.object({ key: z.string().regex(/^GLB-\d+$/) })) })
      .parse(await jiraRequest(`/search/jql?${query}`));
  } catch (error) {
    if (error instanceof JiraHttpError && error.status === 429) {
      await saveJob({ ...job, nextAttemptAt: error.retryAt });
    }
    throw error;
  }
  if (search.issues.length) {
    await saveJob({ ...job, status: "done", jiraKey: search.issues[0].key });
    return;
  }
  if (job.status === "creating") {
    // 생성 결과가 불명확하면 검색으로만 복구한다. 재생성하면 타임아웃 뒤 중복 티켓이 생길 수 있다.
    console.error(`[Sentry Jira] ${job.issue.shortId}: 생성 결과 확인 필요 (Jira 레이블 ${label})`);
    return;
  }

  await saveJob({ ...job, status: "creating" });
  let created: { key: string };
  try {
    created = z.object({ key: z.string().regex(/^GLB-\d+$/) }).parse(
      await jiraRequest("/issue", {
        fields: {
          project: { key: "GLB" },
          issuetype: { id: "10010" },
          summary: `[Sentry][${job.issue.level}] ${job.issue.shortId}: ${job.issue.title}`.slice(0, 255),
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: `Sentry: ${job.issue.web_url}` }],
              },
              {
                type: "paragraph",
                content: [{ type: "text", text: `발생 위치: ${job.issue.culprit || "확인 필요"}`.slice(0, 2000) }],
              },
            ],
          },
          labels: ["sentry", label],
          assignee: { accountId: job.assignee },
        },
      })
    );
  } catch (error) {
    if (error instanceof JiraHttpError && error.status >= 400 && error.status < 500 && error.status !== 408) {
      await saveJob({
        ...job,
        status: error.status === 429 ? "pending" : "failed",
        nextAttemptAt: error.retryAt,
      });
    }
    throw error;
  }
  await saveJob({ ...job, status: "done", jiraKey: created.key });
  console.info(`[Sentry Jira] ${job.issue.shortId} → ${created.key}`);
};

export const processSentryJiraJobs = async () => {
  if (!isSentryJiraEnabled()) return;
  if (worker.sentryJiraDrain) return worker.sentryJiraDrain;
  worker.sentryJiraDrain = (async () => {
    await mkdir(dataDirectory(), { recursive: true });
    for (const name of await readdir(dataDirectory())) {
      if (!/^\d+\.json$/.test(name)) continue;
      try {
        const job = jobSchema.parse(JSON.parse(await readFile(join(dataDirectory(), name), "utf8")));
        await processJob(job);
      } catch (error) {
        // API 응답 본문·인증값·에러 원문은 로그로 노출하지 않는다.
        console.error(`[Sentry Jira] ${name}: ${error instanceof JiraHttpError ? error.message : "처리 실패"}`);
      }
    }
  })();
  try {
    await worker.sentryJiraDrain;
  } finally {
    worker.sentryJiraDrain = undefined;
  }
};

export const startSentryJiraWorker = () => {
  if (!isSentryJiraEnabled() || worker.sentryJiraTimer || process.env.NEXT_PHASE === "phase-production-build") return;
  const drain = () => processSentryJiraJobs().catch(() => console.error("[Sentry Jira] 작업 저장소 접근 실패"));
  worker.sentryJiraTimer = setInterval(drain, RETRY_INTERVAL_MS);
  worker.sentryJiraTimer.unref();
  drain();
};
