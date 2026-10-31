import { after, type NextRequest, NextResponse } from "next/server";

import { isValidHmacSignature, sendToDiscord, truncate } from "../_lib/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Jira 시스템 웹훅 → Discord 중계
 * 2026-12-03부터 Jira 자동화가 단계 수로 과금되어 무료 요금제는 월 150단계에서 멈추므로,
 * 자동화 사용량에 잡히지 않는 시스템 웹훅으로 이슈 생성·담당자 변경·댓글 알림을 받아 Discord로 전송합니다.
 * 알림 조건은 기존 자동화 규칙(create issue / assignee change / create comment webhook)과 같고, 메시지는 Discord embed로 보냅니다.
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
  // 담당자 필드는 from/to에 accountId가 들어 있음
  from?: string | null;
  to?: string | null;
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

// Jira accountId → Discord 사용자 ID (새 담당자·댓글 멘션용)
// 표시 이름은 바뀔 수 있으므로 accountId로 매핑함
const DISCORD_IDS: Record<string, string> = {
  // 김민우: Jira 계정이 없음. 다시 합류하면 accountId를 넣고 주석 해제
  // "<accountId>": "712043613701406740", // 김민우
  "712020:2ef1b3b8-c8a7-48e0-9487-88cb67eef91f": "266139701239480320", // 박이현
  "712020:65504c72-616b-46d6-8ed2-8bf741dd10cb": "443322190423654403", // 이승현
  "61be1c2221f38100674cae7b": "925728608901816380", // 민지장(장민지)
  "557058:6fbe6346-903e-432b-965d-e8c92609a600": "564478771860733962", // 박건우
  "712020:3ba60de5-62aa-463e-9b80-0c98bc3eda5e": "1045692002039242842", // 김정우
  "712020:c9117a16-ff0d-4a60-b7b0-c53e73b55192": "581470166240591882", // 장영주
  "712020:426f9d32-35b9-4e88-9ad7-9d98ce60f77a": "1193529060043804793", // 오유민
  "712020:658f9d36-1e86-4778-96c6-ef7a757cd214": "954736662305448067", // 이유정
  "712020:8eac9db3-bbfe-4b9a-945a-21645bea892d": "400201051656945664", // 정지오
  "712020:a62389b1-3f9d-4418-9b8e-5c1da81cd97b": "338574015667109891", // 최기웅
};

// 댓글 본문(위키 마크업)의 Jira 멘션 [~accountid:<id>]
const JIRA_MENTION_PATTERN = /\[~accountid:([^\]]+)\]/g;

// Discord embed 길이 제한
const EMBED_TITLE_MAX = 256;
const EMBED_DESCRIPTION_MAX = 4096;
const EMBED_FIELD_MAX = 1024;

// 알림 종류마다 embed 왼쪽 띠 색을 다르게 해 한눈에 구분되게 함
const NOTICE_COLORS = {
  created: 0x2684ff,
  assigneeChanged: 0x8b5cf6,
  comment: 0x22c55e,
};

// Automation for Jira 같은 앱 계정의 변경은 알리지 않음 (기존 규칙의 "사용자 작업만 트리거"와 동일)
const isAppActor = (user?: JiraUser) => user?.accountType === "app";

const isEpic = (issue: JiraIssue) => {
  const issueType = issue.fields.issuetype;
  return issueType?.hierarchyLevel === 1 || issueType?.name === "에픽" || issueType?.name === "Epic";
};

const field = (name: string, value?: string | null) => ({
  name,
  value: truncate(value || "-", EMBED_FIELD_MAX),
  inline: true,
});

const buildEmbed = (issue: JiraIssue, label: string, color: number, rest: Record<string, unknown>) => ({
  author: { name: label },
  title: truncate(`[${issue.key}] ${issue.fields.summary ?? ""}`, EMBED_TITLE_MAX),
  url: `${new URL(issue.self).origin}/browse/${issue.key}`,
  color,
  timestamp: new Date().toISOString(),
  ...rest,
});

const buildIssueCreatedNotice = (issue: JiraIssue, actor?: JiraUser): JiraNotice => {
  // 담당자가 비어 있으면 자동화가 보고자를 담당자로 지정하므로 보고자를 표시
  const assignee = issue.fields.assignee?.displayName ?? issue.fields.reporter?.displayName;
  const embed = buildEmbed(issue, "🆕 새 이슈", NOTICE_COLORS.created, {
    fields: [
      field("유형", issue.fields.issuetype?.name),
      field("담당자", assignee),
      field("생성자", actor?.displayName),
    ],
  });
  return { embed, mentionIds: [] };
};

const buildAssigneeChangedNotice = (issue: JiraIssue, change: JiraChangelogItem, actor?: JiraUser): JiraNotice => {
  const discordId = change.to ? DISCORD_IDS[change.to] : undefined;
  const embed = buildEmbed(issue, "👥 담당자 변경", NOTICE_COLORS.assigneeChanged, {
    fields: [
      field("이전 담당자", change.fromString || "없음"),
      field("새 담당자", change.toString || "없음"),
      field("변경한 사람", actor?.displayName),
    ],
  });
  return { embed, mentionIds: discordId ? [discordId] : [] };
};

const buildCommentNotice = (issue: JiraIssue, comment: NonNullable<JiraWebhook["comment"]>): JiraNotice => {
  // Jira 멘션을 Discord 멘션으로 바꾸고, 매핑이 없는 사람은 accountId 대신 일반 문구로 표시
  const mentionIds = new Set<string>();
  const body = (comment.body ?? "").replace(JIRA_MENTION_PATTERN, (_, accountId: string) => {
    const discordId = DISCORD_IDS[accountId];
    if (!discordId) return "@알 수 없는 사용자";
    mentionIds.add(discordId);
    return `<@${discordId}>`;
  });
  const embed = buildEmbed(issue, "📢 새 코멘트", NOTICE_COLORS.comment, {
    description: body ? truncate(body, EMBED_DESCRIPTION_MAX) : undefined,
    footer: { text: `작성자: ${comment.author?.displayName ?? "-"}` },
  });
  return { embed, mentionIds: [...mentionIds] };
};

// mentionIds: 실제로 알림을 보낼 Discord 사용자 ID. 이 목록 밖의 멘션(제목에 넣은 <@id> 등)은 알림이 가지 않음
type JiraNotice = { embed: Record<string, unknown>; mentionIds: string[] };

const buildNotice = (payload: JiraWebhook): JiraNotice | null => {
  const { webhookEvent, issue, user } = payload;
  if (!issue || isAppActor(user)) return null;

  switch (webhookEvent) {
    case "jira:issue_created":
      return isEpic(issue) ? null : buildIssueCreatedNotice(issue, user);
    case "jira:issue_updated": {
      const change = payload.changelog?.items?.find(item => item.fieldId === "assignee" || item.field === "assignee");
      return change ? buildAssigneeChangedNotice(issue, change, user) : null;
    }
    case "comment_created":
      return payload.comment ? buildCommentNotice(issue, payload.comment) : null;
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
  // embed 안의 멘션은 알림이 가지 않으므로, 알림을 보낼 사람은 content에 멘션함
  // allowed_mentions로 @everyone·@here·역할 멘션을 막고, 새 담당자와 댓글에서 멘션된 사람만 알림을 받게 함
  const message = {
    content: notice.mentionIds.map(id => `<@${id}>`).join(" ") || undefined,
    embeds: [notice.embed],
    allowed_mentions: { parse: [], users: notice.mentionIds },
  };
  after(() => sendToDiscord(discordWebhookUrl, message, "Jira Webhook"));

  return NextResponse.json({ ok: true });
}
