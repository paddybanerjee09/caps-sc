import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../theme/ThemeContext";

export type AppModalWidth = "compact" | "form" | "wide";

type AppModalFrameProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: AppModalWidth;
  header?: ReactNode;
  footer?: ReactNode;
  dismissDisabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AppModalFrame({
  visible,
  onClose,
  children,
  width = "form",
  header,
  footer,
  dismissDisabled = false,
  style,
}: AppModalFrameProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const gutter = theme.layout.modalGutter;
  const maxHeight = Math.max(
    1,
    Math.min(theme.layout.modalMaxHeight, windowHeight - insets.top - insets.bottom - gutter * 2),
  );
  const maxWidth =
    width === "compact"
      ? theme.layout.compactModalWidth
      : width === "wide"
        ? theme.layout.wideModalWidth
        : theme.layout.formModalWidth;

  if (!visible) return null;

  const requestClose = () => {
    if (!dismissDisabled) onClose();
  };

  return (
    <Modal animationType="fade" transparent visible onRequestClose={requestClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[
          styles.overlay,
          {
            backgroundColor: theme.colors.overlay,
            paddingBottom: Math.max(gutter, insets.bottom),
            paddingHorizontal: gutter,
            paddingTop: Math.max(gutter, insets.top),
          },
        ]}
      >
        <View
          accessibilityViewIsModal
          style={[
            styles.surface,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.lg,
              maxHeight,
              maxWidth,
            },
            style,
          ]}
        >
          {header}
          <View style={styles.body}>{children}</View>
          {footer}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  surface: {
    overflow: "hidden",
    width: "100%",
  },
  body: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
});
