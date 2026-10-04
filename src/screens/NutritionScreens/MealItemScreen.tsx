import Ionicons from "@expo/vector-icons/Ionicons";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { FoodMacroLine, WorkflowHeader } from "../../components/nutrition/NutritionChrome";
import { SegmentedSelector } from "../../components/nutrition/SegmentedSelector";
import { PressOpacity } from "../../components/PressOpacity";
import {
  hasCompletedFoodUsage,
  listCustomFoods,
  listFavourites,
  listKnownFoods,
  getFoodUsage,
  type CustomFoodRecord,
  type FoodFavourite,
  type KnownFoodRow,
} from "../../data/nutritionCatalogRepository";
import {
  compareByUsage,
  foodIdentityKey,
  type UsageRank,
} from "../../nutrition/calculations";
import type { PickerTab, UsageSort } from "../../nutrition/drafts";
import { catalogFoodFromCustom, peekCatalogFood, rememberCatalogFood, resolveCatalogFood } from "../../services/foodCatalog";
import { searchFatSecretFoods } from "../../services/fatsecretApi";
import { ProviderError, providerErrorMessage } from "../../services/providerError";
import { useNutritionWorkspace } from "../../state/NutritionWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import type { CatalogFood, FoodSearchHit, NutrientSnapshot } from "../../types/nutrition";

const tokens = themes.dark;

type Row = {
  key: string;
  title: string;
  subtitle: string | null;
  nutrients: NutrientSnapshot | null;
  onPress: () => void;
};

