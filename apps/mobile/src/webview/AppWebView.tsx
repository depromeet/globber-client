import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Linking, Platform, StyleSheet, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";

import Constants from "expo-constants";

import { env } from "../config/env";
import { theme } from "../theme";
import { ErrorView } from "./ErrorView";
import { type IntentUrl, parseIntentUrl } from "./intentUrl";
import { shouldLoadInWebView } from "./navigationPolicy";

type AppWebViewProps = {
  /** 첫 화면 로드가 끝나면(성공/실패 모두) 호출됩니다. 스플래시를 숨기는 데 사용합니다. */
  onReady: () => void;
};

// 웹에서 앱 안에서 열렸는지 구분할 수 있도록 User-Agent에 앱 식별자를 붙입니다.
const APP_USER_AGENT_NAME = `GlobberApp/${Constants.expoConfig?.version ?? "0"}`;

export const AppWebView = ({ onReady }: AppWebViewProps) => {
  const webViewRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);
  const [hasError, setHasError] = useState(false);

  // Android 하드웨어 뒤로가기: 웹 히스토리가 있으면 웹에서 뒤로, 없으면 앱 종료
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBackRef.current) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  }, []);

  const handleNavigationStateChange = useCallback((state: WebViewNavigation) => {
    canGoBackRef.current = state.canGoBack;
  }, []);

  /**
   * Android `intent:` URL 처리 (카카오톡으로 로그인 등)
   * 앱 스킴 URL로 실행 → 실패 시 대체 URL → 그것도 없으면 Play 스토어
   */
  const openIntent = useCallback(async ({ appUrl, fallbackUrl, packageName }: IntentUrl) => {
    if (appUrl) {
      try {
        await Linking.openURL(appUrl);
        return;
      } catch {
        // 앱이 설치되어 있지 않음 → 대체 경로로 진행
      }
    }

    if (fallbackUrl) {
      if (shouldLoadInWebView(fallbackUrl, env.WEB_URL)) {
        // 허용 도메인이면 WebView 안에서 이동 (이동 시 onShouldStartLoadWithRequest 정책을 다시 거침)
        webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(fallbackUrl)}; true;`);
      } else {
        Linking.openURL(fallbackUrl).catch(() => undefined);
      }
      return;
    }

    if (packageName) {
      Linking.openURL(`market://details?id=${encodeURIComponent(packageName)}`).catch(() => undefined);
    }
  }, []);

  const handleShouldStartLoad = useCallback(
    (request: ShouldStartLoadRequest) => {
      // iframe 등 하위 프레임 요청은 제한하지 않습니다. (iOS만 isTopFrame 제공)
      if (request.isTopFrame === false) return true;

      const intent = parseIntentUrl(request.url);
      if (intent) {
        openIntent(intent).catch(() => undefined);
        return false;
      }

      if (shouldLoadInWebView(request.url, env.WEB_URL)) return true;

      // 외부 링크/커스텀 스킴(kakaotalk://, tel: 등)은 시스템에 위임
      Linking.openURL(request.url).catch(() => undefined);
      return false;
    },
    [openIntent]
  );

  const handleRetry = useCallback(() => {
    setHasError(false);
    webViewRef.current?.reload();
  }, []);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: env.WEB_URL }}
        style={styles.webView}
        // 웹 로그인(쿠키)이 WebView 안에서 유지되도록 쿠키/스토리지 허용
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        applicationNameForUserAgent={APP_USER_AGENT_NAME}
        originWhitelist={["*"]}
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
        allowsInlineMediaPlayback
        bounces={false}
        overScrollMode="never"
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onLoadEnd={onReady}
        onLoadStart={() => setHasError(false)}
        onError={() => setHasError(true)}
        onHttpError={event => {
          if (event.nativeEvent.statusCode >= 500) setHasError(true);
        }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.textPrimary} />
          </View>
        )}
      />
      {hasError ? <ErrorView onRetry={handleRetry} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  webView: { flex: 1, backgroundColor: theme.background },
  loading: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
