import { Image, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;
const darkModeIcon = require("../../assets/images/CAPS_Icon_Dark.png");
const lightModeIcon = require("../../assets/images/CAPS_Icon_Light.png");

type HeaderProps = {
  onMenuPress: () => void;
  topInset: number;
};

export function Header({ onMenuPress, topInset }: HeaderProps) {
  const { colorScheme, theme } = useAppTheme();

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: theme.colors.background,
          borderBottomColor: theme.colors.border,
          paddingTop: topInset + theme.spacing.sm,
        },
      ]}
    >
      <PressOpacity
        accessibilityLabel="Open sidebar"
        onPress={onMenuPress}
        style={styles.iconButton}
      >
        <View style={[styles.menuLine, { backgroundColor: theme.colors.text }]} />
        <View style={[styles.menuLine, { backgroundColor: theme.colors.text }]} />
        <View style={[styles.menuLine, { backgroundColor: theme.colors.text }]} />
      </PressOpacity>

      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel="CAPS"
        resizeMode="cover"
        source={colorScheme === "dark" ? darkModeIcon : lightModeIcon}
        style={[styles.logo, { top: topInset + theme.spacing.sm + 3 }]}
      />

      <PressOpacity
        accessibilityLabel="CAPS AI"
        onPress={() => {}}
        style={[styles.aiButton, { backgroundColor: theme.colors.tertiary }]}
      >
        <Text style={styles.aiButtonText}>CAPS AI</Text>
      </PressOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
  },
  iconButton: {
    alignItems: "center",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  logo: {
    height: 34,
    left: "50%",
    marginLeft: -80,
    position: "absolute",
    width: 160,
  },
  menuLine: {
    borderRadius: 999,
    height: 2,
    marginVertical: 2,
    width: 17,
  },
  aiButton: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: tokens.spacing.lg,
  },
  aiButtonText: {
    color: "#FFFFFF",
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
});
