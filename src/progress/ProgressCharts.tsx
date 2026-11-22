import { useMemo, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { PressOpacity } from "../components/PressOpacity";
import { useAppTheme } from "../theme/ThemeContext";

import { contiguousRuns, type ChartPeriod, type ChartPoint } from "./chartAggregation";

export type PlotSeries = { id: string; label: string; unit: string; color: string; points: ChartPoint[] };
export type Subgraph = { id: string; title: string; unit: string; range?: readonly [number, number]; series: PlotSeries[] };


export function ToggleableChartLegend({ series, hidden, onToggle }: { series: PlotSeries[]; hidden: ReadonlySet<string>; onToggle: (id: string) => void }) {
  const { theme } = useAppTheme();
  return <View style={styles.legend}>{series.map((item) => <PressOpacity key={item.id} accessibilityLabel={`${item.label}, ${hidden.has(item.id) ? "hidden" : "visible"}`} accessibilityRole="button" accessibilityState={{ selected: !hidden.has(item.id) }} onPress={() => onToggle(item.id)} style={[styles.legendItem, { borderColor: hidden.has(item.id) ? theme.colors.border : item.color, backgroundColor: theme.colors.surfaceMuted }]}>
    <View style={[styles.swatch, { backgroundColor: hidden.has(item.id) ? theme.colors.textMuted : item.color }]} /><Text style={[styles.legendText, { color: hidden.has(item.id) ? theme.colors.textMuted : theme.colors.text }]}>{item.label}</Text>
  </PressOpacity>)}</View>;
}

export function MetricTooltip({ date, series, index }: { date: string; series: PlotSeries[]; index: number }) {
  const { theme } = useAppTheme();
  return <View accessibilityLiveRegion="polite" style={[styles.tooltip, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
    <Text style={[styles.tooltipDate, { color: theme.colors.text }]}>{date}</Text>
    {series.map((item) => {
      const point = item.points[index];
      const observations = point?.observations ?? [];
      const latest = observations[observations.length - 1];
      const versions = [...new Set(observations.map((o) => o.version).filter(Boolean))];
      const detail = [...new Set(observations.map((o) => o.detail).filter(Boolean))];
      return <View key={item.id} style={styles.tooltipMetric}>
        <Text style={[styles.number, { color: theme.colors.text }]}>{item.label}: {point?.value == null ? "—" : `${Number(point.value.toFixed(2))} ${item.unit}`}</Text>
        <Text style={[styles.caption, { color: theme.colors.textMuted }]}>{point?.aggregationMethod ?? "No observation"} · {point?.sampleCount ?? 0}/{point?.eligibleDayCount ?? 0} eligible days · {Math.round(point?.coveragePercent ?? 0)}% coverage</Text>
        {latest ? <Text style={[styles.caption, { color: theme.colors.textMuted }]}>{latest.source}{versions.length ? ` · ${versions.join(", ")}` : ""}{latest.measuredAt ? ` · ${observations.length > 1 ? "latest " : ""}${new Date(latest.measuredAt).toLocaleString()}` : ""}</Text> : null}
        {detail.length ? <Text style={[styles.caption, { color: theme.colors.textMuted }]}>{detail.length <= 2 ? detail.join("; ") : `${detail.length} observation details; ${detail[detail.length - 1]}`}</Text> : null}
      </View>;
    })}
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
    {!values.length ? <Text style={[styles.empty, { color: theme.colors.textMuted }]}>{series.length ? "No eligible observations in this period" : "All variables hidden"}</Text> : null}
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
      <Text accessibilityRole="header" style={[styles.heading, { color: theme.colors.textMuted }]}>{graph.title.toUpperCase()} · {graph.unit}</Text>
      <ToggleableChartLegend series={graph.series} hidden={hidden} onToggle={onToggle} />
      <TimeSeriesLineChart period={period} series={visible} range={graph.range} unit={graph.unit} selectedIndex={cursor} onSelect={onSelect} />
      <MetricTooltip date={period.buckets[cursor]?.key ?? "—"} series={visible} index={cursor} />
    </View>; })}
  </View>;
}
const styles = StyleSheet.create({
  group: { gap: 12 }, card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 12 }, heading: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, legendItem: { minHeight: 48, minWidth: 48, borderRadius: 10, borderWidth: 1, padding: 8, flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" },
  swatch: { width: 8, height: 8, borderRadius: 4 }, legendText: { fontSize: 11, fontWeight: "700", flexShrink: 1 }, tooltip: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 8 }, tooltipDate: { fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] }, tooltipMetric: { gap: 3 },
  number: { fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] }, caption: { fontSize: 11, lineHeight: 16, fontVariant: ["tabular-nums"] }, empty: { fontSize: 12, textAlign: "center" }, cursorBar: { flexDirection: "row", alignItems: "center", gap: 8 }, cursorDate: { flex: 1, textAlign: "center", fontSize: 13, fontVariant: ["tabular-nums"] }, dateButton: { width: 48, minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 10 },
});



