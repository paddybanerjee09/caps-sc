export function calculateResponsiveColumnCount(
  availableWidth: number,
  minimumTileWidth: number,
  gap: number,
  minColumns = 2,
  maxColumns = 4,
): number {
  if (availableWidth <= 0 || minimumTileWidth <= 0) {
    return minColumns;
  }

  const columns = Math.floor(
    (availableWidth + gap) / (minimumTileWidth + gap),
  );
  return Math.min(maxColumns, Math.max(minColumns, columns));
}

export function calculateResponsiveTileSize(
  availableWidth: number,
  columnCount: number,
  gap: number,
): number {
  if (columnCount <= 0) {
    return 0;
  }

  const totalGap = gap * (columnCount - 1);
  return Math.floor((availableWidth - totalGap) / columnCount);
}
