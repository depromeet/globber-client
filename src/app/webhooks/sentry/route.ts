import { after, type NextRequest, NextResponse } from "next/server";

import { isValidHmacSignature, sendToDiscord, truncate } from "../_lib/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sentry Custom Integration 웹훅 → Discord 중계
 * Developer(무료) 요금제는 Discord 알림 액션을 막지만, 이슈 웹훅 구독은 허용하므로
 * 새 이슈(created)와 재발(unresolved) 웹훅을 받아 Discord 웹훅 형식으로 변환해 전송합니다.
 *
 * 필요한 환경변수
 * - SENTRY_WEBHOOK_SECRET: Sentry Custom Integration의 Client Secret
 * - DISCORD_WEBHOOK_URL: 알림을 받을 Discord 채널의 웹훅 URL
 *
 * @see https://docs.sentry.io/organization/integrations/integration-platform/webhooks/
 */

type SentryIssue = {
  shortId: string;
  title: string;
  culprit?: string | null;
  level?: string;
  web_url: string;
  count?: string;
  userCount?: number;
  project?: { slug?: string };
};

type SentryIssueWebhook = {
  action: "created" | "resolved" | "assigned" | "archived" | "unresolved";
  data: { issue: SentryIssue };
};

const NOTIFY_ACTIONS: Record<string, string> = {
  created: "🚨 새 이슈",
  unresolved: "🔁 재발한 이슈",
};

const LEVEL_COLORS: Record<string, number> = {
  fatal: 0x7c1d1d,
  error: 0xe03e2f,
  warning: 0xf5a623,
  info: 0x3b82f6,
};

const buildDiscordMessage = (action: string, issue: SentryIssue) => ({
  embeds: [
    {
      title: truncate(`[${issue.shortId}] ${issue.title}`, 256),
      url: issue.web_url,
      description: issue.culprit ? truncate(issue.culprit, 1024) : undefined,
      color: LEVEL_COLORS[issue.level ?? "error"] ?? LEVEL_COLORS.error,
      fields: [
        { name: "구분", value: NOTIFY_ACTIONS[action], inline: true },
        { name: "레벨", value: issue.level ?? "-", inline: true },
        { name: "발생 / 사용자", value: `${issue.count ?? "-"}회 / ${issue.userCount ?? "-"}명`, inline: true },
      ],
      footer: { text: issue.project?.slug ?? "sentry" },
      timestamp: new Date().toISOString(),
    },
  ],
});

export async function POST(request: NextRequest) {
  const secret = process.env.SENTRY_WEBHOOK_SECRET;
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!secret || !discordWebhookUrl) {
    console.error("[Sentry Webhook] SENTRY_WEBHOOK_SECRET 또는 DISCORD_WEBHOOK_URL이 설정되지 않았습니다.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!isValidHmacSignature(rawBody, request.headers.get("sentry-hook-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // installation 등 이슈 외 리소스는 수신만 확인
  if (request.headers.get("sentry-hook-resource") !== "issue") {
    return NextResponse.json({ ok: true });
  }

  let payload: SentryIssueWebhook;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!NOTIFY_ACTIONS[payload.action] || !payload.data?.issue) {
    return NextResponse.json({ ok: true, skipped: payload.action });
  }

  // Sentry는 1초 안에 응답하지 않으면 타임아웃으로 처리하므로, 먼저 응답하고 Discord 전송은 응답 후에 수행
  const message = buildDiscordMessage(payload.action, payload.data.issue);
  after(() => sendToDiscord(discordWebhookUrl, message, "Sentry Webhook"));

  return NextResponse.json({ ok: true });
}
