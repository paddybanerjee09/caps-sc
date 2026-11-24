import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import { useAppTheme } from "../../theme/ThemeContext";

export function ExerciseImage({ uri, name, large = false }: {
  uri?: string | null;
  name: string;
  large?: boolean;
}) {
  const { theme } = useAppTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const size = large ? styles.large : styles.thumbnail;
  return uri && uri !== failedUri ? (
    <Image accessibilityLabel={name} onError={() => setFailedUri(uri)} resizeMode="contain" source={{ uri }} style={[size, { backgroundColor: theme.colors.surfaceMuted }]} />
  ) : (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[size, styles.fallback, { backgroundColor: theme.colors.surfaceMuted }]}>
      <Ionicons name="barbell-outline" size={large ? 40 : 28} color={theme.colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  thumbnail: { width: 64, height: 64, borderRadius: 10 },
  large: { width: "100%", height: 152, borderRadius: 12 },
  fallback: { alignItems: "center", justifyContent: "center" },
});
