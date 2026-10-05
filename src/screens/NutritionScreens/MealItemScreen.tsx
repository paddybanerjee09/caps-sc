import Ionicons from "@expo/vector-icons/Ionicons";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  View,
  type LayoutRectangle,
} from "react-native";

import {
  FoodMacroLine,
  NutritionTextInput,
  WorkflowHeader,
} from "../../components/nutrition/NutritionChrome";
import { SegmentedSelector } from "../../components/nutrition/SegmentedSelector";
import { PressOpacity } from "../../components/PressOpacity";
import {
  deleteCustomFood,
  getFoodUsage,
  hasCompletedFoodUsage,
  listCustomFoods,
  listFavourites,
  listKnownFoods,
  saveFavouriteSnapshot,
  type CustomFoodRecord,
  type FoodFavourite,
  type KnownFoodRow,
} from "../../data/nutritionCatalogRepository";
import {
  compareByUsage,
  foodIdentityKey,
  type UsageRank,
} from "../../nutrition/calculations";
import { createCustomFoodForm, type PickerTab, type UsageSort } from "../../nutrition/drafts";
import {
  catalogFoodFromCustom,
  peekCatalogFood,
  rememberCatalogFood,
  resolveCatalogFood,
} from "../../services/foodCatalog";
import { searchFatSecretFoods } from "../../services/fatsecretApi";
import { providerErrorMessage } from "../../services/providerError";
import { useNutritionWorkspace } from "../../state/NutritionWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import type { CatalogFood, FoodRef, FoodSearchHit, NutrientSnapshot } from "../../types/nutrition";

const tokens = themes.dark;

type Row = {
  key: string;
  title: string;
  subtitle: string | null;
  nutrients: NutrientSnapshot | null;
  onDelete?: () => void;
  onEdit?: () => void;
  onPress: () => void;
};

type OpenFood = (
  ref: FoodRef,
  amount: string,
  servingId: string | null,
  food: CatalogFood | null,
) => void;

type SortChoice = { label: string; sort: UsageSort };

