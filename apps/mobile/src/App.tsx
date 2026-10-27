import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

import { theme } from "./theme";
import { AppWebView } from "./webview/AppWebView";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const Shell = () => {
  const insets = useSafeAreaInsets();

  const handleReady = useCallback(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

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
