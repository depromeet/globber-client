import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 웹훅 중계 라우트(/webhooks/*)가 함께 쓰는 서명 검증과 Discord 전송
 */

/** 요청 본문의 HMAC-SHA256 hex 값이 서명과 일치하는지 확인 */
export const isValidHmacSignature = (rawBody: string, signature: string | null, secret: string) => {
  if (!signature) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const expected = Buffer.from(digest);
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
};

export const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const DISCORD_TIMEOUT_MS = 5000;
// 429 응답의 Retry-After가 이보다 길면 재시도하지 않고 실패로 기록
const DISCORD_MAX_RETRY_WAIT_MS = 5000;

export const sendToDiscord = async (webhookUrl: string, message: object, logPrefix: string) => {
  // wait=true가 없으면 Discord는 메시지 저장에 실패해도 오류를 반환하지 않을 수 있음
  const url = new URL(webhookUrl);
  url.searchParams.set("wait", "true");
  const send = () =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
    });

  try {
    let response = await send();
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After")?.trim();
      const retryAfterMs = retryAfter ? Math.ceil(Number(retryAfter) * 1000) : NaN;
      if (Number.isFinite(retryAfterMs) && retryAfterMs >= 0 && retryAfterMs <= DISCORD_MAX_RETRY_WAIT_MS) {
        await response.body?.cancel();
        await new Promise(resolve => setTimeout(resolve, retryAfterMs));
        response = await send();
      }
    }
    if (!response.ok) {
      console.error(`[${logPrefix}] Discord 전송 실패: ${response.status}`);
    }
  } catch (error) {
    console.error(`[${logPrefix}] Discord 전송 중 오류:`, error);
  }
};
