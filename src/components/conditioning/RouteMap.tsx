import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import { useAppTheme } from "../../theme/ThemeContext";

type RoutePoint = {
  latitude: number;
  longitude: number;
  segmentId: string | null;
};

export function RouteMap({ points }: { points: RoutePoint[] }) {
  const { theme } = useAppTheme();
  const accepted = points.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  if (accepted.length === 0) {
    return <Text style={{ color: theme.colors.textMuted }}>No route was recorded.</Text>;
  }

  const segments = new Map<string, RoutePoint[]>();
  for (const point of accepted) {
    const key = point.segmentId ?? "segment";
    const current = segments.get(key) ?? [];
    current.push(point);
    segments.set(key, current);
  }
  const start = accepted[0];
  const finish = accepted[accepted.length - 1];
  const latitudes = accepted.map((point) => point.latitude);
  const longitudes = accepted.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return (
    <View style={styles.frame}>
      <MapView
        initialRegion={{
          latitude: (minLatitude + maxLatitude) / 2,
          latitudeDelta: Math.max(0.01, (maxLatitude - minLatitude) * 1.4),
          longitude: (minLongitude + maxLongitude) / 2,
          longitudeDelta: Math.max(0.01, (maxLongitude - minLongitude) * 1.4),
        }}
        style={styles.map}
      >
        {[...segments.entries()].map(([key, segment]) =>
          segment.length > 1 ? (
            <Polyline key={key} coordinates={segment} strokeColor={theme.colors.tertiary} strokeWidth={4} />
          ) : null,
        )}
        {start ? <Marker coordinate={start} title="Start" /> : null}
        {finish && accepted.length > 1 ? <Marker coordinate={finish} title="Finish" /> : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 12, height: 220, overflow: "hidden" },
  map: { flex: 1 },
});
