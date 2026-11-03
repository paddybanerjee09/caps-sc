CAPS.trees.nutrition = {
  id: "nutrition",
  title: "Nutrition",
  summary:
    "Diary of logged meals for a local day, a macronutrient (and micronutrient) card, and a full-screen composer stack: MealLog, MealItem (FatSecret / favourites / custom / barcode), Nutrition Facts, Create Custom Food, and Saved Meals. USDA FoodData Central was removed. FatSecret and Open Food Facts remain.",
  rules: ["ui-style-guide.mdc"],
  root: {
    id: "nutrition-screen",
    title: "NutritionScreen",
    kind: "screen",
    tagline: "Diary + macro card for the selected day",
    files: ["src/screens/NutritionScreen.tsx"],
    entry: "Bottom tab \"Nutrition\", first tab.",
    summary:
      "Date-stepped local day. Loads `meal_logs` via `scheduleIdleTask`. Collapsible meal rows open `MealLogScreen` for edit; Add Meal opens a new composer. `MacronutrientBreakdownCard` sits beside the diary. The overlay stack is mounted by `AppNavigator` only while this tab is active.",
    guardrails: [
      "Do not reload meals on unrelated workspace updates (fix 6ccb251).",
      "Defer diary loads with `scheduleIdleTask` (c8ddb63).",
      "Do not restore `MealLogModal`; the composer is a full-screen stack (1d7f792; ui-style-guide.mdc).",
    ],
    links: [
      "architecture:bottom-tabs",
      "architecture:schedule-idle-task",
      "database:table-meal-logs",
      "database:table-meal-items",
    ],
    versions: [
      {
        n: 1,
        name: "Nutrition",
        date: "2026-07-02 00:35 -0400",
        commits: ["e9ddbfb", "f0f5834"],
        changes: [
          "Boilerplate Nutrition tab, then custom-nav placeholder in `Screens.tsx`.",
        ],
      },
      {
        n: 2,
        name: "NutritionScreen",
        date: "2026-07-22 02:53 -0400",
        commits: ["edd48ce", "ad01bfe"],
        changes: ["Own file, then centered title."],
      },
      {
        n: 3,
        name: "NutritionScreen",
        date: "2026-07-30 14:23 -0400",
        commits: ["241f556", "a269579", "e8fc8e9"],
        changes: [
          "Diary and caloric/macronutrient card (`241f556`, `a269579`). Collapsible meal sections (`e8fc8e9`).",
        ],
      },
      {
        n: 4,
        name: "NutritionScreen",
        date: "2026-10-04 18:49 -0400",
        commits: ["1d7f792", "6ccb251"],
        changes: [
          "Opened the full-screen composer instead of `MealLogModal` (`1d7f792`).",
          "Stopped reloading meals on unrelated workspace updates (`6ccb251`).",
        ],
      },
      {
        n: 5,
        name: "NutritionScreen",
        date: "2026-11-02 22:58 -0500",
        commits: ["c8ddb63", "9917cee"],
        changes: [
          "Idle deferred loads (`c8ddb63`). Card-by-card diary renovation (`9917cee`).",
        ],
      },
    ],
    children: [
      {
        id: "nutrition-diary",
        title: "Logged meals diary",
        kind: "card",
        tagline: "Collapsible meals for the selected day",
        files: ["src/screens/NutritionScreen.tsx"],
        summary:
          "LOGged MEALS DIARY card. Each meal expands in place. Three-dot edit opens the composer on that log. Add Meal starts `openNewMeal`.",
        modes: [
          { name: "Collapsed meal", detail: "Title, time, compact totals." },
          { name: "Expanded meal", detail: "Item list and actions." },
        ],
        versions: [
          {
            n: 1,
            name: "Nutrition diary",
            date: "2026-07-30 14:23 -0400",
            commits: ["241f556", "e8fc8e9"],
            changes: ["Added the diary and made meal sections collapsible."],
          },
          {
            n: 2,
            name: "Nutrition diary",
            date: "2026-10-04 23:25 -0400",
            commits: ["015743c"],
            changes: ["Three-dot Edit Meal on each logged diary meal."],
          },
          {
            n: 3,
            name: "Nutrition diary",
            date: "2026-11-02 22:58 -0500",
            commits: ["9917cee"],
            changes: ["Card-by-card diary with steppers and compact meal rows."],
          },
        ],
        children: [
          {
            id: "meal-log-screen",
            title: "MealLogScreen",
            kind: "subscreen",
            tagline: "Full-screen meal composer",
            files: ["src/screens/NutritionScreens/MealLogScreen.tsx"],
            entry: "Add Meal / Edit Meal on the diary, or Home Quick Log > Meal.",
            summary:
              "Composer for one `MealDraft`. Title, `LogTimeChanger`, items, compact meal totals, saved-meal actions. Add meal item pushes `MealItemScreen`. Replaced `MealLogModal`.",
            modes: [
              { name: "New meal", detail: "`openNewMeal(day)`." },
              { name: "Edit logged meal", detail: "`openEditMeal(meal)` from the diary three-dot menu." },
              { name: "Edit saved template", detail: "Opened from Saved Meals." },
            ],
            guardrails: [
              "Keep Add meal item as the focus; meal actions stay on the composer, not a menu modal (0deafb1).",
              "Do not restore `MealLogModal` (1d7f792).",
            ],
            links: ["architecture:log-time-changer", "database:table-meal-logs", "home:quick-log"],
            versions: [
              {
                n: 1,
                name: "MealLogModal",
                date: "2026-07-30 14:23 -0400",
                commits: ["241f556", "e845b49", "bfdcb3a", "298f627", "3225bb5", "e8fc8e9"],
                changes: [
                  "Modal composer with USDA search, servings, planned vs completed, and collapsible sections.",
                ],
              },
              {
                n: 2,
                name: "MealLogScreen",
                date: "2026-10-03 22:33 -0400",
                commits: ["4b6db09", "1d7f792"],
                request: "Replace the meal modal with a full-screen nutrition stack.",
                changes: [
                  "Added `MealLogScreen` (`4b6db09`) and switched Nutrition and Home to open it (`1d7f792`).",
                ],
              },
              {
                n: 3,
                name: "MealLogScreen",
                date: "2026-10-05 22:38 -0400",
                commits: ["0deafb1", "0627d77", "1daf75d", "39add05", "6397e58"],
                changes: [
                  "Add meal item focus, compact meal totals, filled title fields, compact time pill, saved-template editing.",
                ],
              },
              {
                n: 4,
                name: "MealLogScreen",
                date: "2026-11-02 22:58 -0500",
                commits: ["9917cee"],
                changes: ["Card-by-card composer with steppers."],
              },
            ],
            children: [
              {
                id: "meal-item-screen",
                title: "MealItemScreen",
                kind: "subscreen",
                tagline: "Food picker: all / favourites / custom",
                files: ["src/screens/NutritionScreens/MealItemScreen.tsx"],
                entry: "Add meal item on `MealLogScreen`.",
                summary:
                  "Search FatSecret plus local favourites and custom foods. Sort overlay. Opens barcode, custom food, or facts.",
                modes: [
                  { name: "All", detail: "FatSecret search." },
                  { name: "Favourites", detail: "Starred snapshots." },
                  { name: "Custom", detail: "User-created foods." },
                ],
                versions: [
                  {
                    n: 1,
                    name: "MealItemScreen",
                    date: "2026-10-03 22:32 -0400",
                    commits: ["8731d05"],
                    changes: ["Added the food picker with local and FatSecret search."],
                  },
                  {
                    n: 2,
                    name: "MealItemScreen",
                    date: "2026-10-05 22:38 -0400",
                    commits: ["f8de697", "fabae46"],
                    changes: [
                      "Sort overlay and custom-food edit/delete (`f8de697`). Back bar and prominent create-custom-food (`fabae46`).",
                    ],
                  },
                  {
                    n: 3,
                    name: "MealItemScreen",
                    date: "2026-11-02 22:58 -0500",
                    commits: ["9917cee"],
                    changes: ["Card/stepper renovation."],
                  },
                ],
                children: [
                  {
                    id: "barcode-scan-screen",
                    title: "BarcodeScanScreen",
                    kind: "subscreen",
                    tagline: "Open Food Facts scan / entry",
                    files: ["src/screens/NutritionScreens/BarcodeScanScreen.tsx"],
                    entry: "Barcode action on `MealItemScreen`.",
                    summary: "Camera scan or typed barcode via Open Food Facts. Close-X returns to nutrition home (`64d6eb3`).",
                    versions: [
                      {
                        n: 1,
                        name: "BarcodeScanScreen",
                        date: "2026-10-03 22:33 -0400",
                        commits: ["4890a26"],
                        changes: ["In-screen barcode scanning through Open Food Facts."],
                      },
                      {
                        n: 2,
                        name: "BarcodeScanScreen",
                        date: "2026-10-05 22:38 -0400",
                        commits: ["4d8f785", "64d6eb3"],
                        changes: ["Clearer barcode prompt (`4d8f785`). Close to nutrition home (`64d6eb3`)."],
                      },
                      {
                        n: 3,
                        name: "BarcodeScanScreen",
                        date: "2026-11-02 22:58 -0500",
                        commits: ["9917cee"],
                        changes: ["Card renovation."],
                      },
                    ],
                  },
                  {
                    id: "create-custom-food-screen",
                    title: "CreateCustomFoodScreen",
                    kind: "subscreen",
                    tagline: "User food with advisory calories",
                    files: ["src/screens/NutritionScreens/CreateCustomFoodScreen.tsx"],
                    entry: "Create custom food on `MealItemScreen`.",
                    summary: "Custom food form. Fresh form on create; edits stay on the original record. Macros in one row, micros in two columns.",
                    guardrails: [
                      "Start each create on a fresh form; do not reuse a previous edit (`e8925f8`).",
                    ],
                    versions: [
                      {
                        n: 1,
                        name: "CreateCustomFoodScreen",
                        date: "2026-10-03 22:33 -0400",
                        commits: ["12b6b40"],
                        changes: ["Custom foods with an advisory calorie check."],
                      },
                      {
                        n: 2,
                        name: "CreateCustomFoodScreen",
                        date: "2026-10-04 23:27 -0400",
                        commits: ["1041599", "e8925f8", "14c1595"],
                        changes: [
                          "Macro row / micro columns (`1041599`). Fresh create form (`e8925f8`). Facts labeled Create Custom Food (`14c1595`).",
                        ],
                      },
                      {
                        n: 3,
                        name: "CreateCustomFoodScreen",
                        date: "2026-11-02 22:58 -0500",
                        commits: ["9917cee"],
                        changes: ["Card/stepper renovation."],
                      },
                    ],
                  },
                  {
                    id: "nutrition-facts-screen",
                    title: "NutritionFactsScreen",
                    kind: "subscreen",
                    tagline: "Serving, macros, favourite",
                    files: ["src/screens/NutritionScreens/NutritionFactsScreen.tsx"],
                    entry: "Selecting a food in `MealItemScreen`.",
                    summary:
                      "Serving amount steppers, facts, exact-serving favourites. Replaced `FoodServingEditor`. Calories for the default amount show on open.",
                    versions: [
                      {
                        n: 1,
                        name: "FoodServingEditor",
                        date: "2026-07-30 13:39 -0400",
                        commits: ["298f627"],
                        changes: ["Editable calorie counter inside the old meal modal."],
                      },
                      {
                        n: 2,
                        name: "NutritionFactsScreen",
                        date: "2026-10-04 18:59 -0400",
                        commits: ["12171e9", "c4e6bcb", "02ea54a"],
                        changes: [
                          "Full-screen facts with exact-serving favourites, initial calories, floating serving dropdown.",
                        ],
                      },
                      {
            n: 3,
            name: "NutritionFactsScreen",
            date: "2026-10-05 22:42 -0400",
                        commits: ["e5cf05f", "59c7ef6"],
                        changes: ["Compact macro totals with clearer spacing, then inline P/C/F in the title."],
                      },
                      {
                        n: 4,
                        name: "NutritionFactsScreen",
                        date: "2026-11-02 22:58 -0500",
                        commits: ["9917cee"],
                        changes: ["Card/stepper renovation."],
                      },
                    ],
                  },
                ],
              },
              {
                id: "saved-meals-screen",
                title: "SavedMealsScreen",
                kind: "subscreen",
                tagline: "Reusable meal templates",
                files: ["src/screens/NutritionScreens/SavedMealsScreen.tsx"],
                entry: "Saved meals action on `MealLogScreen`.",
                summary: "List of `saved_meals` templates, separate from diary logs. Edit/delete on the list. Opening one loads the composer.",
                versions: [
                  {
                    n: 1,
                    name: "SavedMealsScreen",
                    date: "2026-10-03 22:32 -0400",
                    commits: ["4c6b3f1"],
                    changes: ["Reusable saved meals separate from the diary."],
                  },
                  {
                    n: 2,
                    name: "SavedMealsScreen",
                    date: "2026-10-05 22:38 -0400",
                    commits: ["9b8f6e2", "3b34380", "7c98213", "a553465"],
                    changes: [
                      "Update/delete APIs, template drafts, workspace open, and list edit/delete controls.",
                    ],
                  },
                  {
                    n: 3,
                    name: "SavedMealsScreen",
                    date: "2026-11-02 22:58 -0500",
                    commits: ["9917cee"],
                    changes: ["Card renovation."],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "macro-card",
        title: "MacronutrientBreakdownCard",
        kind: "card",
        tagline: "Day totals, expandable micros",
        files: ["src/components/MacronutrientBreakdownCard.tsx"],
        summary:
          "Protein / carb / fat vs daily targets, plus expandable micronutrients. Compact variant inlines `P: XXg C: XXg F: XXg` for nested screens.",
        modes: [
          { name: "Full", detail: "Diary: rings/bars plus expandable micro list." },
          { name: "Compact", detail: "Nested screens; macros in the header (`13b3d68`, `59c7ef6`)." },
        ],
        versions: [
          {
            n: 1,
            name: "MacronutrientBreakdownCard",
            date: "2026-07-29 15:20 -0400",
            commits: ["a269579", "bfdcb3a"],
            changes: ["Added the card and extracted it as a reusable component."],
          },
          {
            n: 2,
            name: "MacronutrientBreakdownCard",
            date: "2026-10-05 22:42 -0400",
            commits: ["f20a3b3", "13b3d68", "59c7ef6"],
            changes: [
              "Micronutrients moved into the card (`f20a3b3`). Compact variant, then inline P/C/F in the title.",
            ],
          },
          {
            n: 3,
            name: "MacronutrientBreakdownCard",
            date: "2026-11-02 22:58 -0500",
            commits: ["9917cee"],
            changes: ["Card-by-card restyle."],
          },
        ],
      },
      {
        id: "nutrition-stack",
        title: "NutritionStack",
        kind: "overlay",
        tagline: "Animated stack over the Nutrition tab",
        files: ["src/screens/NutritionScreens/NutritionStack.tsx", "src/nutrition/motion.ts"],
        summary:
          "Renders the workspace `stack` as layers that animate up on open and down on close. Hosted by `AppNavigator` only while the Nutrition tab is active.",
        versions: [
          {
            n: 1,
            name: "NutritionStack",
            date: "2026-10-03 22:33 -0400",
            commits: ["60aa964"],
            changes: ["Animate nutrition screens up on open and down on close."],
          },
        ],
      },
      {
        id: "nutrition-workspace",
        title: "NutritionWorkspaceContext",
        kind: "state",
        tagline: "Drafts, stack, diary/home dates",
        files: ["src/state/NutritionWorkspaceContext.tsx", "src/nutrition/drafts.ts"],
        summary:
          "Mounted above the tabs so Home can open the composer. Holds drafts, the overlay stack, `diaryDate` / `homeDate`, notices, and barcode/custom/facts sessions.",
        versions: [
          {
            n: 1,
            name: "NutritionWorkspaceContext",
            date: "2026-10-03 22:32 -0400",
            commits: ["c4f7af8", "ce2ba31"],
            changes: [
              "Provider-neutral model and drafts (`c4f7af8`). Workspace mounted above the tabs (`ce2ba31`).",
            ],
          },
        ],
      },
      {
        id: "segmented-selector",
        title: "SegmentedSelector",
        kind: "component",
        tagline: "Sliding segmented control",
        files: ["src/components/nutrition/SegmentedSelector.tsx"],
        summary:
          "Shared by MealItem tabs and Home's Today/Recovery/Progress. Animation is transform/opacity, not per-frame layout state.",
        guardrails: [
          "Do not drive the slider with React state that retriggers layout every frame (fix ccc63a6).",
        ],
        versions: [
          {
            n: 1,
            name: "SegmentedSelector",
            date: "2026-10-03 22:32 -0400",
            commits: ["ce2ba31"],
            changes: ["Added for nutrition picker tabs."],
          },
          {
            n: 2,
            name: "SegmentedSelector",
            date: "2026-10-03 23:32 -0400",
            commits: ["ccc63a6"],
            changes: ["Stopped the Home section slider from retriggering layout forever."],
          },
          {
            n: 3,
            name: "SegmentedSelector",
            date: "2026-11-02 22:36 -0500",
            commits: ["67d99b6"],
            changes: ["Restyled with the Home renovation."],
          },
        ],
      },
      {
        id: "nutrition-services",
        title: "Food providers",
        kind: "group",
        tagline: "FatSecret, Open Food Facts; USDA removed",
        files: [
          "src/services/foodCatalog.ts",
          "src/services/fatsecretApi.ts",
          "src/services/openFoodFactsApi.ts",
        ],
        summary: "Catalog resolver over FatSecret search and Open Food Facts barcodes. Custom foods are local.",
        children: [
          {
            id: "usda-client",
            title: "foodDataCentralApi",
            kind: "service",
            status: "removed",
            tagline: "USDA client, deleted",
            files: ["src/services/foodDataCentralApi.ts"],
            summary: "USDA FoodData Central REST client used by the old `MealLogModal`. Removed; no successor in-process besides FatSecret/OFF.",
            versions: [
              {
                n: 1,
                name: "foodDataCentralApi",
                date: "2026-07-28 23:46 -0400",
                commits: ["ada401f", "241f556"],
                changes: ["Configured the USDA key and added the client."],
              },
              {
                n: 2,
                name: "foodDataCentralApi",
                date: "2026-10-05 22:34 -0400",
                commits: ["fe847c6"],
                request: "Remove the USDA FoodData Central API client.",
                changes: ["Deleted the USDA client and key usage."],
              },
            ],
          },
        ],
        versions: [
          {
            n: 1,
            name: "FatSecret + Open Food Facts",
            date: "2026-10-03 22:33 -0400",
            commits: ["8a1f6a3", "1d8b456"],
            changes: [
              "FatSecret search, OFF barcode lookup, and the food proxy docs/verification (`1d8b456`).",
            ],
          },
        ],
      },
      {
        id: "nutrition-schema",
        title: "Nutrition schema & math",
        kind: "group",
        tagline: "v5/v6 migrations, calculations",
        files: [
          "src/data/nutritionMigration.ts",
          "src/data/nutritionRepository.ts",
          "src/nutrition/calculations.ts",
        ],
        summary: "Versioned meal/custom/favourite/saved-meal tables and nutrient math. Schema details live in the Database tree.",
        links: ["database:migrations"],
        versions: [
          {
            n: 1,
            name: "Meal tables",
            date: "2026-07-28 19:39 -0400",
            commits: ["241f556"],
            changes: ["First `meal_logs` / `meal_items` (USDA `fdc_id`)."],
          },
          {
            n: 2,
            name: "Nutrition v5",
            date: "2026-10-03 22:47 -0400",
            commits: ["884864f", "ece0620"],
            changes: [
              "Versioned catalog schema (`884864f`). Finished a migration that stopped before its tables existed (`ece0620`).",
            ],
          },
          {
            n: 3,
            name: "Favourites snapshots",
            date: "2026-10-04 23:29 -0400",
            commits: ["dde7751", "3ff3e8a", "20a5fbb"],
            changes: [
              "Favourite snapshots so starred foods reopen (`dde7751`). Verify meal edits (`3ff3e8a`). Filled contrast fields (`20a5fbb`).",
            ],
          },
        ],
      },
    ],
  },
};
