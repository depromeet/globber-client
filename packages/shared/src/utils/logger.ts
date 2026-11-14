/**
 * 웹·앱 공용 로거 (GLB-287·288).
 * - debug·warn: 개발 환경에서만 출력한다.
 * - error: 개발 환경에서는 전체를 출력한다. 운영에서는 서버(컨테이너 로그)에만 메시지를 남기고,
 *   사용자 브라우저 콘솔에는 남기지 않는다.
 * - Sentry 보고는 하지 않는다. 처리한 오류 중 보고가 필요한 곳은 reportError를 직접 호출한다(무료 요금제 한도).
 */
const isDev = () => process.env.NODE_ENV === "development";
const isServer = () => typeof window === "undefined";

const describe = (error: unknown): string => {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return error === undefined ? "" : String(error);
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
    if (isServer()) console.error(error === undefined ? message : `${message} ${describe(error)}`);
  },
};
