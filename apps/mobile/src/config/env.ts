// EXPO_PUBLIC_* 는 번들 시점에 인라인되므로 반드시 `process.env.EXPO_PUBLIC_X` 형태로 직접 참조해야 합니다.
export const env = {
  /**
   * WebView로 보여줄 웹 주소.
   * 로컬 웹 서버를 볼 때는 EXPO_PUBLIC_WEB_URL=http://localhost:3000 (Android 에뮬레이터는 http://10.0.2.2:3000)
   */
  WEB_URL: process.env.EXPO_PUBLIC_WEB_URL || "https://globber.world",
} as const;
