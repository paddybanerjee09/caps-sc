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
import { MenuButton } from "./MenuButton";

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
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.borderStrong,
          paddingTop: topInset + theme.spacing.xs,
        },
      ]}
    >
      <MenuButton onPress={onMenuPress} />

      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel="CAPS"
        resizeMode="cover"
        source={logos[colorScheme][tertiaryColor]}
        style={[styles.logo, { top: topInset + theme.spacing.sm + 4 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingBottom: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
  },
  logo: {
    height: 34,
    left: "50%",
    marginLeft: -80,
    position: "absolute",
    width: 160,
  },
});
