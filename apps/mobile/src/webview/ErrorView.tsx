import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";

type ErrorViewProps = {
  onRetry: () => void;
};

export const ErrorView = ({ onRetry }: ErrorViewProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>페이지를 불러오지 못했어요</Text>
      <Text style={styles.description}>네트워크 연결을 확인한 뒤 다시 시도해주세요.</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonLabel}>다시 시도</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  title: { color: theme.textPrimary, fontSize: 18, fontWeight: "600" },
  description: { color: theme.textSecondary, fontSize: 14, textAlign: "center" },
  button: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.surface,
  },
  buttonLabel: { color: theme.textPrimary, fontSize: 14, fontWeight: "500" },
  pressed: { opacity: 0.85 },
});
