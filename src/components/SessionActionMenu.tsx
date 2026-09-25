import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { SessionActionTileProps } from "./SessionActionTile";
import { SessionActionTile } from "./SessionActionTile";
import {
  calculateResponsiveColumnCount,
  calculateResponsiveTileSize,
} from "../utils/responsiveGrid";
import { useAppTheme } from "../theme/ThemeContext";

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
  const { theme } = useAppTheme();
  const [availableWidth, setAvailableWidth] = useState(0);
  const gap = theme.layout.tileGap;
  const minimumTileWidth = theme.layout.tileMinWidth;
  const columnCount = useMemo(
    () => calculateResponsiveColumnCount(availableWidth, minimumTileWidth, gap, 2, 4),
    [availableWidth, gap, minimumTileWidth],
  );
  const tileSize = useMemo(
    () =>
      availableWidth > 0
        ? calculateResponsiveTileSize(availableWidth, columnCount, gap)
        : minimumTileWidth,
    [availableWidth, columnCount, gap, minimumTileWidth],
  );

  return (
    <View
      onLayout={(event) => {
        const nextWidth = Math.floor(event.nativeEvent.layout.width);
        if (nextWidth !== availableWidth) {
          setAvailableWidth(nextWidth);
        }
      }}
      style={[styles.menu, { gap }]}
    >
      {items.map((item) => (
        <SessionActionTile
          key={item.key}
          accessibilityLabel={item.accessibilityLabel}
          disabled={item.disabled}
          icon={item.icon}
          label={item.label}
          primary={item.primary}
          size={tileSize}
          onPress={item.onPress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
  },
});
