import { useMemo, useState, type ReactElement } from "react";
import {
  FlatList,
  StyleSheet,
  View,
  type ListRenderItemInfo,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useAppTheme } from "../theme/ThemeContext";
import {
  calculateResponsiveColumnCount,
  calculateResponsiveTileSize,
} from "../utils/responsiveGrid";

export type ResponsiveTileGridProps<T> = {
  data: readonly T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (info: ListRenderItemInfo<T> & { tileSize: number }) => ReactElement | null;
  minimumTileWidth?: number;
  gap?: number;
  minColumns?: number;
  maxColumns?: number;
  ListEmptyComponent?: ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

export function ResponsiveTileGrid<T>({
  data,
  keyExtractor,
  renderItem,
  minimumTileWidth,
  gap,
  minColumns = 2,
  maxColumns = 4,
  ListEmptyComponent,
  contentContainerStyle,
  style,
}: ResponsiveTileGridProps<T>) {
  const { theme } = useAppTheme();
  const resolvedMinimumTileWidth =
    minimumTileWidth ?? theme.layout.tileMinWidth;
  const resolvedGap = gap ?? theme.layout.tileGap;
  const [availableWidth, setAvailableWidth] = useState(0);

  const columnCount = useMemo(
    () =>
      calculateResponsiveColumnCount(
        availableWidth,
        resolvedMinimumTileWidth,
        resolvedGap,
        minColumns,
        maxColumns,
      ),
    [
      availableWidth,
      maxColumns,
      minColumns,
      resolvedGap,
      resolvedMinimumTileWidth,
    ],
  );

  const tileSize = useMemo(() => {
    if (availableWidth <= 0) {
      return resolvedMinimumTileWidth;
    }

    return calculateResponsiveTileSize(availableWidth, columnCount, resolvedGap);
  }, [availableWidth, columnCount, resolvedGap, resolvedMinimumTileWidth]);

  return (
    <View
      onLayout={(event) => {
        const nextWidth = Math.floor(event.nativeEvent.layout.width);
        if (nextWidth !== availableWidth) {
          setAvailableWidth(nextWidth);
        }
      }}
      style={[styles.container, style]}
    >
      {availableWidth <= 0 ? null : (
      <FlatList
        key={`columns-${columnCount}`}
        columnWrapperStyle={columnCount > 1 ? { gap: resolvedGap } : undefined}
        contentContainerStyle={[
          styles.content,
          { gap: resolvedGap },
          contentContainerStyle,
        ]}
        data={data as T[]}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmptyComponent}
        numColumns={columnCount}
        renderItem={(info) =>
          renderItem({
            ...info,
            tileSize,
          })
        }
        scrollEnabled={data.length > 0}
        showsVerticalScrollIndicator={false}
      />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  content: {
    paddingBottom: 4,
  },
});
