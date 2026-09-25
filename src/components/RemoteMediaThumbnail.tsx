import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { useAppTheme } from "../theme/ThemeContext";

type RemoteMediaThumbnailProps = {
  uri: string | null;
  recyclingKey: string;
  accessibilityLabel: string;
  size?: number;
};

export function RemoteMediaThumbnail({
  uri,
  recyclingKey,
  accessibilityLabel,
  size,
}: RemoteMediaThumbnailProps) {
  const { theme } = useAppTheme();
  const dimension = size ?? theme.layout.mediaThumbnail;
  const [failed, setFailed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    setFailed(false);
  }, [uri, recyclingKey]);

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.frame,
        {
          width: dimension,
          height: dimension,
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.surfaceMuted,
        },
      ]}
    >
      {uri && !failed ? (
        <Image
          accessibilityIgnoresInvertColors
          autoplay={!reduceMotion}
          cachePolicy="memory-disk"
          contentFit="cover"
          recyclingKey={recyclingKey}
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          onError={() => setFailed(true)}
        />
      ) : (
        <Ionicons accessibilityLabel="Exercise preview unavailable" color={theme.colors.textMuted} name="barbell-outline" size={24} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
