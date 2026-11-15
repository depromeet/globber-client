/**
 * 웹·앱 공용 로거 (GLB-287·288).
 * - debug·warn: 개발 환경에서만 출력한다.
 * - error: 개발 환경에서는 전체를 출력한다. 운영에서는 서버(컨테이너 로그)에만 메시지를 남기고,
 *   사용자 브라우저 콘솔에는 남기지 않는다.
 * - Sentry 보고는 하지 않는다. 처리한 오류 중 보고가 필요한 곳은 reportError를 직접 호출한다(무료 요금제 한도).
 */
const isDev = () => process.env.NODE_ENV === "development";
const isServer = () => typeof window === "undefined";

// 운영 서버 로그 한 줄의 최대 길이. 오류 메시지에 HTML 응답 본문 등이 통째로 들어와도 로그가 넘치지 않게 자른다
const MAX_SERVER_LINE_LENGTH = 500;

const describe = (error: unknown): string => {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return error === undefined ? "" : String(error);
};

/** 줄바꿈을 공백으로 바꿔 한 줄로 만들고 너무 길면 자른다 */
const toSingleLine = (text: string): string => {
  const line = text.replace(/\s*[\r\n]+\s*/g, " ").trim();
  return line.length > MAX_SERVER_LINE_LENGTH ? `${line.slice(0, MAX_SERVER_LINE_LENGTH)}…` : line;
};

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev()) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev()) console.warn(...args);
  },
  error: (message: string, error?: unknown) => {
    if (isDev()) {
      if (error === undefined) console.error(message);
      else console.error(message, error);
      return;
    }
    if (isServer()) console.error(toSingleLine(error === undefined ? message : `${message} ${describe(error)}`));
  },
};
