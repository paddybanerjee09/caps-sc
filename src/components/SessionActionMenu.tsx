import { StyleSheet } from "react-native";
import { ResponsiveTileGrid } from "./ResponsiveTileGrid";
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
    <ResponsiveTileGrid
      data={items}
      keyExtractor={(item) => item.key}
      renderItem={({ item, tileSize }) => (
        <SessionActionTile
          accessibilityLabel={item.accessibilityLabel}
          disabled={item.disabled}
          icon={item.icon}
          label={item.label}
          primary={item.primary}
          size={tileSize}
          onPress={item.onPress}
        />
      )}
      style={styles.menu}
    />
  );
}

const styles = StyleSheet.create({
  menu: {
    width: "100%",
  },
});