export function MealItemScreen() {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const workspace = useNutritionWorkspace();
  const { picker, pop, push, registerBackHandler, setFacts, transientEpoch, updatePicker } =
    workspace;
  const [known, setKnown] = useState<KnownFoodRow[]>([]);
  const [customs, setCustoms] = useState<CustomFoodRecord[]>([]);
  const [favourites, setFavourites] = useState<FoodFavourite[]>([]);
  const [usage, setUsage] = useState<Map<string, UsageRank>>(new Map());
  const [hasUsage, setHasUsage] = useState(false);
  const [remote, setRemote] = useState<FoodSearchHit[]>([]);
  const [remoteQuery, setRemoteQuery] = useState("");
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [filterRequested, setFilterRequested] = useState(false);
  const [filterEpoch, setFilterEpoch] = useState(transientEpoch);
  const filterOpen = filterRequested && filterEpoch === transientEpoch;
  const [resolvedNames, setResolvedNames] = useState<Record<string, CatalogFood | null>>({});
  const [retryNonce, setRetryNonce] = useState(0);
  const listRef = useRef<FlatList<Row>>(null);
  const offsets = useRef(picker.scrollOffsets);
  const requestId = useRef(0);

  useEffect(() => {
    return () => {
      updatePicker((current) => ({
        ...current,
        scrollOffsets: offsets.current,
      }));
    };
  }, [updatePicker]);

  useEffect(() => {
    return registerBackHandler(() => {
      if (!filterOpen) {
        return false;
      }

      setFilterRequested(false);
      return true;
    });
  }, [filterOpen, registerBackHandler]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [knownFoods, customFoods, favouriteFoods, usageMap, usageExists] =
        await Promise.all([
          listKnownFoods(db),
          listCustomFoods(db),
          listFavourites(db),
          getFoodUsage(db),
          hasCompletedFoodUsage(db),
        ]);

      if (!cancelled) {
        setKnown(knownFoods);
        setCustoms(customFoods);
        setFavourites(favouriteFoods);
        setUsage(usageMap);
        setHasUsage(usageExists);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, workspace.dataRevision]);

  useEffect(() => {
    if (picker.tab !== "all") {
      return;
    }

    const query = picker.query.trim();

    if (!query) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      const currentRequest = requestId.current + 1;
      requestId.current = currentRequest;
      setRemoteLoading(true);
      setRemoteError(null);

      void searchFatSecretFoods(query, controller.signal)
        .then((hits) => {
          if (requestId.current !== currentRequest) {
            return;
          }

          setRemote(hits);
          setRemoteQuery(query);
        })
        .catch((error: unknown) => {
          if (
            requestId.current !== currentRequest ||
            (error instanceof Error && error.name === "AbortError")
          ) {
            return;
          }

          setRemoteError(
            providerErrorMessage(error, "Couldn't search foods. Please try again."),
          );
        })
        .finally(() => {
          if (requestId.current === currentRequest) {
            setRemoteLoading(false);
          }
        });
    }, 400);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [picker.query, picker.tab, retryNonce]);

  useEffect(() => {
    const refs = [
      ...known.filter((food) => food.storagePolicy === "reference"),
      ...favourites.map((favourite) => ({ food: favourite.food, storagePolicy: "reference" as const })),
    ].slice(0, 20);
    let cancelled = false;

    void (async () => {
      for (const entry of refs) {
        if (cancelled) {
          return;
        }

        const key = foodIdentityKey(entry.food);
        const cached = peekCatalogFood(entry.food);

        if (cached) {
          setResolvedNames((current) => ({ ...current, [key]: cached }));
          continue;
        }

        try {
          const food = await resolveCatalogFood(db, entry.food);

          if (!cancelled) {
            setResolvedNames((current) => ({ ...current, [key]: food }));
          }
        } catch (error) {
          if (!cancelled && !(error instanceof ProviderError && error.code === "timeout")) {
            setResolvedNames((current) => ({ ...current, [key]: null }));
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, favourites, known]);

  const sortLabel = effectiveSortLabel(picker.tab, picker.query, picker.sort, hasUsage);
  const openFood = useCallback((food: CatalogFood, amount = "1", servingId?: string) => {
    if (food.storagePolicy === "snapshot") {
      rememberCatalogFood(food);
    }

    setFacts({
      amountInput: amount,
      calorieInput: "",
      draftItemId: null,
      food: food.ref,
      inputMode: "amount",
      servingId: servingId ?? (food.defaultServingId || null),
      snapshot: food.storagePolicy === "snapshot" ? food : null,
    });
    push({ screen: "facts" });
  }, [push, setFacts]);

  const rows = useMemo(
    () =>
      buildRows({
        customs,
        favourites,
        hasUsage,
        known,
        onOpen: openFood,
        picker,
        remote: remoteQuery === picker.query.trim() ? remote : [],
        resolvedNames,
        usage,
      }),
    [customs, favourites, hasUsage, known, openFood, picker, remote, remoteQuery, resolvedNames, usage],
  );

  const emptyMessage =
    picker.tab === "all" && !picker.query.trim()
      ? "Search for a food"
      : picker.tab === "custom"
        ? "Create a custom food to use it here."
        : remoteError ?? "No foods found.";

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <WorkflowHeader
        center={
          <TextInput
            accessibilityLabel="Search foods"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(query) => updatePicker((current) => ({ ...current, query }))}
            placeholder="Search…"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.search, { color: theme.colors.text }]}
            value={picker.query}
          />
        }
        onClose={pop}
        right={
          <PressOpacity
            accessibilityLabel="Scan barcode"
            onPress={() => push({ screen: "barcode" })}
            style={styles.iconButton}
          >
            <Ionicons color={theme.colors.text} name="barcode-outline" size={22} />
          </PressOpacity>
        }
      />
      <View style={styles.selectorRow}>
        <View style={styles.selector}>
          <SegmentedSelector
            accessibilityLabel="Food lists"
            onChange={(tab: PickerTab) => updatePicker((current) => ({ ...current, tab }))}
            options={[
              { label: "All", value: "all" },
              { label: "Favourites", value: "favourites" },
              { label: "Custom", value: "custom" },
            ]}
            value={picker.tab}
          />
        </View>
        <PressOpacity
          accessibilityLabel={`Sort foods, ${sortLabel}`}
          onPress={() => {
            if (filterOpen) {
              setFilterRequested(false);
              return;
            }

            setFilterEpoch(transientEpoch);
            setFilterRequested(true);
          }}
          style={styles.filter}
        >
          <Text numberOfLines={2} style={[styles.filterText, { color: theme.colors.text }]}>
            {sortLabel}
          </Text>
        </PressOpacity>
      </View>
      {filterOpen ? (
        <View
          style={[
            styles.filterMenu,
            { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
          ]}
        >
          <FilterChoice
            label="Most Frequent"
            onPress={() => chooseSort("frequent")}
          />
          <FilterChoice label="Most Recent" onPress={() => chooseSort("recent")} />
          <FilterChoice label="Reset to default" onPress={() => chooseSort("default")} />
          <PressOpacity
            accessibilityLabel="Dismiss sort menu"
            onPress={() => setFilterRequested(false)}
            style={styles.filterChoice}
          >
            <Text style={{ color: theme.colors.textMuted }}>Dismiss</Text>
          </PressOpacity>
        </View>
      ) : null}
      {remoteLoading ? (
        <ActivityIndicator color={theme.colors.tertiary} style={styles.loading} />
      ) : null}
      {remoteError && picker.tab === "all" && picker.query.trim() ? (
        <View style={styles.messageBlock}>
          <Text style={[styles.message, { color: theme.colors.text }]}>{remoteError}</Text>
          <PressOpacity
            accessibilityLabel="Retry food search"
            onPress={() => setRetryNonce((nonce) => nonce + 1)}
            style={styles.retry}
          >
            <Text style={{ color: theme.colors.tertiary }}>Retry</Text>
          </PressOpacity>
        </View>
      ) : null}
      <FlatList
        contentOffset={{ x: 0, y: picker.scrollOffsets[picker.tab] }}
        ref={listRef}
        data={rows}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(row) => row.key}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={[styles.message, { color: theme.colors.textMuted }]}>{emptyMessage}</Text>
            {picker.tab === "custom" ? (
              <PressOpacity
                accessibilityLabel="Create custom food"
                onPress={() => push({ screen: "customFood" })}
                style={styles.retry}
              >
                <Text style={{ color: theme.colors.tertiary }}>Create Custom Food</Text>
              </PressOpacity>
            ) : null}
          </View>
        }
        onScroll={(event) => {
          offsets.current = {
            ...offsets.current,
            [picker.tab]: event.nativeEvent.contentOffset.y,
          };
        }}
        renderItem={({ item }) => (
          <PressOpacity
            accessibilityLabel={item.title}
            onPress={item.onPress}
            style={[styles.row, { borderBottomColor: theme.colors.border }]}
          >
            <Text style={[styles.name, { color: theme.colors.text }]}>{item.title}</Text>
            {item.subtitle ? (
              <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
                {item.subtitle}
              </Text>
            ) : null}
            <FoodMacroLine nutrients={item.nutrients} />
          </PressOpacity>
        )}
        scrollEventThrottle={80}
        style={styles.list}
      />
      {picker.tab === "custom" && rows.length > 0 ? (
        <PressOpacity
          accessibilityLabel="Create custom food"
          onPress={() => push({ screen: "customFood" })}
          style={[styles.createRow, { borderTopColor: theme.colors.border }]}
        >
          <Text style={{ color: theme.colors.tertiary }}>Create Custom Food</Text>
        </PressOpacity>
      ) : null}
    </View>
  );

  function chooseSort(sort: UsageSort) {
    updatePicker((current) => ({ ...current, sort }));
    setFilterRequested(false);
  }
}