export function MealItemScreen() {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const workspace = useNutritionWorkspace();
  const {
    customForm,
    markNutritionChanged,
    picker,
    pop,
    push,
    registerBackHandler,
    setFacts,
    startCustomFood,
    startEditCustomFood,
    transientEpoch,
    updateCustomForm,
    updatePicker,
  } = workspace;
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
  const [rowFrame, setRowFrame] = useState<LayoutRectangle | null>(null);
  const [filterFrame, setFilterFrame] = useState<LayoutRectangle | null>(null);
  const [resolvedNames, setResolvedNames] = useState<Record<string, CatalogFood | null>>({});
  const [retryNonce, setRetryNonce] = useState(0);
  const listRef = useRef<FlatList<Row>>(null);
  const offsets = useRef(picker.scrollOffsets);
  const requestId = useRef(0);
  const updatePickerRef = useRef(updatePicker);
  const formCustomFoodId = customForm.customFoodId;

  useEffect(() => {
    updatePickerRef.current = updatePicker;
  });

  useEffect(() => {
    return () => {
      updatePickerRef.current((current) => ({
        ...current,
        scrollOffsets: offsets.current,
      }));
    };
  }, []);

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
    const seen = new Set<string>();
    const favouriteRefs: FoodRef[] = [];
    const knownRefs: FoodRef[] = [];
    const queue = (ref: FoodRef, target: FoodRef[]) => {
      const key = foodIdentityKey(ref);

      if (!seen.has(key)) {
        seen.add(key);
        target.push(ref);
      }
    };

    for (const favourite of favourites) {
      if (favourite.food.source !== "custom" && !favourite.snapshot) {
        queue(favourite.food, favouriteRefs);
      }
    }

    for (const food of known) {
      if (food.storagePolicy === "reference") {
        queue(food.food, knownRefs);
      }
    }

    const refs = [...favouriteRefs, ...knownRefs.slice(0, 20)];
    let cancelled = false;

    void (async () => {
      for (const ref of refs) {
        if (cancelled) {
          return;
        }

        const key = foodIdentityKey(ref);
        const cached = peekCatalogFood(ref);

        if (cached) {
          setResolvedNames((current) => ({ ...current, [key]: cached }));
          continue;
        }

        try {
          const food = await resolveCatalogFood(db, ref);

          if (cancelled) {
            return;
          }

          setResolvedNames((current) => ({ ...current, [key]: food }));

          if (food && food.servings.length > 0) {
            for (const favourite of favourites) {
              if (!favourite.snapshot && foodIdentityKey(favourite.food) === key) {
                void saveFavouriteSnapshot(db, favourite.id, food).catch(() => undefined);
              }
            }
          }
        } catch {
          if (!cancelled) {
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
  const choices = sortChoices(picker.tab, picker.query, hasUsage);
  const filterMenuFrame =
    rowFrame && filterFrame
      ? {
          left: rowFrame.x + filterFrame.x,
          top: rowFrame.y + filterFrame.y + filterFrame.height + tokens.spacing.xs,
          width: filterFrame.width,
        }
      : null;

  const openFood = useCallback<OpenFood>(
    (ref, amount, servingId, food) => {
      if (food) {
        rememberCatalogFood(food);
      }

      setFacts({
        amountInput: amount,
        calorieInput: "",
        draftItemId: null,
        food: ref,
        inputMode: "amount",
        servingId,
        snapshot: food,
      });
      push({ screen: "facts" });
    },
    [push, setFacts],
  );

  const confirmDeleteCustom = useCallback(
    (food: CustomFoodRecord) => {
      async function remove() {
        try {
          await deleteCustomFood(db, food.id);

          if (formCustomFoodId === food.id) {
            updateCustomForm(() => createCustomFoodForm());
          }
        } catch {
          Alert.alert("Couldn't delete food", "Please try again.");
        } finally {
          markNutritionChanged();
        }
      }

      Alert.alert(
        "Delete custom food?",
        `${food.name} will be removed from your custom foods. Meals you already logged keep their nutrition.`,
        [
          { style: "cancel", text: "Cancel" },
          { onPress: () => void remove(), style: "destructive", text: "Delete" },
        ],
      );
    },
    [db, formCustomFoodId, markNutritionChanged, updateCustomForm],
  );

  const rows = useMemo(
    () =>
      buildRows({
        customs,
        favourites,
        hasUsage,
        known,
        onDeleteCustom: confirmDeleteCustom,
        onEditCustom: startEditCustomFood,
        onOpen: openFood,
        picker,
        remote: remoteQuery === picker.query.trim() ? remote : [],
        resolvedNames,
        usage,
      }),
    [
      confirmDeleteCustom,
      customs,
      favourites,
      hasUsage,
      known,
      openFood,
      picker,
      startEditCustomFood,
      remote,
      remoteQuery,
      resolvedNames,
      usage,
    ],
  );

  const emptyMessage =
    picker.tab === "all" && !picker.query.trim()
      ? "Search for a food"
      : picker.tab === "custom"
        ? "Create a custom food to use it here."
        : remoteError ?? "No foods found.";

  function toggleFilter() {
    if (filterOpen) {
      setFilterRequested(false);
      return;
    }

    Keyboard.dismiss();
    setFilterEpoch(transientEpoch);
    setFilterRequested(true);
  }

  function chooseSort(sort: UsageSort) {
    updatePicker((current) => ({ ...current, sort }));
    setFilterRequested(false);
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <WorkflowHeader
        center={
          <NutritionTextInput
            accessibilityLabel="Search foods"
            autoCapitalize="none"
            autoCorrect={false}
            containerStyle={styles.search}
            icon="search"
            onChangeText={(query) => updatePicker((current) => ({ ...current, query }))}
            placeholder="Search foods"
            returnKeyType="search"
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
      <View
        onLayout={(event) => setRowFrame(event.nativeEvent.layout)}
        style={styles.selectorRow}
      >
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
        <View
          onLayout={(event) => setFilterFrame(event.nativeEvent.layout)}
          style={styles.filterWrap}
        >
          <PressOpacity
            accessibilityLabel={`Sort foods, ${sortLabel}`}
            onPress={toggleFilter}
            style={[
              styles.filter,
              {
                backgroundColor: theme.colors.surface,
                borderColor: filterOpen ? theme.colors.borderStrong : theme.colors.border,
              },
            ]}
          >
            <Ionicons color={theme.colors.text} name="filter" size={14} />
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              numberOfLines={2}
              style={[styles.filterText, { color: theme.colors.text }]}
            >
              {sortLabel}
            </Text>
          </PressOpacity>
        </View>
      </View>
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
                onPress={() => startCustomFood()}
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
          <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
            <PressOpacity
              accessibilityLabel={item.title}
              onPress={item.onPress}
              style={styles.rowMain}
            >
              <Text style={[styles.name, { color: theme.colors.text }]}>{item.title}</Text>
              {item.subtitle ? (
                <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
                  {item.subtitle}
                </Text>
              ) : null}
              <FoodMacroLine nutrients={item.nutrients} />
            </PressOpacity>
            {item.onEdit ? (
              <PressOpacity
                accessibilityLabel={`Edit ${item.title}`}
                onPress={item.onEdit}
                style={styles.rowDelete}
              >
                <Ionicons color={theme.colors.textMuted} name="create-outline" size={20} />
              </PressOpacity>
            ) : null}
            {item.onDelete ? (
              <PressOpacity
                accessibilityLabel={`Delete ${item.title}`}
                onPress={item.onDelete}
                style={styles.rowDelete}
              >
                <Ionicons color={theme.colors.textMuted} name="close" size={20} />
              </PressOpacity>
            ) : null}
          </View>
        )}
        scrollEventThrottle={80}
        style={styles.list}
      />
      {picker.tab === "custom" && rows.length > 0 ? (
        <PressOpacity
          accessibilityLabel="Create custom food"
          onPress={() => startCustomFood()}
          style={[styles.createRow, { borderTopColor: theme.colors.border }]}
        >
          <Text style={{ color: theme.colors.tertiary }}>Create Custom Food</Text>
        </PressOpacity>
      ) : null}
      {filterOpen ? (
        <PressOpacity
          accessibilityLabel="Close sort options"
          onPress={() => setFilterRequested(false)}
          pressedOpacity={1}
          style={styles.filterBackdrop}
        />
      ) : null}
      {filterOpen && filterMenuFrame ? (
        <View
          style={[
            styles.filterMenu,
            filterMenuFrame,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          {choices.map((choice, index) => (
            <FilterChoice
              first={index === 0}
              key={choice.label}
              label={choice.label}
              onPress={() => chooseSort(choice.sort)}
              selected={choice.label === sortLabel}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FilterChoice({
  first,
  label,
  onPress,
  selected,
}: {
  first: boolean;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const { theme } = useAppTheme();

  return (
    <PressOpacity
      accessibilityLabel={selected ? `${label}, selected` : label}
      onPress={onPress}
      style={[
        styles.filterChoice,
        selected && { backgroundColor: theme.colors.accentMuted },
        !first && {
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        numberOfLines={1}
        style={[
          styles.filterChoiceText,
          selected
            ? { color: theme.colors.text, fontWeight: "700" }
            : { color: theme.colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </PressOpacity>
  );
}

function sortChoices(tab: PickerTab, query: string, hasUsage: boolean): SortChoice[] {
  const choices: SortChoice[] = [];

  if (tab === "all" && query.trim()) {
    choices.push({ label: "Relevance", sort: "default" });
  } else if (!hasUsage) {
    choices.push({ label: "Alphabetical", sort: "default" });
  }

  choices.push(
    { label: "Most Frequent", sort: "frequent" },
    { label: "Most Recent", sort: "recent" },
  );
  return choices;
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
  onDeleteCustom: (food: CustomFoodRecord) => void;
  onEditCustom: (food: CustomFoodRecord) => void;
  onOpen: OpenFood;
  picker: { query: string; tab: PickerTab; sort: UsageSort };
  remote: FoodSearchHit[];
  resolvedNames: Record<string, CatalogFood | null>;
  usage: Map<string, UsageRank>;
}): Row[] {
  const query = input.picker.query.trim().toLowerCase();
  const customById = new Map(input.customs.map((food) => [food.id, food]));

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
      onPress: () => input.onOpen(hit.ref, "1", null, null),
      subtitle: hit.brandName ?? hit.previewLabel,
      title: hit.name,
    }));
  }

  if (input.picker.tab === "favourites") {
    const knownByKey = new Map(input.known.map((food) => [foodIdentityKey(food.food), food]));

    return input.favourites
      .map((favourite) => {
        const key = foodIdentityKey(favourite.food);
        const food = favouriteFood(favourite, customById, knownByKey, input.resolvedNames);
        const serving = food?.servings.find((item) => item.id === favourite.servingId);
        const title =
          food?.name ??
          (favourite.food.source !== "custom" && !(key in input.resolvedNames)
            ? "Loading food…"
            : "Food details unavailable");

        return {
          favourite,
          row: {
            key: favourite.configKey,
            nutrients: serving?.nutrients ?? null,
            onPress: () =>
              input.onOpen(
                favourite.food,
                String(favourite.amount),
                favourite.servingId,
                food ?? null,
              ),
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
        nutrients: customNutrients(food),
        onDelete: () => input.onDeleteCustom(food),
        onEdit: () => input.onEditCustom(food),
        onPress: () => openCustom(food, input.onOpen),
        subtitle: food.brand,
        title: food.name,
      }));
  }

  const local = new Map<string, Row & { id: string; usage: UsageRank | null }>();

  for (const food of input.customs) {
    local.set(`custom:${food.id}`, {
      id: food.id,
      key: `custom:${food.id}`,
      nutrients: customNutrients(food),
      onPress: () => openCustom(food, input.onOpen),
      subtitle: food.brand,
      title: food.name,
      usage: input.usage.get(`custom:${food.id}`) ?? null,
    });
  }

  for (const food of input.known) {
    const key = foodIdentityKey(food.food);

    if (local.has(key) || (food.food.source === "custom" && !customById.has(food.food.externalId))) {
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
      onPress: () =>
        input.onOpen(
          food.food,
          "1",
          food.servingId,
          catalog && catalog.servings.length > 0 ? catalog : null,
        ),
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

function favouriteFood(
  favourite: FoodFavourite,
  customById: ReadonlyMap<string, CustomFoodRecord>,
  knownByKey: ReadonlyMap<string, KnownFoodRow>,
  resolvedNames: Record<string, CatalogFood | null>,
) {
  if (favourite.food.source === "custom") {
    const custom = customById.get(favourite.food.externalId);
    return custom ? catalogFoodFromCustom(custom) : favourite.snapshot;
  }

  if (favourite.snapshot) {
    return favourite.snapshot;
  }

  const key = foodIdentityKey(favourite.food);
  const known = knownByKey.get(key);

  if (known?.storagePolicy === "snapshot" && known.servingId === favourite.servingId) {
    const snapshot = knownSnapshot(known);

    if (snapshot) {
      return snapshot;
    }
  }

  return resolvedNames[key] ?? null;
}

function openCustom(food: CustomFoodRecord, onOpen: OpenFood) {
  const catalog = catalogFoodFromCustom(food);
  onOpen(catalog.ref, "1", catalog.defaultServingId, catalog);
}

function customNutrients(food: CustomFoodRecord): NutrientSnapshot {
  return {
    carbohydratesG: food.carbohydratesG,
    energyKcal: food.energyKcal,
    fatG: food.fatG,
    proteinG: food.proteinG,
  };
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
    flex: 7,
  },
  filterWrap: {
    flex: 3,
  },
  filter: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: tokens.spacing.xs,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.xs,
  },
  filterText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 15,
    textAlign: "center",
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
  filterMenu: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    boxShadow: "0px 6px 16px rgba(0, 0, 0, 0.24)",
    overflow: "hidden",
    position: "absolute",
    zIndex: 11,
  },
  filterChoice: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.xs,
  },
  filterChoiceText: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
  },
  list: {
    flex: 1,
  },
  row: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 64,
    paddingLeft: tokens.spacing.lg,
    paddingRight: tokens.spacing.sm,
  },
  rowMain: {
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minHeight: 64,
    paddingVertical: tokens.spacing.sm,
  },
  rowDelete: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
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
