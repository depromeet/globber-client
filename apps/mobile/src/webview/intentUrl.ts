/**
 * Android `intent:` URL 파싱
 *
 * 카카오 로그인 페이지의 "카카오톡으로 로그인" 등은 Android에서 아래 형식의 URL로 앱 실행을 요청합니다.
 *   intent://<경로>#Intent;scheme=<앱 스킴>;package=<패키지명>;S.browser_fallback_url=<URL>;end
 *
 * React Native의 `Linking.openURL`은 `intent:` URL을 직접 열 수 없으므로,
 * 앱 스킴 URL(`<앱 스킴>://<경로>`), 대체 URL, 패키지명으로 나눠서 처리합니다.
 */

export type IntentUrl = {
  /** 앱을 직접 여는 URL (예: kakaokompassauth://authorize?...) */
  appUrl: string | null;
  /** 앱이 없을 때 이동할 웹 URL */
  fallbackUrl: string | null;
  /** 앱이 없고 대체 URL도 없을 때 스토어로 안내할 패키지명 */
  packageName: string | null;
};

const INTENT_PREFIX = "intent:";
const INTENT_MARKER = "#Intent;";

const safeDecode = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

export const parseIntentUrl = (url: string): IntentUrl | null => {
  if (!url.toLowerCase().startsWith(INTENT_PREFIX)) return null;

  const markerIndex = url.indexOf(INTENT_MARKER);
  if (markerIndex === -1) return null;

  // "intent:" 와 "#Intent;" 사이 (보통 "//host/path?query")
  const target = url.slice(INTENT_PREFIX.length, markerIndex);

  const params = new Map<string, string>();
  for (const part of url.slice(markerIndex + INTENT_MARKER.length).split(";")) {
    if (part === "end") break;

    // 값 안에 "="가 있을 수 있으므로 첫 "="에서만 나눕니다.
    const equalIndex = part.indexOf("=");
    if (equalIndex > 0) params.set(part.slice(0, equalIndex), part.slice(equalIndex + 1));
  }

  const scheme = params.get("scheme");
  const rawFallback = params.get("S.browser_fallback_url");
  const fallbackUrl = rawFallback ? safeDecode(rawFallback) : null;

  return {
    // 스킴은 영문/숫자/+/./- 만 허용 (임의 문자열이 앱 URL로 조립되는 것을 방지)
    appUrl: scheme && /^[a-z][a-z0-9+.-]*$/i.test(scheme) ? `${scheme}:${target || "//"}` : null,
    // 대체 URL은 http(s)만 사용
    fallbackUrl: fallbackUrl && /^https?:\/\//i.test(fallbackUrl) ? fallbackUrl : null,
    packageName: params.get("package") ?? null,
  };
};
