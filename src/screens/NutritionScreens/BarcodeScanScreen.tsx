import Ionicons from "@expo/vector-icons/Ionicons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { NutritionPage, NutritionTextInput } from "../../components/nutrition/NutritionChrome";
import { PressOpacity } from "../../components/PressOpacity";
import { normalizeBarcode } from "../../nutrition/calculations";
import { NUTRITION_TRANSITION } from "../../nutrition/motion";
import { lookupOpenFoodFactsBarcode } from "../../services/openFoodFactsApi";
import { providerErrorMessage, ProviderError } from "../../services/providerError";
import { useNutritionWorkspace } from "../../state/NutritionWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor, themes } from "../../theme/theme";

const tokens = themes.dark;
const PRODUCT_BARCODES = ["ean13", "ean8", "upc_a", "upc_e", "itf14"] as const;

type ScanStatus =
  | { kind: "ready" }
  | { kind: "loading" }
  | { kind: "not-found"; barcode: string }
  | { kind: "error"; message: string };

export function BarcodeScanScreen({ active }: { active: boolean }) {
  const { theme } = useAppTheme();
  const { pop, push, scanner, setFacts, startCustomFood, updateScanner } =
    useNutritionWorkspace();
  const [permission, requestPermission] = useCameraPermissions();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [torch, setTorch] = useState(false);
  const cameraVisible = active && foreground;

  if (!cameraVisible && torch) {
    setTorch(false);
  }
  const [status, setStatus] = useState<ScanStatus>({ kind: "ready" });
  const latched = useRef(false);
  const requestId = useRef(0);
  const panel = useSharedValue(scanner.manualEntryOpen ? 1 : 0);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    panel.set(withTiming(scanner.manualEntryOpen ? 1 : 0, NUTRITION_TRANSITION));
  }, [panel, scanner.manualEntryOpen]);

  useEffect(() => {
    if (!active || !foreground) {
      requestId.current += 1;
    }
  }, [active, foreground]);

  const panelStyle = useAnimatedStyle(() => ({
    maxHeight: panel.get() * 180,
    opacity: panel.get(),
  }));
  const showCamera =
    cameraVisible && permission?.granted === true && status.kind !== "not-found";

  async function lookup(raw: string) {
    const barcode = normalizeBarcode(raw);

    if (!barcode) {
      setStatus({ kind: "error", message: "Enter a valid barcode." });
      latched.current = false;
      return;
    }

    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setStatus({ kind: "loading" });

    try {
      const food = await lookupOpenFoodFactsBarcode(barcode);

      if (requestId.current !== currentRequest) {
        return;
      }

      setFacts({
        amountInput: "1",
        calorieInput: "",
        draftItemId: null,
        food: food.ref,
        inputMode: "amount",
        servingId: food.defaultServingId,
        snapshot: food,
      });
      push({ screen: "facts" });
      setStatus({ kind: "ready" });
      latched.current = false;
    } catch (error) {
      if (requestId.current !== currentRequest) {
        return;
      }

      latched.current = false;

      if (error instanceof ProviderError && error.code === "not-found") {
        setStatus({ kind: "not-found", barcode });
        return;
      }

      setStatus({
        kind: "error",
        message: providerErrorMessage(error, "Couldn't look up that barcode."),
      });
    }
  }

  function onBarcodeScanned(result: { data: string; raw?: string }) {
    if (!showCamera || latched.current || status.kind === "loading") {
      return;
    }

    const candidate = result.raw && normalizeBarcode(result.raw) ? result.raw : result.data;
    const barcode = normalizeBarcode(candidate);

    if (!barcode) {
      return;
    }

    latched.current = true;
    void lookup(barcode);
  }

  function lookUpTypedBarcode() {
    latched.current = true;
    void lookup(scanner.typedBarcode);
  }

  return (
    <NutritionPage
      footer={
        <View style={[styles.bar, { borderTopColor: theme.colors.border }]}>
          <PressOpacity
            accessibilityLabel={torch ? "Turn torch off" : "Turn torch on"}
            onPress={() => setTorch((current) => !current)}
            style={styles.barButton}
          >
            <Ionicons
              color={theme.colors.text}
              name={torch ? "flashlight" : "flashlight-outline"}
              size={22}
            />
          </PressOpacity>
          <PressOpacity
            accessibilityLabel={scanner.manualEntryOpen ? "Hide barcode entry" : "Type barcode"}
            onPress={() =>
              updateScanner((current) => ({
                ...current,
                manualEntryOpen: !current.manualEntryOpen,
              }))
            }
            style={styles.typeButton}
          >
            <Ionicons
              color={theme.colors.text}
              name={scanner.manualEntryOpen ? "chevron-down" : "barcode-outline"}
              size={22}
            />
            <Text style={{ color: theme.colors.text }}>
              {scanner.manualEntryOpen ? "Hide Barcode Entry" : "Type Barcode"}
            </Text>
          </PressOpacity>
        </View>
      }
      onClose={() => {
        requestId.current += 1;
        setTorch(false);
        pop();
      }}
      scroll={false}
      title="Scan Barcode"
    >
      <View style={styles.body}>
        {permission && !permission.granted ? (
          <View style={styles.message}>
            <Text style={[styles.messageText, { color: theme.colors.text }]}>
              {permission.canAskAgain
                ? "Camera access is needed to scan a barcode."
                : "Camera access is off. Enable it in Settings to scan barcodes."}
            </Text>
            <PressOpacity
              accessibilityLabel={permission.canAskAgain ? "Allow camera" : "Open settings"}
              onPress={() => {
                if (permission.canAskAgain) {
                  void requestPermission();
                } else {
                  void Linking.openSettings();
                }
              }}
              style={styles.action}
            >
              <Text style={{ color: theme.colors.tertiary }}>
                {permission.canAskAgain ? "Allow camera" : "Open Settings"}
              </Text>
            </PressOpacity>
          </View>
        ) : null}
        {showCamera ? (
          <CameraView
            barcodeScannerSettings={{ barcodeTypes: [...PRODUCT_BARCODES] }}
            enableTorch={torch && showCamera}
            facing="back"
            onBarcodeScanned={onBarcodeScanned}
            style={styles.camera}
          />
        ) : null}
        {status.kind === "loading" ? (
          <Text style={[styles.messageText, { color: theme.colors.text }]}>Looking up barcode…</Text>
        ) : null}
        {status.kind === "error" ? (
          <View style={styles.message}>
            <Text style={[styles.messageText, { color: theme.colors.text }]}>{status.message}</Text>
            <PressOpacity
              accessibilityLabel="Retry scan"
              onPress={() => {
                latched.current = false;
                setStatus({ kind: "ready" });
              }}
              style={styles.action}
            >
              <Text style={{ color: theme.colors.tertiary }}>Retry Scan</Text>
            </PressOpacity>
          </View>
        ) : null}
        {status.kind === "not-found" ? (
          <View style={styles.message}>
            <Text style={[styles.messageText, { color: theme.colors.text }]}>
              No Open Food Facts product was found for {status.barcode}.
            </Text>
            <PressOpacity
              accessibilityLabel="Retry scan"
              onPress={() => {
                latched.current = false;
                setStatus({ kind: "ready" });
              }}
              style={styles.action}
            >
              <Text style={{ color: theme.colors.tertiary }}>Retry Scan</Text>
            </PressOpacity>
            <PressOpacity
              accessibilityLabel="Type barcode"
              onPress={() => updateScanner((current) => ({ ...current, manualEntryOpen: true }))}
              style={styles.action}
            >
              <Text style={{ color: theme.colors.text }}>Type Barcode</Text>
            </PressOpacity>
            <PressOpacity
              accessibilityLabel="Create custom food"
              onPress={() => startCustomFood(status.barcode)}
              style={styles.action}
            >
              <Text style={{ color: theme.colors.tertiary }}>Create Custom Food</Text>
            </PressOpacity>
          </View>
        ) : null}
        <Animated.View style={[styles.manual, panelStyle]}>
          <View style={styles.manualRow}>
            <NutritionTextInput
              accessibilityLabel="Barcode number"
              keyboardType="number-pad"
              onChangeText={(typedBarcode) =>
                updateScanner((current) => ({ ...current, typedBarcode }))
              }
              onSubmitEditing={lookUpTypedBarcode}
              placeholder="Enter barcode"
              returnKeyType="search"
              style={styles.input}
              value={scanner.typedBarcode}
            />
            <PressOpacity
              accessibilityLabel="Look up barcode"
              disabled={!scanner.typedBarcode.trim() || status.kind === "loading"}
              onPress={lookUpTypedBarcode}
              style={[styles.lookUp, { backgroundColor: theme.colors.tertiary }]}
            >
              <Text
                style={[styles.lookUpLabel, { color: readableTextColor(theme.colors.tertiary) }]}
              >
                Look Up
              </Text>
            </PressOpacity>
          </View>
        </Animated.View>
      </View>
    </NutritionPage>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  message: {
    alignItems: "center",
    flex: 1,
    gap: tokens.spacing.sm,
    justifyContent: "center",
    padding: tokens.spacing.lg,
  },
  messageText: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: "center",
  },
  action: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
  },
  manual: {
    overflow: "hidden",
    paddingHorizontal: tokens.spacing.lg,
  },
  manualRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.md,
  },
  input: {
    flex: 1,
    minHeight: 48,
  },
  lookUp: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.lg,
  },
  lookUpLabel: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
  },
  bar: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 64,
    paddingHorizontal: tokens.spacing.lg,
  },
  barButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  typeButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    minHeight: 44,
  },
});
