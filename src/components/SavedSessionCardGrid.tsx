import { useMemo, useState, type ReactElement } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";

const MAX_VISIBLE_ROWS = 3;
const MAX_VISIBLE_CARDS = 9;
const CARD_ASPECT_RATIO = 4 / 3;
const GAP = 8;

export type SavedSessionCardSize = {
  height: number;
  width: number;
};

type SavedSessionCardGridProps<T> = {
  data: readonly T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, size: SavedSessionCardSize) => ReactElement;
};

export function SavedSessionCardGrid<T>({
  data,
  keyExtractor,
  renderItem,
}: SavedSessionCardGridProps<T>) {
  const [availableWidth, setAvailableWidth] = useState(0);
  const columns = getColumnCount(data.length);
  const cardSize = useMemo(() => {
    const width = Math.max(0, (availableWidth - GAP * (columns - 1)) / columns);
    return { height: width / CARD_ASPECT_RATIO, width };
  }, [availableWidth, columns]);
  const needsScroll = data.length > MAX_VISIBLE_CARDS;
  const maxHeight = cardSize.height * MAX_VISIBLE_ROWS + GAP * (MAX_VISIBLE_ROWS - 1);

  function updateAvailableWidth(event: LayoutChangeEvent) {
    const nextWidth = Math.floor(event.nativeEvent.layout.width);
    if (nextWidth !== availableWidth) {
      setAvailableWidth(nextWidth);
    }
  }

  const cards = availableWidth > 0 ? (
    <View style={styles.cards}>
      {data.map((item) => (
        <View key={keyExtractor(item)} style={cardSize}>
          {renderItem(item, cardSize)}
        </View>
      ))}
    </View>
  ) : null;

  return (
    <View onLayout={updateAvailableWidth} style={styles.container}>
      {needsScroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          style={{ height: maxHeight }}
        >
          {cards}
        </ScrollView>
      ) : (
        cards
      )}
    </View>
  );
}

function getColumnCount(itemCount: number) {
  if (itemCount <= 1) return 1;
  if (itemCount === 2) return 2;
  return 3;
}

const styles = StyleSheet.create({
  container: { width: "100%" },
  cards: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  scrollContent: { paddingRight: 2 },
});
