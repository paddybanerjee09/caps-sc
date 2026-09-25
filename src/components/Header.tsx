import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import {
  themes,
  type ColorScheme,
  type TertiaryColor,
} from "../theme/theme";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;
const logos = {
  dark: {
    blue: require("../../assets/images/CAPS_Icon_Dark_Blue.png"),
    green: require("../../assets/images/CAPS_Icon_Dark_Green.png"),
    orange: require("../../assets/images/CAPS_Icon_Dark_Orange.png"),
    pink: require("../../assets/images/CAPS_Icon_Dark_Pink.png"),
    purple: require("../../assets/images/CAPS_Icon_Dark_Purple.png"),
    red: require("../../assets/images/CAPS_Icon_Dark_Red.png"),
    turquoise: require("../../assets/images/CAPS_Icon_Dark_Turquoise.png"),
    yellow: require("../../assets/images/CAPS_Icon_Dark_Yellow.png"),
  },
  light: {
    blue: require("../../assets/images/CAPS_Icon_Light_Blue.png"),
    green: require("../../assets/images/CAPS_Icon_Light_Green.png"),
    orange: require("../../assets/images/CAPS_Icon_Light_Orange.png"),
    pink: require("../../assets/images/CAPS_Icon_Light_Pink.png"),
    purple: require("../../assets/images/CAPS_Icon_Light_Purple.png"),
    red: require("../../assets/images/CAPS_Icon_Light_Red.png"),
    turquoise: require("../../assets/images/CAPS_Icon_Light_Turquoise.png"),
    yellow: require("../../assets/images/CAPS_Icon_Light_Yellow.png"),
  },
} satisfies Record<
  ColorScheme,
  Record<TertiaryColor, ImageSourcePropType>
>;

type HeaderProps = {
  onMenuPress: () => void;
  topInset: number;
};

export function Header({ onMenuPress, topInset }: HeaderProps) {
  const { colorScheme, tertiaryColor, theme } = useAppTheme();

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

      <View
        pointerEvents="none"
        style={[
          styles.logoOverlay,
          {
            left: 0,
            right: 0,
            top: topInset + theme.spacing.sm,
          },
        ]}
      >
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel="CAPS"
          resizeMode="cover"
          source={logos[colorScheme][tertiaryColor]}
          style={styles.logo}
        />
      </View>

      <View style={styles.trailingSpacer} />
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
  logoOverlay: {
    alignItems: "center",
    bottom: tokens.spacing.sm,
    justifyContent: "center",
    position: "absolute",
  },
  logo: {
    height: 34,
    width: 160,
  },
  menuLine: {
    borderRadius: 999,
    height: 2,
    marginVertical: 2,
    width: 17,
  },
  trailingSpacer: {
    height: 40,
    width: 40,
  },
});