function FilterChoice({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useAppTheme();

  return (
    <PressOpacity accessibilityLabel={label} onPress={onPress} style={styles.filterChoice}>
      <Text style={{ color: theme.colors.text }}>{label}</Text>
    </PressOpacity>
  );
}

function effectiveSortLabel(
  tab: PickerTab,
  query: string,
  sort: UsageSort,
  hasUsage: boolean,
) {
  if (sort === "frequent") {
    return "Most Frequent";
  }

  if (sort === "recent") {
    return "Most Recent";
  }

  if (tab === "all" && query.trim()) {
    return "Relevance";
  }

  return hasUsage ? "Most Recent" : "Alphabetical";
}

function buildRows(input: {
  customs: CustomFoodRecord[];
  favourites: FoodFavourite[];
  hasUsage: boolean;
  known: KnownFoodRow[];
  onOpen: (food: CatalogFood, amount?: string, servingId?: string) => void;
  picker: { query: string; tab: PickerTab; sort: UsageSort };
  remote: FoodSearchHit[];
  resolvedNames: Record<string, CatalogFood | null>;
  usage: Map<string, UsageRank>;
}): Row[] {
  const query = input.picker.query.trim().toLowerCase();

  if (input.picker.tab === "all" && query) {
    const ranked = input.remote.map((hit, index) => ({ hit, index }));

    if (input.picker.sort !== "default") {
      ranked.sort((left, right) => {
        const leftUsage = input.usage.get(foodIdentityKey(left.hit.ref)) ?? null;
        const rightUsage = input.usage.get(foodIdentityKey(right.hit.ref)) ?? null;
        const usageDelta =
          input.picker.sort === "frequent"
            ? (rightUsage?.count ?? 0) - (leftUsage?.count ?? 0)
            : (rightUsage?.latestAt ?? 0) - (leftUsage?.latestAt ?? 0);

        if (usageDelta !== 0) {
          return usageDelta;
        }

        return left.index - right.index;
      });
    }

    return ranked.map(({ hit }) => ({
      key: foodIdentityKey(hit.ref),
      nutrients: hit.preview,
      onPress: () =>
        input.onOpen({
          attribution: "fatsecret",
          brandName: hit.brandName,
          defaultServingId: "",
          name: hit.name,
          ref: hit.ref,
          servings: [],
          storagePolicy: "reference",
        }),
      subtitle: hit.brandName ?? hit.previewLabel,
      title: hit.name,
    }));
  }

  if (input.picker.tab === "favourites") {
    return input.favourites
      .map((favourite) => {
        const resolved = input.resolvedNames[foodIdentityKey(favourite.food)] ?? null;
        const serving = resolved?.servings.find((item) => item.id === favourite.servingId);
        const title = resolved?.name ?? "Food details unavailable";

        return {
          favourite,
          resolved,
          row: {
            key: favourite.configKey,
            nutrients: serving?.nutrients ?? null,
            onPress: () => {
              if (resolved) {
                input.onOpen(resolved, String(favourite.amount), favourite.servingId);
              }
            },
            subtitle: serving ? `${favourite.amount} × ${serving.label}` : null,
            title,
          } satisfies Row,
        };
      })
      .filter((entry) => !query || entry.row.title.toLowerCase().includes(query))
      .sort((left, right) =>
        sortLocal(
          left.row.title,
          left.favourite.configKey,
          input.usage.get(foodIdentityKey(left.favourite.food)) ?? null,
          right.row.title,
          right.favourite.configKey,
          input.usage.get(foodIdentityKey(right.favourite.food)) ?? null,
          input.picker.sort,
          input.hasUsage,
        ),
      )
      .map((entry) => entry.row);
  }

  if (input.picker.tab === "custom") {
    return input.customs
      .filter((food) => !query || food.name.toLowerCase().includes(query))
      .sort((left, right) =>
        sortLocal(
          left.name,
          left.id,
          input.usage.get(`custom:${left.id}`) ?? null,
          right.name,
          right.id,
          input.usage.get(`custom:${right.id}`) ?? null,
          input.picker.sort,
          input.hasUsage,
        ),
      )
      .map((food) => ({
        key: food.id,
        nutrients: {
          carbohydratesG: food.carbohydratesG,
          energyKcal: food.energyKcal,
          fatG: food.fatG,
          proteinG: food.proteinG,
        },
        onPress: () => input.onOpen(catalogFoodFromCustom(food)),
        subtitle: food.brand,
        title: food.name,
      }));
  }

  const local = new Map<string, Row & { id: string; usage: UsageRank | null }>();

  for (const food of input.customs) {
    local.set(`custom:${food.id}`, {
      id: food.id,
      key: `custom:${food.id}`,
      nutrients: {
        carbohydratesG: food.carbohydratesG,
        energyKcal: food.energyKcal,
        fatG: food.fatG,
        proteinG: food.proteinG,
      },
      onPress: () => input.onOpen(catalogFoodFromCustom(food)),
      subtitle: food.brand,
      title: food.name,
      usage: input.usage.get(`custom:${food.id}`) ?? null,
    });
  }

  for (const food of input.known) {
    const key = foodIdentityKey(food.food);

    if (local.has(key)) {
      continue;
    }

    const resolved = input.resolvedNames[key];
    const title =
      food.description ?? resolved?.name ?? "Food details unavailable";
    const catalog = food.storagePolicy === "snapshot" ? knownSnapshot(food) : resolved;

    local.set(key, {
      id: food.food.externalId,
      key,
      nutrients: food.nutrients ?? resolved?.servings[0]?.nutrients ?? null,
      onPress: () => {
        if (catalog && catalog.servings.length > 0) {
          input.onOpen(catalog, "1", food.servingId);
        }
      },
      subtitle: food.brandName ?? food.servingDescription,
      title,
      usage: input.usage.get(key) ?? null,
    });
  }

  return [...local.values()]
    .filter((row) => !query || row.title.toLowerCase().includes(query))
    .sort((left, right) =>
      sortLocal(
        left.title,
        left.id,
        left.usage,
        right.title,
        right.id,
        right.usage,
        input.picker.sort,
        input.hasUsage,
      ),
    );
}

function knownSnapshot(food: KnownFoodRow): CatalogFood | null {
  if (!food.description || !food.nutrients) {
    return null;
  }

  return {
    attribution: food.food.source === "openfoodfacts" ? "Open Food Facts" : null,
    brandName: food.brandName,
    defaultServingId: food.servingId,
    name: food.description,
    ref: food.food,
    servings: [
      {
        amount: food.servingAmount ?? 1,
        extras: food.extras,
        id: food.servingId,
        label: food.servingDescription ?? "1 serving",
        nutrients: food.nutrients,
        unit: food.servingUnit ?? "serving",
      },
    ],
    storagePolicy: "snapshot",
  };
}

function sortLocal(
  leftName: string,
  leftId: string,
  leftUsage: UsageRank | null,
  rightName: string,
  rightId: string,
  rightUsage: UsageRank | null,
  sort: UsageSort,
  hasUsage: boolean,
) {
  const mode =
    sort === "frequent"
      ? "frequent"
      : sort === "recent" || (sort === "default" && hasUsage)
        ? "recent"
        : "alpha";

  return compareByUsage(
    { id: leftId, name: leftName, usage: leftUsage },
    { id: rightId, name: rightName, usage: rightUsage },
    mode,
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  search: {
    fontSize: tokens.typography.body.fontSize,
    minHeight: 44,
    textAlign: "center",
    width: "100%",
  },
  iconButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  selectorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
  },
  selector: {
    flex: 3,
  },
  filter: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  filterText: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  filterMenu: {
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: tokens.spacing.lg,
    zIndex: 2,
  },
  filterChoice: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
  },
  list: {
    flex: 1,
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
    justifyContent: "center",
    minHeight: 64,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
  },
  name: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: tokens.typography.label.fontSize,
  },
  loading: {
    paddingVertical: tokens.spacing.sm,
  },
  messageBlock: {
    alignItems: "center",
    paddingHorizontal: tokens.spacing.lg,
  },
  message: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: "center",
  },
  retry: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: tokens.spacing.lg,
  },
  createRow: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 48,
  },
});
