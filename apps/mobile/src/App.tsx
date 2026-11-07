import { useCallback, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

import { theme } from "./theme";
import { AppWebView } from "./webview/AppWebView";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const SPLASH_MAX_DURATION_MS = 6000;

const Shell = () => {
  const insets = useSafeAreaInsets();

  const handleReady = useCallback(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  // 첫 로드가 길어지거나 onLoadEnd가 오지 않아도 스플래시에 갇히지 않도록 일정 시간 뒤 숨깁니다.
  // (스플래시가 사라져야 아래의 로딩 표시나 에러 화면이 보입니다.)
  useEffect(() => {
    const timer = setTimeout(handleReady, SPLASH_MAX_DURATION_MS);
    return () => clearTimeout(timer);
  }, [handleReady]);

  // 웹은 safe-area 를 직접 처리하지 않으므로 셸에서 노치/홈 인디케이터 영역을 비워 줍니다.
  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      <AppWebView onReady={handleReady} />
    </View>
  );
};

const App = () => {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
};

export default App;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
});
