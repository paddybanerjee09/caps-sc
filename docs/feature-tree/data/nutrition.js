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
    "n": 1,
    "name": "Nutrition",
    "date": "2026-07-02 00:35 -0400",
    "commits": [
      "e9ddbfb",
      "f0f5834"
    ],
    "changes": [
      "Boilerplate Nutrition tab, then custom-nav placeholder in `Screens.tsx`."
    ]
  },
  {
    "n": 2,
    "name": "NutritionScreen",
    "date": "2026-07-22 02:53 -0400",
    "commits": [
      "edd48ce",
      "ad01bfe"
    ],
    "changes": [
      "Own file, then centered title."
    ]
  },
  {
    "n": 3,
    "name": "NutritionScreen",
    "date": "2026-07-30 14:23 -0400",
    "commits": [
      "241f556",
      "a269579",
      "e8fc8e9"
    ],
    "changes": [
      "Diary and caloric/macronutrient card (`241f556`, `a269579`). Collapsible meal sections (`e8fc8e9`)."
    ]
  },
  {
    "n": 4,
    "name": "NutritionScreen",
    "date": "2026-10-04 18:49 -0400",
    "commits": [
      "1d7f792",
      "6ccb251"
    ],
    "changes": [
      "Opened the full-screen composer instead of `MealLogModal` (`1d7f792`).",
      "Stopped reloading meals on unrelated workspace updates (`6ccb251`)."
    ]
  },
  {
    "n": 5,
    "name": "NutritionScreen",
    "date": "2026-11-02 22:58 -0500",
    "commits": [
      "c8ddb63",
      "9917cee"
    ],
    "changes": [
      "Idle deferred loads (`c8ddb63`). Card-by-card diary renovation (`9917cee`)."
    ]
  },
  {
    "n": 6,
    "name": "NutritionScreen",
    "date": "2026-11-22 00:29 -0500",
    "commits": [
      "40f02f4"
    ],
    "request": "Remove filler copy throughout CAPS and compact Recovery/questionnaire/Progress.",
    "changes": [
      "Remove generic subtitle and standardize missing nutrient values to --.",
      "Presentation only; data, calculations and validation remain."
    ]
  },
  {
    "n": 7,
    "name": "NutritionScreen",
    "date": "2026-11-22 11:32 -0500",
    "commits": [
      "75c7dd4"
    ],
    "request": "Revise questionnaire controls/history/SRI, readable dates and Progress overlay/navigation/legend/axes.",
    "changes": [
      "Use shared human-readable diary dates; keep ISO query keys."
    ]
  }
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
          {
            "n": 4,
            "name": "Logged meals diary",
            "date": "2026-11-23 12:47 -0500",
            "commits": [
              "8225102"
            ],
            "request": "Centralize biometric editing in modals, use intuitive date/settings navigation, and share training hub components.",
            "changes": [
              "Use icon-library chevrons for previous/next-day navigation while preserving selected-day meal loading."
            ]
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
              "Composer for one `MealDraft`. A title input sits above embedded compact meal totals in one card. The Meal Items card contains informative editable food rows and Saved Meals browsing; the fixed footer saves or unsaves the current template alongside diary actions. Replaced `MealLogModal`.",
            modes: [
              { name: "New meal", detail: "`openNewMeal(day)`." },
              { name: "Edit logged meal", detail: "`openEditMeal(meal)` from the diary three-dot menu." },
              { name: "Edit saved template", detail: "Opened from Saved Meals." },
            ],
            guardrails: [
              "Keep Add meal item as the focus; meal actions stay on the composer, not a menu modal (0deafb1).",
              "Do not restore `MealLogModal` (1d7f792).",
              "Keep template save/unsave separate from diary logging; validate linked saved IDs against storage and preserve draft contents on failure (24 November 2026 nutrition screen request).",
            ],
            links: ["architecture:log-time-changer", "database:table-meal-logs", "home:quick-log", "nutrition:macro-card"],
            versions: [
  {
    "n": 1,
    "name": "MealLogModal",
    "date": "2026-07-30 14:23 -0400",
    "commits": [
      "241f556",
      "e845b49",
      "bfdcb3a",
      "298f627",
      "3225bb5",
      "e8fc8e9"
    ],
    "changes": [
      "Modal composer with USDA search, servings, planned vs completed, and collapsible sections."
    ]
  },
  {
    "n": 2,
    "name": "MealLogScreen",
    "date": "2026-10-03 22:33 -0400",
    "commits": [
      "4b6db09",
      "1d7f792"
    ],
    "request": "Replace the meal modal with a full-screen nutrition stack.",
    "changes": [
      "Added `MealLogScreen` (`4b6db09`) and switched Nutrition and Home to open it (`1d7f792`)."
    ]
  },
  {
    "n": 3,
    "name": "MealLogScreen",
    "date": "2026-10-05 22:38 -0400",
    "commits": [
      "0deafb1",
      "0627d77",
      "1daf75d",
      "39add05",
      "6397e58"
    ],
    "changes": [
      "Add meal item focus, compact meal totals, filled title fields, compact time pill, saved-template editing."
    ]
  },
  {
    "n": 4,
    "name": "MealLogScreen",
    "date": "2026-11-02 22:58 -0500",
    "commits": [
      "9917cee"
    ],
    "changes": [
      "Card-by-card composer with steppers."
    ]
  },
  {
    "n": 5,
    "name": "MealLogScreen",
    "date": "2026-11-20 17:46 -0500",
    "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
    "changes": [
      "Shared safe header and depth-aware footer; header-only log-time modal.",
      "Direct decimal servings input replaces adjustment buttons."
    ],
    "commits": [
      "20c8b60"
    ]
  },
  {
    "n": 6,
    "name": "MealLogScreen",
    "date": "2026-11-22 00:29 -0500",
    "commits": [
      "40f02f4"
    ],
    "request": "Remove filler copy throughout CAPS and compact Recovery/questionnaire/Progress.",
    "changes": [
      "Shorten empty meal instruction to action label.",
      "Presentation only; data, calculations and validation remain."
    ]
  },
  {
    n: 7,
    name: "Compact meal composer and saved state",
    date: "2026-11-24 18:07 -0500",
    commits: ["41499ce"],
    request: "Combine the meal title and compact nutrition totals, show informative editable logged foods, and replace the Saved Meals footer with Save Meal / Unsave Meal.",
    changes: [
      "Replace Meal Identity and inline Save/Discard controls with one title input above embedded compact totals.",
      "Render LoggedFoodComponent rows with name, portion, scaled calories/macros and a separate left removal target; tapping opens facts with the stored portion.",
      "Move Saved Meals browsing to the Meal Items header; footer Save/Unsave creates, updates or deletes only the reusable template.",
      "Validate saved-template links against storage, clear stale IDs, and protect pending mutations/navigation with retryable save checks."
    ]
  }
],
            children: [
              {
                id: "logged-food-component",
                title: "LoggedFoodComponent",
                kind: "component",
                tagline: "Editable logged-food details and removal",
                files: ["src/components/nutrition/LoggedFoodComponent.tsx"],
                entry: "One row per item in the MealLogScreen Meal Items card.",
                summary: "Shows the food name, configured serving size and quantity-scaled calories/P/C/F. The left X has its own spaced 48px target; the detail area opens Nutrition Facts with the existing serving and amount.",
                links: ["nutrition:nutrition-facts-screen"],
                versions: [{
                  n: 1,
                  name: "LoggedFoodComponent",
                  date: "2026-11-24 18:07 -0500",
                  commits: ["41499ce"],
                  request: "Replace numeric-only logged food rows with name, macros, calories, serving size and tap-to-edit facts.",
                  changes: ["Add a reusable food detail row with scaled nutrition and independent removal and edit targets."]
                }],
              },
              {
                id: "meal-item-screen",
                title: "MealItemScreen",
                kind: "subscreen",
                tagline: "Food picker: all / favourites / custom",
                files: ["src/screens/NutritionScreens/MealItemScreen.tsx"],
                entry: "Add meal item on `MealLogScreen`.",
                summary:
                  "Search FatSecret plus local favourites and custom foods inside one inset scrolling FlatList surface with thin row separators. Compact single-line tabs and Recent/Frequent sorting; barcode icon accompanies the bottom scan action. Opens barcode, custom food, or facts.",
                modes: [
                  { name: "All", detail: "FatSecret search." },
                  { name: "Favourites", detail: "Starred snapshots." },
                  { name: "Custom", detail: "User-created foods." },
                ],
                versions: [
                  {
                    "n": 1,
                    "name": "MealItemScreen",
                    "date": "2026-10-03 22:32 -0400",
                    "commits": [
                      "8731d05"
                    ],
                    "changes": [
                      "Added the food picker with local and FatSecret search."
                    ]
                  },
                  {
                    "n": 2,
                    "name": "MealItemScreen",
                    "date": "2026-10-05 22:38 -0400",
                    "commits": [
                      "f8de697",
                      "fabae46"
                    ],
                    "changes": [
                      "Sort overlay and custom-food edit/delete (`f8de697`). Back bar and prominent create-custom-food (`fabae46`)."
                    ]
                  },
                  {
                    "n": 3,
                    "name": "MealItemScreen",
                    "date": "2026-11-02 22:58 -0500",
                    "commits": [
                      "9917cee"
                    ],
                    "changes": [
                      "Card/stepper renovation."
                    ]
                  },
                  {
                    "n": 4,
                    "name": "Single food usage lookup",
                    "date": "2026-11-16 00:20 -0500",
                    "commits": [
                      "a556a7a"
                    ],
                    "changes": [
                      "Use the ranking query to determine whether usage sorting is available."
                    ]
                  },
                  {
                    "n": 5,
                    "name": "MealItemScreen",
                    "date": "2026-11-20 17:46 -0500",
                    "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
                    "changes": [
                      "Centered title with search below header; X exits branch and footer Back/Cancel uses actual depth."
                    ],
                    "commits": [
                      "20c8b60"
                    ]
                  },
                  {
                    n: 6,
                    name: "Flat food picker",
                    date: "2026-11-24 17:35 -0500",
                    commits: ["80e28c7"],
                    request: "Fit All/Favourites/Custom on one line, shorten sort labels, add the barcode icon and replace individual result cards with a flat scrolling list.",
                    changes: [
                      "Use the optional compact selector presentation with single-line fitting labels and fixed-width sort control.",
                      "Rename usage sorting to Recent/Frequent and add a barcode icon beside Scan Barcode.",
                      "Group result rows in one bordered FlatList panel with hairline separators while retaining search, scroll offsets and custom-food actions.",
                      "Use base-unit defaults for fresh search, known-food and custom selections; preserve explicit favourite and meal-edit portions."
                    ]
                  }
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
                        "n": 1,
                        "name": "BarcodeScanScreen",
                        "date": "2026-10-03 22:33 -0400",
                        "commits": [
                          "4890a26"
                        ],
                        "changes": [
                          "In-screen barcode scanning through Open Food Facts."
                        ]
                      },
                      {
                        "n": 2,
                        "name": "BarcodeScanScreen",
                        "date": "2026-10-05 22:38 -0400",
                        "commits": [
                          "4d8f785",
                          "64d6eb3"
                        ],
                        "changes": [
                          "Clearer barcode prompt (`4d8f785`). Close to nutrition home (`64d6eb3`)."
                        ]
                      },
                      {
                        "n": 3,
                        "name": "BarcodeScanScreen",
                        "date": "2026-11-02 22:58 -0500",
                        "commits": [
                          "9917cee"
                        ],
                        "changes": [
                          "Card renovation."
                        ]
                      },
                      {
                        "n": 4,
                        "name": "BarcodeScanScreen",
                        "date": "2026-11-20 17:46 -0500",
                        "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
                        "changes": [
                          "Shared branch-close header and fixed depth-aware navigation preserve scanning actions."
                        ],
                        "commits": [
                          "20c8b60"
                        ]
                      }
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
                        "n": 1,
                        "name": "CreateCustomFoodScreen",
                        "date": "2026-10-03 22:33 -0400",
                        "commits": [
                          "12b6b40"
                        ],
                        "changes": [
                          "Custom foods with an advisory calorie check."
                        ]
                      },
                      {
                        "n": 2,
                        "name": "CreateCustomFoodScreen",
                        "date": "2026-10-04 23:27 -0400",
                        "commits": [
                          "1041599",
                          "e8925f8",
                          "14c1595"
                        ],
                        "changes": [
                          "Macro row / micro columns (`1041599`). Fresh create form (`e8925f8`). Facts labeled Create Custom Food (`14c1595`)."
                        ]
                      },
                      {
                        "n": 3,
                        "name": "CreateCustomFoodScreen",
                        "date": "2026-11-02 22:58 -0500",
                        "commits": [
                          "9917cee"
                        ],
                        "changes": [
                          "Card/stepper renovation."
                        ]
                      },
                      {
                        "n": 4,
                        "name": "CreateCustomFoodScreen",
                        "date": "2026-11-20 17:46 -0500",
                        "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
                        "changes": [
                          "Direct numeric inputs replace amount/macro presets and steppers.",
                          "Shared top and fixed action bars preserve save/discard behavior."
                        ],
                        "commits": [
                          "20c8b60"
                        ]
                      }
                    ],
                  },
                  {
                    id: "nutrition-facts-screen",
                    title: "NutritionFactsScreen",
                    kind: "subscreen",
                    tagline: "Quantity and overlay Serving units",
                    files: ["src/screens/NutritionScreens/NutritionFactsScreen.tsx"],
                    entry: "Selecting a food in MealItemScreen or an existing LoggedFoodComponent row in MealLogScreen.",
                    summary:
                      "Direct quantity and an anchored Serving units overlay dropdown sit side by side. Regular provider portions are preferred; known-mass foods without one default to 100g. Milligrams are not offered for new selection; historical references remain resolvable. Compatible unit changes retain physical quantity. The ring calorie editor fits changing digit counts without changing values.",
                    guardrails: [
                      "Derive only units supported by known mass or volume; never assume a grams-to-millilitres density or fabricate a physical size for an unmeasured serving (24 November 2026 nutrition screen request).",
                      "Preserve stored item/favourite quantities and serving IDs when opening facts; selecting compatible units must retain the physical portion (24 November 2026 nutrition screen request).",
                    ],
                    links: ["nutrition:macro-card", "nutrition:serving-units"],
                    versions: [
          {
            "n": 1,
            "name": "FoodServingEditor",
            "date": "2026-07-30 13:39 -0400",
            "commits": [
              "298f627"
            ],
            "changes": [
              "Editable calorie counter inside the old meal modal."
            ]
          },
          {
            "n": 2,
            "name": "NutritionFactsScreen",
            "date": "2026-10-04 18:59 -0400",
            "commits": [
              "12171e9",
              "c4e6bcb",
              "02ea54a"
            ],
            "changes": [
              "Full-screen facts with exact-serving favourites, initial calories, floating serving dropdown."
            ]
          },
          {
            "n": 3,
            "name": "NutritionFactsScreen",
            "date": "2026-10-05 22:42 -0400",
            "commits": [
              "e5cf05f",
              "59c7ef6"
            ],
            "changes": [
              "Compact macro totals with clearer spacing, then inline P/C/F in the title."
            ]
          },
          {
            "n": 4,
            "name": "NutritionFactsScreen",
            "date": "2026-11-02 22:58 -0500",
            "commits": [
              "9917cee"
            ],
            "changes": [
              "Card/stepper renovation."
            ]
          },
          {
            "n": 5,
            "name": "Single FatSecret default lookup",
            "date": "2026-11-16 00:20 -0500",
            "commits": [
              "a556a7a"
            ],
            "changes": [
              "Find the preferred serving ID once, then match it against normalized servings."
            ]
          },
          {
            "n": 6,
            "name": "NutritionFactsScreen",
            "date": "2026-11-20 17:46 -0500",
            "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
            "changes": [
              "Direct quantity and serving-mass fields retain serving calculations and selected unit.",
              "Shared header/footer preserve save, favourite and delete actions."
            ],
            "commits": [
              "20c8b60"
            ]
          },
          {
            "n": 7,
            "name": "Base-unit nutrition facts",
            "date": "2026-11-24 18:06 -0500",
            "commits": [
              "35ceb0d"
            ],
            "request": "Default metric foods to 1 g/1 mL, expose available serving units and use the compact centered calorie input instead of a duplicate portion card.",
            "changes": [
              "Normalize available mass/volume portions through withServingUnits while retaining original serving IDs and provider portions.",
              "Keep known physical quantities consistent when changing compatible serving units; preserve existing logged/favourite configurations on entry.",
              "Remove Calorie-driven portion; use the smaller macro-ring calorie input with a smaller kcal label."
            ]
          },
          {
            "n": 8,
            "name": "Compact serving-unit dropdown",
            "date": "2026-11-24 23:05 -0500",
            "request": "Refine serving units and default portions, remove milligrams, and fit calorie values through seven digits.",
            "changes": [
              "Replace swipe pills with an anchored, scrollable Serving units overlay beside Quantity.",
              "Prefer regular catalog portions and 100g known-mass fallback; exclude mg from new choices.",
              "Preserve exact historical servings, compatible physical amounts, and Back/action navigation."
            ],
            "commits": [
              "24084a6"
            ]
          },
          {
            "n": 9,
            "name": "Unique serving-unit display choices",
            "date": "2026-11-25 00:19 -0500",
            "commits": [
              "4c9b2fa"
            ],
            "changes": [
              "Pass the selected serving ID to display dedup so an identical derived/provider portion appears once without switching the configured food.",
              "Android verified one 100g choice while selected 1kg, quantity 1000 and 1,000,000 calories survived reload."
            ]
          }
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
                entry: "Saved Meals in the MealLogScreen Meal Items card header.",
                summary: "List of `saved_meals` templates, separate from diary logs. Edit/delete on the list. Opening one loads the composer.",
                versions: [
                  {
                    "n": 1,
                    "name": "SavedMealsScreen",
                    "date": "2026-10-03 22:32 -0400",
                    "commits": [
                      "4c6b3f1"
                    ],
                    "changes": [
                      "Reusable saved meals separate from the diary."
                    ]
                  },
                  {
                    "n": 2,
                    "name": "SavedMealsScreen",
                    "date": "2026-10-05 22:38 -0400",
                    "commits": [
                      "9b8f6e2",
                      "3b34380",
                      "7c98213",
                      "a553465"
                    ],
                    "changes": [
                      "Update/delete APIs, template drafts, workspace open, and list edit/delete controls."
                    ]
                  },
                  {
                    "n": 3,
                    "name": "SavedMealsScreen",
                    "date": "2026-11-02 22:58 -0500",
                    "commits": [
                      "9917cee"
                    ],
                    "changes": [
                      "Card renovation."
                    ]
                  },
                  {
                    "n": 4,
                    "name": "Shared saved template conversion",
                    "date": "2026-11-16 00:20 -0500",
                    "commits": [
                      "a556a7a"
                    ],
                    "changes": [
                      "Use one draft converter for editing and inserting a template.",
                      "Reload once after deletion and ignore obsolete refresh results."
                    ]
                  },
                  {
                    "n": 5,
                    "name": "SavedMealsScreen",
                    "date": "2026-11-20 17:46 -0500",
                    "request": "Audit all five tabs: simple weight input, compact scrolling log-time modal, safe consistent subscreen bars and branch navigation.",
                    "changes": [
                      "Shared safe header and fixed depth-aware footer retain template actions."
                    ],
                    "commits": [
                      "20c8b60"
                    ]
                  },
                  {
                    n: 6,
                    name: "Saved Meals browsing entry",
                    date: "2026-11-24 18:07 -0500",
                    commits: ["41499ce"],
                    request: "Repurpose the composer Saved Meals footer action as a Save Meal / Unsave Meal state control.",
                    changes: ["Keep template browsing accessible from the Meal Items card header while the footer reflects the current composition's saved state."]
                  }
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
        files: [
          "src/components/MacronutrientBreakdownCard.tsx",
          "src/components/nutrition/calorieText.ts"
        ],
        summary:
          "Full/compact/embedded macro totals retain their layouts. Calorie values and editable ring inputs fit their available width through seven digits using displayed character count and system font scale; numeric values are never shortened or changed. Expandable micronutrients and existing calorie-driven quantity calculation remain.",
        modes: [
          { name: "Full", detail: "Diary: rings/bars plus expandable micro list." },
          { name: "Compact", detail: "Nested screens; macros in the header (`13b3d68`, `59c7ef6`)." },
          { name: "Embedded", detail: "Composer title group; compact content without an extra bordered card." },
        ],
        versions: [
          {
            "n": 1,
            "name": "MacronutrientBreakdownCard",
            "date": "2026-07-29 15:20 -0400",
            "commits": [
              "a269579",
              "bfdcb3a"
            ],
            "changes": [
              "Added the card and extracted it as a reusable component."
            ]
          },
          {
            "n": 2,
            "name": "MacronutrientBreakdownCard",
            "date": "2026-10-05 22:42 -0400",
            "commits": [
              "f20a3b3",
              "13b3d68",
              "59c7ef6"
            ],
            "changes": [
              "Micronutrients moved into the card (`f20a3b3`). Compact variant, then inline P/C/F in the title."
            ]
          },
          {
            "n": 3,
            "name": "MacronutrientBreakdownCard",
            "date": "2026-11-02 22:58 -0500",
            "commits": [
              "9917cee"
            ],
            "changes": [
              "Card-by-card restyle."
            ]
          },
          {
            "n": 4,
            "name": "Compact embedded nutrition summary",
            "date": "2026-11-24 18:06 -0500",
            "commits": [
              "35ceb0d"
            ],
            "request": "Keep composer nutrition compact beneath its title and shrink/center the facts calorie text box and kcal label.",
            "changes": [
              "Remove nested card borders/padding with optional embedded framing for the existing compact summary.",
              "Reduce and center the calorie input with a smaller kcal label, preserving the default full diary presentation."
            ]
          },
          {
            "n": 5,
            "name": "Fitting calorie digits",
            "date": "2026-11-24 23:05 -0500",
            "request": "Refine serving units and default portions, remove milligrams, and fit calorie values through seven digits.",
            "changes": [
              "Fit input and display calorie text as digit count grows through seven digits.",
              "Account for grouping, incomplete markers and font scale while preserving numeric values."
            ],
            "commits": [
              "24084a6"
            ]
          }
        ],

        guardrails: [
          "Fit calorie digits rather than abbreviating or changing the value to avoid overflow (user correction, 24 November 2026)."
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
          "Shared by MealItem tabs and Home's Today/Recovery/Progress. Animation is transform/opacity, not per-frame layout state. An optional compact presentation fits the food-picker labels on a single line; other callers retain their default styling.",
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
          {
            n: 4,
            name: "Compact single-line food tabs",
            date: "2026-11-24 17:35 -0500",
            commits: ["80e28c7"],
            request: "Fit All/Favourites/Custom without text wrapping.",
            changes: ["Add an opt-in compact label and padding treatment with single-line fitting text; retain existing selector defaults and animation."]
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
        summary: "Catalog resolver over FatSecret search and Open Food Facts barcodes. Custom foods are local. Resolved and session-cached foods expose compatible derived units through the shared serving helper, preserving original provider portions.",
        links: ["nutrition:serving-units"],
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
          {
            n: 2,
            name: "Normalized serving catalog",
            date: "2026-11-24 18:06 -0500",
            commits: ["35ceb0d"],
            request: "Expose available base units and compatible portion choices consistently across foods.",
            changes: ["Apply withServingUnits to custom, resolved and remembered catalog foods so reference-backed logged items can resolve stable derived serving IDs."]
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
          "src/data/nutritionCatalogRepository.ts",
          "src/nutrition/drafts.ts",
          "src/nutrition/calculations.ts",
        ],
        summary: "Versioned meal/custom/favourite/saved-meal tables and nutrient math. Schema details live in the Database tree.",
        links: ["database:migrations"],
        children: [
          {
            id: "serving-units",
            title: "Serving-unit normalization",
            kind: "logic",
            tagline: "Known mass/volume portions and compatible conversions",
            files: ["src/nutrition/servings.ts"],
            summary: "withServingUnits retains original portions, derives compatible units from known mass/volume and prefers regular provider/custom portions. Known-mass foods without a real portion use deterministic 100g fallback; volume-only foods never gain grams. servingUnitOptions excludes mg and deduplicates identical display choices while preserving the selected/default ID; canonical servings and legacy IDs remain resolvable. Repeated old gram-default normalization remains stable.",
            guardrails: [
              "Never infer density between mass and volume or assign grams to an unmeasured piece/serving; preserve supplied portions when no physical basis exists (24 November 2026 nutrition screen request).",
              "Keep original serving IDs and avoid accumulating duplicate derived options when normalizing an already normalized catalog (24 November 2026 nutrition screen request).",
              "Collapse only display-identical unit choices while retaining the selected/default ID and all canonical history IDs; preserve distinct labels or nutrient payloads (25 November 2026 Android duplicate-choice correction).",
            ],
            links: ["nutrition:nutrition-services", "nutrition:nutrition-facts-screen"],
            versions: [
          {
            "n": 1,
            "name": "Serving-unit normalization",
            "date": "2026-11-24 18:06 -0500",
            "commits": [
              "35ceb0d"
            ],
            "request": "Measure and log foods in base units and offer available compatible serving sizes.",
            "changes": [
              "Derive nutrient-scaled mass and volume units from known portions, retain original servings, and use base metric defaults.",
              "Convert existing quantities between compatible units without changing the configured physical amount."
            ]
          },
          {
            "n": 2,
            "name": "Regular portions and 100g fallback",
            "date": "2026-11-24 23:05 -0500",
            "request": "Refine serving units and default portions, remove milligrams, and fit calorie values through seven digits.",
            "changes": [
              "Preserve regular catalog portions rather than replacing every default with 1g/1mL.",
              "Add stable 100g mass fallback and hide milligrams from new unit choices.",
              "Retain historical reference IDs, precise conversions and idempotent normalization."
            ],
            "commits": [
              "24084a6"
            ]
          },
          {
            "n": 3,
            "name": "Preserve IDs while deduplicating display choices",
            "date": "2026-11-25 00:19 -0500",
            "commits": [
              "4c9b2fa"
            ],
            "changes": [
              "Deduplicate only identical normalized labels, physical amount/unit, nutrients and extras; selected ID wins, otherwise default ID.",
              "Keep canonical servings and historical IDs unchanged, and retain different household labels or nutrient payloads."
            ]
          }
        ],
          },
        ],
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
          {
            "n": 4,
            "name": "Precise portions and safe saved-meal replay",
            "date": "2026-11-24 18:06 -0500",
            "commits": [
              "35ceb0d"
            ],
            "request": "Preserve base-unit portions and allow safe Save/Unsave without affecting diary meals.",
            "changes": [
              "Keep fractional diary quantities and small converted amounts as usable decimal inputs.",
              "Validate committed saved-meal receipts against existing rows, including retry recovery after deletion; failed inserts cannot return a deleted result.",
              "Verify template-item cascade deletion, independent diary survival, re-saving and reference-serving restoration without a schema migration."
            ]
          },
        ],
      },
    ],
  },
};
