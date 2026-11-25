import { useAppTheme } from "../../theme/ThemeContext";
import { ActionButton } from "../ActionButton";

export function EstimatedFocusButton({ value, onPress, color, disabled = false }: {
  value: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <ActionButton
      disabled={disabled}
      label={`Estimated focus · ${value}`}
      onPress={onPress}
      style={{ borderColor: color ?? theme.colors.textMuted }}
      tone="secondary"
    />
  );
}
