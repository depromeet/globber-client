import { after, type NextRequest, NextResponse } from "next/server";

import { isValidHmacSignature, sendToDiscord, truncate } from "../_lib/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Jira 시스템 웹훅 → Discord 중계
 * 2026-12-03부터 Jira 자동화가 단계 수로 과금되어 무료 요금제는 월 150단계에서 멈추므로,
 * 자동화 사용량에 잡히지 않는 시스템 웹훅으로 이슈 생성·담당자 변경·댓글 알림을 받아 Discord로 전송합니다.
 * 알림 조건과 메시지 형식은 기존 자동화 규칙(create issue / assignee change / create comment webhook)과 같습니다.
 *
 * 필요한 환경변수
 * - JIRA_WEBHOOK_SECRET: Jira 시스템 웹훅에 설정한 비밀값
 * - JIRA_DISCORD_WEBHOOK_URL: Jira 알림을 받을 Discord 채널의 웹훅 URL
 *
 * @see https://developer.atlassian.com/cloud/jira/platform/webhooks/
 */

type JiraUser = {
  accountId?: string;
  accountType?: string;
  displayName?: string;
};

type JiraIssue = {
  key: string;
  self: string;
  fields: {
    summary?: string;
    issuetype?: { name?: string; hierarchyLevel?: number };
    assignee?: JiraUser | null;
    reporter?: JiraUser | null;
  };
};

type JiraChangelogItem = {
  field?: string;
  fieldId?: string;
  fromString?: string | null;
  toString?: string | null;
};

type JiraWebhook = {
  webhookEvent?: string;
  user?: JiraUser;
  issue?: JiraIssue;
  changelog?: { items?: JiraChangelogItem[] };
  comment?: { author?: JiraUser; body?: string };
};

// Jira 표시 이름 → Discord 사용자 ID (새 담당자 멘션용)
const DISCORD_MENTIONS: Record<string, string> = {
  박이현: "266139701239480320",
  이승현: "443322190423654403",
  민지장: "925728608901816380",
  박건우: "564478771860733962",
  김민우: "712043613701406740",
  김정우: "1045692002039242842",
  장영주: "581470166240591882",
  오유민: "1193529060043804793",
  이유정: "954736662305448067",
  정지오: "400201051656945664",
  최기웅: "338574015667109891",
};

const DISCORD_CONTENT_MAX = 2000;

// Automation for Jira 같은 앱 계정의 변경은 알리지 않음 (기존 규칙의 "사용자 작업만 트리거"와 동일)
const isAppActor = (user?: JiraUser) => user?.accountType === "app";

const isEpic = (issue: JiraIssue) => {
  const issueType = issue.fields.issuetype;
  return issueType?.hierarchyLevel === 1 || issueType?.name === "에픽" || issueType?.name === "Epic";
};

const issueLink = (issue: JiraIssue) => {
  const browseUrl = `${new URL(issue.self).origin}/browse/${issue.key}`;
  return `🔹 [${issue.key} ${issue.fields.summary ?? ""}](${browseUrl})`;
};

const buildIssueCreatedMessage = (issue: JiraIssue, actor?: JiraUser) => {
  // 담당자가 비어 있으면 자동화가 보고자를 담당자로 지정하므로 보고자를 표시
  const assignee = issue.fields.assignee?.displayName ?? issue.fields.reporter?.displayName ?? "-";
  return [
    "🆕 새 이슈가 생성되었습니다.",
    "",
    issueLink(issue),
    `📂 ${issue.fields.issuetype?.name ?? "-"} · 👤 담당자: ${assignee}`,
    `✍️ 생성자: ${actor?.displayName ?? "-"}`,
  ].join("\n");
};

const buildAssigneeChangedMessage = (issue: JiraIssue, change: JiraChangelogItem, actor?: JiraUser) => {
  const from = change.fromString || "없음";
  // 새 담당자는 Discord 멘션으로 표시하고, 매핑이 없는 사람은 이름으로 표시
  const discordId = change.toString ? DISCORD_MENTIONS[change.toString] : undefined;
  const to = discordId ? `<@${discordId}>` : change.toString || "없음";
  const content = [
    "👥 담당자가 변경되었습니다.",
    "",
    issueLink(issue),
    `🔄 ${from} → ${to}`,
    `👤 변경: ${actor?.displayName ?? "-"}`,
  ].join("\n");
  return { content, mentionIds: discordId ? [discordId] : [] };
};

const buildCommentMessage = (issue: JiraIssue, comment: NonNullable<JiraWebhook["comment"]>) =>
  [
    "📢 새로운 코멘트가 있습니다.",
    "",
    issueLink(issue),
    `👤 ${comment.author?.displayName ?? "-"}`,
    "",
    comment.body ?? "",
  ].join("\n");

// mentionIds: 실제로 알림을 보낼 Discord 사용자 ID. 제목·댓글에 들어 있는 다른 멘션은 알림이 가지 않음
type JiraNotice = { content: string; mentionIds: string[] };

const buildNotice = (payload: JiraWebhook): JiraNotice | null => {
  const { webhookEvent, issue, user } = payload;
  if (!issue || isAppActor(user)) return null;

  switch (webhookEvent) {
    case "jira:issue_created":
      return isEpic(issue) ? null : { content: buildIssueCreatedMessage(issue, user), mentionIds: [] };
    case "jira:issue_updated": {
      const change = payload.changelog?.items?.find(item => item.fieldId === "assignee" || item.field === "assignee");
      return change ? buildAssigneeChangedMessage(issue, change, user) : null;
    }
    case "comment_created":
      return payload.comment ? { content: buildCommentMessage(issue, payload.comment), mentionIds: [] } : null;
    default:
      return null;
  }
};

export async function POST(request: NextRequest) {
  const secret = process.env.JIRA_WEBHOOK_SECRET;
  const discordWebhookUrl = process.env.JIRA_DISCORD_WEBHOOK_URL;
  if (!secret || !discordWebhookUrl) {
    console.error("[Jira Webhook] JIRA_WEBHOOK_SECRET 또는 JIRA_DISCORD_WEBHOOK_URL이 설정되지 않았습니다.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  // Jira는 비밀값이 설정된 웹훅에 X-Hub-Signature: sha256=<hex> 헤더를 붙임
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature")?.replace(/^sha256=/, "") ?? null;
  if (!isValidHmacSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: JiraWebhook;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const notice = buildNotice(payload);
  if (!notice) {
    return NextResponse.json({ ok: true, skipped: payload.webhookEvent });
  }

  // 응답을 먼저 보내 Jira 쪽 타임아웃·재전송을 피하고, Discord 전송은 응답 후에 수행
  // allowed_mentions로 @everyone·@here·역할 멘션을 막고, 새 담당자만 멘션되게 함
  const message = {
    content: truncate(notice.content, DISCORD_CONTENT_MAX),
    allowed_mentions: { parse: [], users: notice.mentionIds },
  };
  after(() => sendToDiscord(discordWebhookUrl, message, "Jira Webhook"));

  return NextResponse.json({ ok: true });
}
