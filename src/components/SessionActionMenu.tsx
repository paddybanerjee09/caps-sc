import { StyleSheet, View } from "react-native";
import type { SessionActionTileProps } from "./SessionActionTile";
import { SessionActionTile } from "./SessionActionTile";

export type SessionActionMenuItem = Omit<
  SessionActionTileProps,
  "size"
> & {
  key: string;
};

export type SessionActionMenuProps = {
  items: readonly SessionActionMenuItem[];
};

export function SessionActionMenu({ items }: SessionActionMenuProps) {
  return (
    <View style={styles.menu}>
      {items.map((item) => (
        <SessionActionTile
          key={item.key}
          accessibilityLabel={item.accessibilityLabel}
          disabled={item.disabled}
          icon={item.icon}
          label={item.label}
          primary={item.primary}
          onPress={item.onPress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    gap: 12,
    width: "100%",
  },
});
