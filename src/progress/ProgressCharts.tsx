import { useMemo, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { PressOpacity } from "../components/PressOpacity";
import { useAppTheme } from "../theme/ThemeContext";

import { contiguousRuns, type ChartPeriod, type ChartPoint } from "./chartAggregation";

export type PlotSeries = { id: string; label: string; unit: string; color: string; points: ChartPoint[] };
export type Subgraph = { id: string; title: string; unit: string; range?: readonly [number, number]; series: PlotSeries[] };

function seriesLabel(item: PlotSeries) {
  return item.label
    .replace(/ · (?:sri_v\d+|caps_ori_v\d+)/g, "")
    .replace(/ · (?:unavailable|no comparable test|building baseline|min \d+ days)/g, "");
}


export function ToggleableChartLegend({ series, hidden, onToggle }: { series: PlotSeries[]; hidden: ReadonlySet<string>; onToggle: (id: string) => void }) {
  const { theme } = useAppTheme();
  return <View style={styles.legend}>{series.map((item) => <PressOpacity key={item.id} accessibilityLabel={`${seriesLabel(item)}, ${hidden.has(item.id) ? "hidden" : "visible"}`} accessibilityRole="button" accessibilityState={{ selected: !hidden.has(item.id) }} onPress={() => onToggle(item.id)} style={[styles.legendItem, { borderColor: hidden.has(item.id) ? theme.colors.border : item.color, backgroundColor: theme.colors.surfaceMuted }]}>
    <View style={[styles.swatch, { backgroundColor: hidden.has(item.id) ? theme.colors.textMuted : item.color }]} /><Text style={[styles.legendText, { color: hidden.has(item.id) ? theme.colors.textMuted : theme.colors.text }]}>{seriesLabel(item)}</Text>
  </PressOpacity>)}</View>;
}

export function MetricTooltip({ date, series, index }: { date: string; series: PlotSeries[]; index: number }) {
  const { theme } = useAppTheme();
  if (!series.length) return null;
  return <View accessibilityLiveRegion="polite" style={[styles.tooltip, { borderTopColor: theme.colors.border }]}>
    {series.map(item => <View key={item.id} style={styles.tooltipMetric}>
      <View style={[styles.swatch, { backgroundColor: item.color }]} />
      <Text style={[styles.tooltipLabel, { color: theme.colors.text }]}>{seriesLabel(item)}</Text>
      <Text selectable accessibilityLabel={`${date}, ${seriesLabel(item)}: ${item.points[index]?.value == null ? "No data" : `${Number(item.points[index].value!.toFixed(2))} ${item.unit}`}`} style={[styles.number, { color: theme.colors.text }]}>{item.points[index]?.value == null ? "--" : `${Number(item.points[index].value!.toFixed(2))} ${item.unit}`}</Text>
    </View>)}
  </View>;
}

export function TimeSeriesLineChart({ period, series, range, selectedIndex, onSelect, unit }: { period: ChartPeriod; series: PlotSeries[]; range?: readonly [number, number]; selectedIndex: number; onSelect: (index: number) => void; unit: string }) {
  const { theme } = useAppTheme();
  const [width, setWidth] = useState(300);
  const left = 44, right = Math.max(left + 1, width - 14), top = 18, bottom = 144, height = 178;
  const values = series.flatMap((item) => item.points.flatMap((p) => p.value === null ? [] : [p.value]));
  const min = range?.[0] ?? (values.length ? Math.min(...values) : 0);
  const max = range?.[1] ?? (values.length ? Math.max(...values) : 1);
  const padding = range ? 0 : Math.max((max - min) * 0.12, Math.abs(max) * 0.02, 0.5);
  const low = min - padding, high = max + padding;
  const count = period.buckets.length;
  const x = (index: number) => count <= 1 ? (left + right) / 2 : left + index / (count - 1) * (right - left);
  const y = (value: number) => bottom - (value - low) / (high - low || 1) * (bottom - top);
  const selectX = (position: number) => onSelect(Math.max(0, Math.min(count - 1, Math.round((position - left) / (right - left) * (count - 1)))));
  const responder = useMemo(() => PanResponder.create({ onStartShouldSetPanResponder: () => false, onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 5 && Math.abs(gesture.dx) > Math.abs(gesture.dy), onPanResponderGrant: (event) => selectX(event.nativeEvent.locationX), onPanResponderMove: (event) => selectX(event.nativeEvent.locationX) }), [width, count, onSelect]); // eslint-disable-line react-hooks/exhaustive-deps
  const tickCount = period.resolution === "month" && count === 12 ? 12 : Math.min(count, 7);
  const ticks = [...new Set(Array.from({ length: tickCount }, (_, index) => Math.round(index / (tickCount - 1 || 1) * (count - 1))))];
  if (!values.length) return <View style={styles.emptyChart}><Text style={[styles.empty, { color: theme.colors.textMuted }]}>{series.length ? "No data" : "All hidden"}</Text></View>;
  return <View onLayout={(event) => setWidth(Math.max(100, event.nativeEvent.layout.width))}>
    <View {...responder.panHandlers} onTouchEnd={(event) => selectX(event.nativeEvent.locationX)} accessible accessibilityLabel={`${unit} chart. Swipe horizontally or use previous and next date controls.`} accessibilityRole="adjustable" accessibilityValue={{ min: 0, max: count - 1, now: selectedIndex, text: period.buckets[selectedIndex]?.key }} accessibilityActions={[{ name: "increment", label: "Next date" }, { name: "decrement", label: "Previous date" }]} onAccessibilityAction={(event) => onSelect(Math.max(0, Math.min(count - 1, selectedIndex + (event.nativeEvent.actionName === "increment" ? 1 : -1))))}>
      <Svg width={width} height={height} accessible={false} pointerEvents="none">
        {[low, (low + high) / 2, high].map((value, index) => <ViewlessGrid key={index} value={value} y={y(value)} left={left} right={right} color={theme.colors.border} textColor={theme.colors.textMuted} />)}
        {ticks.map((index) => <SvgText key={index} x={x(index)} y={169} fill={theme.colors.textMuted} fontSize={10} textAnchor={index === 0 ? "start" : index === count - 1 ? "end" : "middle"}>{period.buckets[index].label}</SvgText>)}
        {series.map((item) => <Plot key={item.id} item={item} x={x} y={y} />)}
        <Line x1={x(selectedIndex)} x2={x(selectedIndex)} y1={top} y2={bottom} stroke={theme.colors.textMuted} strokeDasharray="3 4" />
        {series.map((item) => item.points[selectedIndex]?.value != null ? <Circle key={item.id} cx={x(selectedIndex)} cy={y(item.points[selectedIndex].value!)} r={4} fill={item.color} /> : null)}
      </Svg>
    </View>
  </View>;
}
function ViewlessGrid({ value, y, left, right, color, textColor }: { value: number; y: number; left: number; right: number; color: string; textColor: string }) {
  return <><Line x1={left} x2={right} y1={y} y2={y} stroke={color} /><SvgText x={left - 6} y={y + 4} fill={textColor} fontSize={10} textAnchor="end">{Number(value.toFixed(1))}</SvgText></>;
}
function Plot({ item, x, y }: { item: PlotSeries; x: (i: number) => number; y: (value: number) => number }) {
  return <>{contiguousRuns(item.points).map((run, index) => <Path key={index} d={run.map((i, j) => `${j ? "L" : "M"}${x(i)},${y(item.points[i].value!)}`).join(" ")} stroke={item.color} strokeWidth={2} fill="none" />)}{item.points.map((point, index) => point.value == null ? null : <Circle key={index} cx={x(index)} cy={y(point.value)} r={2} fill={item.color} />)}</>;
}

export function SynchronizedSubgraphGroup({ graphs, period, hidden, onToggle, cursor, onSelect }: { graphs: Subgraph[]; period: ChartPeriod; hidden: ReadonlySet<string>; onToggle: (id: string) => void; cursor: number; onSelect: (index: number) => void }) {
  const { theme } = useAppTheme();
  return <View style={styles.group}>
    <View style={styles.cursorBar}>
      <PressOpacity accessibilityLabel="Previous chart date" disabled={cursor <= 0} onPress={() => onSelect(cursor - 1)} style={[styles.dateButton, { borderColor: theme.colors.borderStrong }]}><Text style={{ color: theme.colors.text }}>‹</Text></PressOpacity>
      <Text style={[styles.cursorDate, { color: theme.colors.text }]}>{period.buckets[cursor]?.key}</Text>
      <PressOpacity accessibilityLabel="Next chart date" disabled={cursor >= period.buckets.length - 1} onPress={() => onSelect(cursor + 1)} style={[styles.dateButton, { borderColor: theme.colors.borderStrong }]}><Text style={{ color: theme.colors.text }}>›</Text></PressOpacity>
    </View>
    {graphs.map((graph) => { const visible = graph.series.filter((item) => !hidden.has(item.id)); return <View key={graph.id} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
      <Text accessibilityRole="header" style={[styles.heading, { color: theme.colors.textMuted }]}>{graph.title.toUpperCase()} · {graph.unit}{period.resolution !== "day" ? " · MEAN" : ""}</Text>
      <ToggleableChartLegend series={graph.series} hidden={hidden} onToggle={onToggle} />
      <TimeSeriesLineChart period={period} series={visible} range={graph.range} unit={graph.unit} selectedIndex={cursor} onSelect={onSelect} />
      <MetricTooltip date={period.buckets[cursor]?.key ?? "--"} series={visible} index={cursor} />
    </View>; })}
  </View>;
}
const styles = StyleSheet.create({
  group: { gap: 8 }, card: { borderRadius: 12, borderWidth: 1, padding: 10, gap: 6 }, heading: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: 8 }, legendItem: { minHeight: 48, minWidth: 48, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" },
  swatch: { width: 6, height: 6, borderRadius: 3 }, legendText: { fontSize: 11, fontWeight: "700", flexShrink: 1 },
  tooltip: { borderTopWidth: 1, paddingTop: 6, gap: 4 }, tooltipMetric: { flexDirection: "row", alignItems: "center", gap: 6 }, tooltipLabel: { flex: 1, fontSize: 12 },
  number: { fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] }, emptyChart: { minHeight: 40, justifyContent: "center" }, empty: { fontSize: 12, textAlign: "center" }, cursorBar: { flexDirection: "row", alignItems: "center" }, cursorDate: { flex: 1, textAlign: "center", fontSize: 12, fontVariant: ["tabular-nums"] }, dateButton: { width: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
});
