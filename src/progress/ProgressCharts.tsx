import { useMemo, useState } from "react";
import { PanResponder, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { PressOpacity } from "../components/PressOpacity";
import { useAppTheme } from "../theme/ThemeContext";
import { formatDisplayDate, formatDisplayMonth, formatDisplayYear } from "../utils/displayDate";
import { chartAxis, chartXTicks, contiguousRuns, type ChartPeriod, type ChartPoint } from "./chartAggregation";

export type PlotSeries = { id: string; label: string; unit: string; color: string; points: ChartPoint[] };
export type Subgraph = { id: string; title: string; unit: string; range?: readonly [number, number]; zeroBased?: boolean; minimumMax?: number; series: PlotSeries[] };

function seriesLabel(item: PlotSeries) {
  return item.label.replace(/ · (?:sri_v\d+|caps_ori_v\d+)/g, "").replace(/ · (?:unavailable|no comparable test|building baseline|min \d+ days)/g, "");
}
function selectedDate(period: ChartPeriod, index: number) {
  const key = period.buckets[index]?.key;
  if (!key) return "--";
  return period.resolution === "day" ? formatDisplayDate(key) : period.resolution === "month" ? formatDisplayMonth(key) : formatDisplayYear(key);
}

/** The values double as the legend; hidden lines retain their value and a way to re-enable them. */
export function MetricTooltip({ date, series, index, hidden, onToggle }: { date: string; series: PlotSeries[]; index: number; hidden: ReadonlySet<string>; onToggle: (id: string) => void }) {
  const { theme } = useAppTheme();
  if (!series.length) return null;
  return <View style={[styles.tooltip, { borderTopColor: theme.colors.border }]}>
    <Text accessibilityLiveRegion="polite" style={[styles.date, { color: theme.colors.textMuted }]}>{date}</Text>
    {series.map(item => {
      const point = item.points[index];
      const value = point?.value == null ? "--" : `${Number(point.value.toFixed(2))}${point.lowerBound ? "+" : ""} ${item.unit}`;
      const visible = !hidden.has(item.id);
      return <PressOpacity key={item.id} accessibilityLabel={`${date}, ${seriesLabel(item)}: ${value}. ${visible ? "Hide" : "Show"} line`} accessibilityState={{ selected: visible }} onPress={() => onToggle(item.id)} style={styles.tooltipMetric}>
        <View style={[styles.swatch, { backgroundColor: visible ? item.color : theme.colors.textMuted }]} />
        <Text style={[styles.tooltipLabel, { color: visible ? theme.colors.text : theme.colors.textMuted }]}>{seriesLabel(item)}</Text>
        <Text style={[styles.number, { color: visible ? theme.colors.text : theme.colors.textMuted }]}>{value}</Text>
      </PressOpacity>;
    })}
  </View>;
}

export function TimeSeriesLineChart({ period, series, range, zeroBased, minimumMax, selectedIndex, onSelect, unit }: { period: ChartPeriod; series: PlotSeries[]; range?: readonly [number, number]; zeroBased?: boolean; minimumMax?: number; selectedIndex: number; onSelect: (index: number) => void; unit: string }) {
  const { theme } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(300);
  const values = series.flatMap(item => item.points.flatMap(p => p.value === null ? [] : [p.value]));
  const axis = chartAxis(values, range, zeroBased, minimumMax);
  const left = Math.max(44, Math.ceil(Math.max(...axis.ticks.map(value => String(Number(value.toFixed(1))).length)) * 10 * fontScale * 0.65) + 12), right = Math.max(left + 1, width - 14), top = 16;
  const bottom = top + Math.max(156, (axis.ticks.length - 1) * Math.ceil(14 * fontScale));
  const height = bottom + 32;
  const count = period.buckets.length;
  const x = (index: number) => count <= 1 ? (left + right) / 2 : left + index / (count - 1) * (right - left);
  const y = (value: number) => bottom - (value - axis.low) / (axis.high - axis.low || 1) * (bottom - top);
  const selectX = (position: number) => onSelect(Math.max(0, Math.min(count - 1, Math.round((position - left) / (right - left) * (count - 1)))));
  const responder = useMemo(() => PanResponder.create({ onStartShouldSetPanResponder: () => false, onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 5 && Math.abs(gesture.dx) > Math.abs(gesture.dy), onPanResponderGrant: event => selectX(event.nativeEvent.locationX), onPanResponderMove: event => selectX(event.nativeEvent.locationX) }), [left, right, count, onSelect]); // eslint-disable-line react-hooks/exhaustive-deps
  const tickLayout = chartXTicks(period.buckets.map(bucket => bucket.label), right - left, period.resolution === "month" && count === 12 ? 12 : Math.min(count, 7), fontScale);
  if (!values.length) return <View style={styles.emptyChart}><Text style={[styles.empty, { color: theme.colors.textMuted }]}>{series.length ? "No data" : "All hidden"}</Text></View>;
  return <View onLayout={event => setWidth(Math.max(100, event.nativeEvent.layout.width))}>
    <View {...responder.panHandlers} onTouchEnd={event => selectX(event.nativeEvent.locationX)} accessible accessibilityLabel={`${unit} chart. Slide to choose a date.`} accessibilityRole="adjustable" accessibilityValue={{ min: 0, max: count - 1, now: selectedIndex, text: selectedDate(period, selectedIndex) }} accessibilityActions={[{ name: "increment", label: "Next date" }, { name: "decrement", label: "Previous date" }]} onAccessibilityAction={event => onSelect(Math.max(0, Math.min(count - 1, selectedIndex + (event.nativeEvent.actionName === "increment" ? 1 : -1))))}>
      <Svg width={width} height={height} accessible={false} pointerEvents="none">
        {axis.ticks.map(value => <ViewlessGrid key={value} value={value} y={y(value)} left={left} right={right} fontSize={10 * fontScale} color={theme.colors.border} textColor={theme.colors.textMuted} />)}
        {tickLayout.indices.map(index => <SvgText key={index} x={x(index)} y={bottom + 23} fill={theme.colors.textMuted} fontSize={tickLayout.fontSize * fontScale} textAnchor={index === 0 ? "start" : index === count - 1 ? "end" : "middle"}>{period.buckets[index].label}</SvgText>)}
        {series.map(item => <Plot key={item.id} item={item} x={x} y={y} />)}
        <Line x1={x(selectedIndex)} x2={x(selectedIndex)} y1={top} y2={bottom} stroke={theme.colors.textMuted} strokeDasharray="3 4" />
        {series.map(item => item.points[selectedIndex]?.value != null ? <Circle key={item.id} cx={x(selectedIndex)} cy={y(item.points[selectedIndex].value!)} r={4} fill={item.color} /> : null)}
      </Svg>
    </View>
  </View>;
}
function ViewlessGrid({ value, y, left, right, fontSize, color, textColor }: { value: number; y: number; left: number; right: number; fontSize: number; color: string; textColor: string }) {
  return <><Line x1={left} x2={right} y1={y} y2={y} stroke={color} /><SvgText x={left - 6} y={y + 4} fill={textColor} fontSize={fontSize} textAnchor="end">{Number(value.toFixed(1))}</SvgText></>;
}
function Plot({ item, x, y }: { item: PlotSeries; x: (i: number) => number; y: (value: number) => number }) {
  return <>{contiguousRuns(item.points).map((run, index) => <Path key={index} d={run.map((i, j) => `${j ? "L" : "M"}${x(i)},${y(item.points[i].value!)}`).join(" ")} stroke={item.color} strokeWidth={2} fill="none" />)}{item.points.map((point, index) => point.value == null ? null : <Circle key={index} cx={x(index)} cy={y(point.value)} r={2} fill={item.color} />)}</>;
}

export function SynchronizedSubgraphGroup({ graphs, period, hidden, onToggle, cursor, onSelect }: { graphs: Subgraph[]; period: ChartPeriod; hidden: ReadonlySet<string>; onToggle: (id: string) => void; cursor: number; onSelect: (index: number) => void }) {
  const { theme } = useAppTheme();
  return <View style={styles.group}>
    {graphs.map(graph => { const visible = graph.series.filter(item => !hidden.has(item.id)); return <View key={graph.id} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
      <Text accessibilityRole="header" style={[styles.heading, { color: theme.colors.textMuted }]}>{graph.title.toUpperCase()} · {graph.unit}{period.resolution !== "day" ? " · MEAN" : ""}</Text>
      <TimeSeriesLineChart period={period} series={visible} range={graph.range} zeroBased={graph.zeroBased} minimumMax={graph.minimumMax} unit={graph.unit} selectedIndex={cursor} onSelect={onSelect} />
      <MetricTooltip date={selectedDate(period, cursor)} series={graph.series} hidden={hidden} onToggle={onToggle} index={cursor} />
    </View>; })}
  </View>;
}
const styles = StyleSheet.create({
  group: { gap: 8 }, card: { borderRadius: 12, borderWidth: 1, padding: 10, gap: 6 }, heading: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  swatch: { width: 8, height: 8, borderRadius: 4 }, tooltip: { borderTopWidth: 1, paddingTop: 4 }, date: { fontSize: 11, fontVariant: ["tabular-nums"], paddingBottom: 2 },
  tooltipMetric: { minHeight: 48, minWidth: 48, flexDirection: "row", alignItems: "center", gap: 8 }, tooltipLabel: { flex: 1, fontSize: 12 }, number: { fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  emptyChart: { minHeight: 40, justifyContent: "center" }, empty: { fontSize: 12, textAlign: "center" },
});
