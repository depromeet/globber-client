/**
 * WebView 안에서 직접 열어도 되는 주소인지 판단합니다.
 *
 * - 서비스 도메인과 카카오 로그인 도메인은 WebView 안에서 이동합니다.
 * - 그 외 http(s) 링크와 커스텀 스킴(kakaotalk://, tel:, mailto: 등)은 시스템이 처리하도록 외부로 넘깁니다.
 */

const KAKAO_HOST_SUFFIXES = [".kakao.com", ".kakaocdn.net"];

/**
 * http(s) URL의 hostname을 꺼냅니다. (그 외 스킴은 null)
 *
 * React Native 내장 `URL`은 표준(WHATWG) 파서가 아니라 정규식 기반이라
 * `https://evil.example/?a=b@globber.world` 의 hostname을 `globber.world`로 잘못 읽습니다.
 * 그래서 표준과 같은 순서로 직접 파싱합니다.
 * 1. authority = `scheme://` 뒤부터 첫 `/`, `\`, `?`, `#` 전까지 (`\`는 표준에서 `/`와 같이 취급)
 * 2. userinfo(`아이디:비밀번호@`) 제거: authority 안의 마지막 `@` 뒤가 호스트
 * 3. 포트 제거 (IPv6 `[::1]:8080` 형태 고려)
 */
const getHostname = (url: string): string | null => {
  const match = /^https?:\/\/([^/\\?#]*)/i.exec(url.trim());
  if (!match) return null;

  const authority = match[1];
  const hostAndPort = authority.slice(authority.lastIndexOf("@") + 1);
  const host = hostAndPort.startsWith("[")
    ? hostAndPort.slice(0, hostAndPort.indexOf("]") + 1)
    : hostAndPort.split(":")[0];

  return host ? host.toLowerCase() : null;
};

const isIpOrSingleLabel = (hostname: string): boolean =>
  hostname.startsWith("[") || /^\d+(\.\d+){3}$/.test(hostname) || !hostname.includes(".");

const isSameSite = (hostname: string, webHostname: string): boolean => {
  if (hostname === webHostname) return true;

  // localhost, IP(로컬 개발용 10.0.2.2 등)는 하위 도메인 개념이 없으므로 정확히 일치할 때만 허용
  if (isIpOrSingleLabel(webHostname)) return false;

  // 서비스 루트 도메인(globber.world)과 그 하위 도메인
  const rootDomain = webHostname.split(".").slice(-2).join(".");
  return hostname === rootDomain || hostname.endsWith(`.${rootDomain}`);
};

export const shouldLoadInWebView = (url: string, webUrl: string): boolean => {
  if (url === "about:blank") return true;

  const hostname = getHostname(url);
  if (!hostname) return false;

  const webHostname = getHostname(webUrl);
  if (webHostname && isSameSite(hostname, webHostname)) return true;

  return KAKAO_HOST_SUFFIXES.some(suffix => hostname.endsWith(suffix));
};
