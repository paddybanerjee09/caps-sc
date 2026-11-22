# Feature Tree crosswalk

Snapshot of the eight trees in `docs/feature-tree/data/` at baseline `e492e06`. Open the node for its modes, guardrails, dependencies, and version history. For product behavior, use the domain note and current source. Archived and planned nodes are discoverable here for historical and roadmap questions.

- [[App Architecture]] · 21 nodes, 45 versions
- [[Data and Persistence]] · 23 nodes, 30 versions
- [[Home]] · 12 nodes, 27 versions
- [[Nutrition]] · 15 nodes, 42 versions
- [[Conditioning]] · 19 nodes, 37 versions
- [[Strength]] · 14 nodes, 33 versions
- [[Skills Training]] · 6 nodes, 11 versions
- [[Settings]] · 12 nodes, 27 versions

## Architecture

[[App Architecture]]

| Feature Tree node | ID | Parent path | Tree status or reference | Versions |
| --- | --- | --- | --- | ---: |
| [App](../../docs/feature-tree/architecture.html#app-root) | `app-root` | — | active | 4 |
| [AppNavigator](../../docs/feature-tree/architecture.html#app-navigator) | `app-navigator` | App | active | 3 |
| [Header](../../docs/feature-tree/architecture.html#header) | `header` | App / AppNavigator | active | 3 |
| [Screen](../../docs/feature-tree/architecture.html#screen-wrapper) | `screen-wrapper` | App / AppNavigator | active | 3 |
| [BottomTabs](../../docs/feature-tree/architecture.html#bottom-tabs) | `bottom-tabs` | App / AppNavigator | active | 3 |
| [Sidebar](../../docs/feature-tree/architecture.html#sidebar) | `sidebar` | App / AppNavigator | active | 3 |
| [nav-nutrition-stack](../../docs/feature-tree/architecture.html#nav-nutrition-stack) | `nav-nutrition-stack` | App / AppNavigator | `nutrition:nutrition-stack` ref | — |
| [nav-conditioning-stack](../../docs/feature-tree/architecture.html#nav-conditioning-stack) | `nav-conditioning-stack` | App / AppNavigator | `conditioning:conditioning-stack` ref | — |
| [routes.ts + Screens.tsx](../../docs/feature-tree/architecture.html#routes) | `routes` | App | active | 2 |
| [Shared controls](../../docs/feature-tree/architecture.html#shared-controls) | `shared-controls` | App | active | — |
| [PressOpacity](../../docs/feature-tree/architecture.html#press-opacity) | `press-opacity` | App / Shared controls | active | 2 |
| [SimpleSwitch](../../docs/feature-tree/architecture.html#simple-switch) | `simple-switch` | App / Shared controls | active | 2 |
| [LogTimeChanger](../../docs/feature-tree/architecture.html#log-time-changer) | `log-time-changer` | App / Shared controls | active | 3 |
| [AppStateContext](../../docs/feature-tree/architecture.html#app-state) | `app-state` | App | active | 4 |
| [Theme](../../docs/feature-tree/architecture.html#theme) | `theme` | App | active | 3 |
| [feedback.ts](../../docs/feature-tree/architecture.html#feedback-engine) | `feedback-engine` | App | active | 1 |
| [scheduleIdleTask](../../docs/feature-tree/architecture.html#schedule-idle-task) | `schedule-idle-task` | App | active | 1 |
| [README.md](../../docs/feature-tree/architecture.html#project-readme) | `project-readme` | App | active | 1 |
| [UI style guide](../../docs/feature-tree/architecture.html#style-guide) | `style-guide` | App | active | 2 |
| [Feature tree site](../../docs/feature-tree/architecture.html#feature-tree-site) | `feature-tree-site` | App | active | 1 |
| [Reverted shared UI (Sep 14 - Sep 25, 2026)](../../docs/feature-tree/architecture.html#arch-v1-archive) | `arch-v1-archive` | App | reverted | 4 |

## Database

[[Data and Persistence]]

| Feature Tree node | ID | Parent path | Tree status or reference | Versions |
| --- | --- | --- | --- | ---: |
| [caps.db](../../docs/feature-tree/database.html#caps-db) | `caps-db` | — | active | 2 |
| [migrateDatabase](../../docs/feature-tree/database.html#migrations) | `migrations` | caps.db | active | 4 |
| [timeline_entries](../../docs/feature-tree/database.html#table-timeline-entries) | `table-timeline-entries` | caps.db | active | 1 |
| [weight_logs](../../docs/feature-tree/database.html#table-weight-logs) | `table-weight-logs` | caps.db | active | 1 |
| [sleep_schedules](../../docs/feature-tree/database.html#table-sleep-schedules) | `table-sleep-schedules` | caps.db | active | 1 |
| [meal_logs](../../docs/feature-tree/database.html#table-meal-logs) | `table-meal-logs` | caps.db | active | 2 |
| [meal_items](../../docs/feature-tree/database.html#table-meal-items) | `table-meal-items` | caps.db | active | 2 |
| [nutrition_operations](../../docs/feature-tree/database.html#table-nutrition-operations) | `table-nutrition-operations` | caps.db | active | 1 |
| [custom_foods](../../docs/feature-tree/database.html#table-custom-foods) | `table-custom-foods` | caps.db | active | 1 |
| [food_favourites](../../docs/feature-tree/database.html#table-food-favourites) | `table-food-favourites` | caps.db | active | 2 |
| [saved_meals](../../docs/feature-tree/database.html#table-saved-meals) | `table-saved-meals` | caps.db | active | 1 |
| [saved_meal_items](../../docs/feature-tree/database.html#table-saved-meal-items) | `table-saved-meal-items` | caps.db | active | 1 |
| [nutrition_workspace](../../docs/feature-tree/database.html#table-nutrition-workspace) | `table-nutrition-workspace` | caps.db | active | 1 |
| [conditioning_owner](../../docs/feature-tree/database.html#table-conditioning-owner) | `table-conditioning-owner` | caps.db | active | 1 |
| [conditioning_templates](../../docs/feature-tree/database.html#table-conditioning-templates) | `table-conditioning-templates` | caps.db | active | 1 |
| [conditioning_template_stations](../../docs/feature-tree/database.html#table-conditioning-template-stations) | `table-conditioning-template-stations` | caps.db | active | 1 |
| [conditioning_sessions](../../docs/feature-tree/database.html#table-conditioning-sessions) | `table-conditioning-sessions` | caps.db | active | 1 |
| [conditioning_segments](../../docs/feature-tree/database.html#table-conditioning-segments) | `table-conditioning-segments` | caps.db | active | 1 |
| [conditioning_location_points](../../docs/feature-tree/database.html#table-conditioning-location-points) | `table-conditioning-location-points` | caps.db | active | 1 |
| [conditioning_occurrences](../../docs/feature-tree/database.html#table-conditioning-occurrences) | `table-conditioning-occurrences` | caps.db | active | 1 |
| [conditioning_splits](../../docs/feature-tree/database.html#table-conditioning-splits) | `table-conditioning-splits` | caps.db | active | 1 |
| [conditioning_upload_jobs](../../docs/feature-tree/database.html#table-conditioning-upload-jobs) | `table-conditioning-upload-jobs` | caps.db | active | 1 |
| [conditioning_runner_state](../../docs/feature-tree/database.html#table-conditioning-runner-state) | `table-conditioning-runner-state` | caps.db | active | 1 |

## Home

[[Home]]

| Feature Tree node | ID | Parent path | Tree status or reference | Versions |
| --- | --- | --- | --- | ---: |
| [HomeScreen](../../docs/feature-tree/home.html#home-screen) | `home-screen` | — | active | 7 |
| [Athlete telemetry](../../docs/feature-tree/home.html#athlete-telemetry) | `athlete-telemetry` | HomeScreen | active | 2 |
| [Quick Log](../../docs/feature-tree/home.html#quick-log) | `quick-log` | HomeScreen | active | 3 |
| [WeightLogModal](../../docs/feature-tree/home.html#weight-log) | `weight-log` | HomeScreen / Quick Log | active | 5 |
| [weight-log-time](../../docs/feature-tree/home.html#weight-log-time) | `weight-log-time` | HomeScreen / Quick Log / WeightLogModal | `architecture:log-time-changer` ref | — |
| [SleepLogModal](../../docs/feature-tree/home.html#sleep-log) | `sleep-log` | HomeScreen / Quick Log | active | 2 |
| [sleep-log-time](../../docs/feature-tree/home.html#sleep-log-time) | `sleep-log-time` | HomeScreen / Quick Log / SleepLogModal | `architecture:log-time-changer` ref | — |
| [quick-log-meal](../../docs/feature-tree/home.html#quick-log-meal) | `quick-log-meal` | HomeScreen / Quick Log | `nutrition:meal-log-screen` ref | — |
| [Today / Recovery / Progress](../../docs/feature-tree/home.html#home-sections) | `home-sections` | HomeScreen | active | 2 |
| [DayTimeline](../../docs/feature-tree/home.html#day-timeline) | `day-timeline` | HomeScreen / Today / Recovery / Progress | active | 4 |
| [Recovery](../../docs/feature-tree/home.html#recovery-panel) | `recovery-panel` | HomeScreen / Today / Recovery / Progress | placeholder | 1 |
| [Progress](../../docs/feature-tree/home.html#progress-panel) | `progress-panel` | HomeScreen / Today / Recovery / Progress | placeholder | 1 |

## Nutrition

[[Nutrition]]

| Feature Tree node | ID | Parent path | Tree status or reference | Versions |
| --- | --- | --- | --- | ---: |
| [NutritionScreen](../../docs/feature-tree/nutrition.html#nutrition-screen) | `nutrition-screen` | — | active | 5 |
| [Logged meals diary](../../docs/feature-tree/nutrition.html#nutrition-diary) | `nutrition-diary` | NutritionScreen | active | 3 |
| [MealLogScreen](../../docs/feature-tree/nutrition.html#meal-log-screen) | `meal-log-screen` | NutritionScreen / Logged meals diary | active | 4 |
| [MealItemScreen](../../docs/feature-tree/nutrition.html#meal-item-screen) | `meal-item-screen` | NutritionScreen / Logged meals diary / MealLogScreen | active | 3 |
| [BarcodeScanScreen](../../docs/feature-tree/nutrition.html#barcode-scan-screen) | `barcode-scan-screen` | NutritionScreen / Logged meals diary / MealLogScreen / MealItemScreen | active | 3 |
| [CreateCustomFoodScreen](../../docs/feature-tree/nutrition.html#create-custom-food-screen) | `create-custom-food-screen` | NutritionScreen / Logged meals diary / MealLogScreen / MealItemScreen | active | 3 |
| [NutritionFactsScreen](../../docs/feature-tree/nutrition.html#nutrition-facts-screen) | `nutrition-facts-screen` | NutritionScreen / Logged meals diary / MealLogScreen / MealItemScreen | active | 4 |
| [SavedMealsScreen](../../docs/feature-tree/nutrition.html#saved-meals-screen) | `saved-meals-screen` | NutritionScreen / Logged meals diary / MealLogScreen | active | 3 |
| [MacronutrientBreakdownCard](../../docs/feature-tree/nutrition.html#macro-card) | `macro-card` | NutritionScreen | active | 3 |
| [NutritionStack](../../docs/feature-tree/nutrition.html#nutrition-stack) | `nutrition-stack` | NutritionScreen | active | 1 |
| [NutritionWorkspaceContext](../../docs/feature-tree/nutrition.html#nutrition-workspace) | `nutrition-workspace` | NutritionScreen | active | 1 |
| [SegmentedSelector](../../docs/feature-tree/nutrition.html#segmented-selector) | `segmented-selector` | NutritionScreen | active | 3 |
| [Food providers](../../docs/feature-tree/nutrition.html#nutrition-services) | `nutrition-services` | NutritionScreen | active | 1 |
| [foodDataCentralApi](../../docs/feature-tree/nutrition.html#usda-client) | `usda-client` | NutritionScreen / Food providers | removed | 2 |
| [Nutrition schema & math](../../docs/feature-tree/nutrition.html#nutrition-schema) | `nutrition-schema` | NutritionScreen | active | 3 |

## Conditioning

[[Conditioning]]

| Feature Tree node | ID | Parent path | Tree status or reference | Versions |
| --- | --- | --- | --- | ---: |
| [ConditioningScreen](../../docs/feature-tree/conditioning.html#conditioning-screen) | `conditioning-screen` | — | active | 5 |
| [MonthlyTimelineComponent](../../docs/feature-tree/conditioning.html#monthly-calendar) | `monthly-calendar` | ConditioningScreen | active | 2 |
| [Selected-day sessions](../../docs/feature-tree/conditioning.html#day-sessions) | `day-sessions` | ConditioningScreen | active | 1 |
| [ConditioningSessionDetailScreen](../../docs/feature-tree/conditioning.html#session-detail) | `session-detail` | ConditioningScreen / Selected-day sessions | active | 2 |
| [FreeConditioningSessionScreen](../../docs/feature-tree/conditioning.html#free-session) | `free-session` | ConditioningScreen | active | 2 |
| [CreateConditioningSessionScreen](../../docs/feature-tree/conditioning.html#create-session) | `create-session` | ConditioningScreen | active | 2 |
| [StationEditorScreen](../../docs/feature-tree/conditioning.html#station-editor) | `station-editor` | ConditioningScreen / CreateConditioningSessionScreen | active | 2 |
| [LogConditioningSessionScreen](../../docs/feature-tree/conditioning.html#log-session) | `log-session` | ConditioningScreen / CreateConditioningSessionScreen | active | 2 |
| [log-session-time](../../docs/feature-tree/conditioning.html#log-session-time) | `log-session-time` | ConditioningScreen / CreateConditioningSessionScreen / LogConditioningSessionScreen | `architecture:log-time-changer` ref | — |
| [WorkoutRunnerScreen](../../docs/feature-tree/conditioning.html#workout-runner) | `workout-runner` | ConditioningScreen / CreateConditioningSessionScreen | active | 2 |
| [ConditioningAdaptationsScreen](../../docs/feature-tree/conditioning.html#emphasis-screen) | `emphasis-screen` | ConditioningScreen / CreateConditioningSessionScreen | active | 2 |
| [SavedWorkoutGrid](../../docs/feature-tree/conditioning.html#saved-workouts) | `saved-workouts` | ConditioningScreen | active | 2 |
| [SavedConditioningSessionScreen](../../docs/feature-tree/conditioning.html#saved-session-screen) | `saved-session-screen` | ConditioningScreen / SavedWorkoutGrid | active | 2 |
| [ConditioningStack](../../docs/feature-tree/conditioning.html#conditioning-stack) | `conditioning-stack` | ConditioningScreen | active | 1 |
| [ConditioningWorkspaceContext](../../docs/feature-tree/conditioning.html#conditioning-workspace) | `conditioning-workspace` | ConditioningScreen | active | 1 |
| [ConfirmDialog](../../docs/feature-tree/conditioning.html#confirm-dialog) | `confirm-dialog` | ConditioningScreen | active | 2 |
| [Conditioning engine](../../docs/feature-tree/conditioning.html#conditioning-engine) | `conditioning-engine` | ConditioningScreen | active | 1 |
| [Planned conditioning](../../docs/feature-tree/conditioning.html#conditioning-planned) | `conditioning-planned` | ConditioningScreen | planned | 2 |
| [Reverted Conditioning v1 (Aug 2 - Sep 25, 2026)](../../docs/feature-tree/conditioning.html#conditioning-v1-archive) | `conditioning-v1-archive` | ConditioningScreen | reverted | 4 |

## Strength

[[Strength]]

| Feature Tree node | ID | Parent path | Tree status or reference | Versions |
| --- | --- | --- | --- | ---: |
| [StrengthTrainingScreen](../../docs/feature-tree/strength.html#strength-screen) | `strength-screen` | — | placeholder | 6 |
| [Planned strength work](../../docs/feature-tree/strength.html#strength-planned) | `strength-planned` | StrengthTrainingScreen | planned | 2 |
| [Reverted Strength v1 (Sep 14 - Sep 25, 2026)](../../docs/feature-tree/strength.html#strength-v1-archive) | `strength-v1-archive` | StrengthTrainingScreen | reverted | 4 |
| [MonthTimeline](../../docs/feature-tree/strength.html#v1-month-timeline) | `v1-month-timeline` | StrengthTrainingScreen / Reverted Strength v1 (Sep 14 - Sep 25, 2026) | reverted | 1 |
| [SavedStrengthWorkouts](../../docs/feature-tree/strength.html#v1-saved-workouts) | `v1-saved-workouts` | StrengthTrainingScreen / Reverted Strength v1 (Sep 14 - Sep 25, 2026) | reverted | 3 |
| [LogStrengthSessionConfirmationModal](../../docs/feature-tree/strength.html#v1-log-confirmation) | `v1-log-confirmation` | StrengthTrainingScreen / Reverted Strength v1 (Sep 14 - Sep 25, 2026) / SavedStrengthWorkouts | reverted | 1 |
| [SessionActionMenu](../../docs/feature-tree/strength.html#v1-session-actions) | `v1-session-actions` | StrengthTrainingScreen / Reverted Strength v1 (Sep 14 - Sep 25, 2026) | reverted | 2 |
| [CreateStrengthSessionModal](../../docs/feature-tree/strength.html#v1-create-session) | `v1-create-session` | StrengthTrainingScreen / Reverted Strength v1 (Sep 14 - Sep 25, 2026) | reverted | 3 |
| [ExerciseSearchModal](../../docs/feature-tree/strength.html#v1-exercise-search) | `v1-exercise-search` | StrengthTrainingScreen / Reverted Strength v1 (Sep 14 - Sep 25, 2026) / CreateStrengthSessionModal | reverted | 2 |
| [StrengthExerciseEditorModal](../../docs/feature-tree/strength.html#v1-exercise-editor) | `v1-exercise-editor` | StrengthTrainingScreen / Reverted Strength v1 (Sep 14 - Sep 25, 2026) / CreateStrengthSessionModal | reverted | 2 |
| [StrengthSessionDetailModal](../../docs/feature-tree/strength.html#v1-session-detail) | `v1-session-detail` | StrengthTrainingScreen / Reverted Strength v1 (Sep 14 - Sep 25, 2026) | reverted | 1 |
| [StrengthAdaptationModal](../../docs/feature-tree/strength.html#v1-adaptation) | `v1-adaptation` | StrengthTrainingScreen / Reverted Strength v1 (Sep 14 - Sep 25, 2026) | reverted | 1 |
| [Strength engine (reverted)](../../docs/feature-tree/strength.html#v1-strength-engine) | `v1-strength-engine` | StrengthTrainingScreen / Reverted Strength v1 (Sep 14 - Sep 25, 2026) | reverted | 3 |
| [exerciseDbApi](../../docs/feature-tree/strength.html#v1-exercisedb) | `v1-exercisedb` | StrengthTrainingScreen / Reverted Strength v1 (Sep 14 - Sep 25, 2026) / Strength engine (reverted) | reverted | 2 |

## Skills Training

[[Skills Training]]

| Feature Tree node | ID | Parent path | Tree status or reference | Versions |
| --- | --- | --- | --- | ---: |
| [SkillTrainingScreen](../../docs/feature-tree/skill.html#skill-screen) | `skill-screen` | — | active | 6 |
| [MonthlyTimelineComponent](../../docs/feature-tree/skill.html#skill-month) | `skill-month` | SkillTrainingScreen | ref `conditioning:monthly-calendar` | — |
| [SkillSessionBuilderScreen](../../docs/feature-tree/skill.html#skill-builder) | `skill-builder` | SkillTrainingScreen | active | 1 |
| [SkillSessionDetailScreen](../../docs/feature-tree/skill.html#skill-detail) | `skill-detail` | SkillTrainingScreen | active | 1 |
| [Skill calorie model](../../docs/feature-tree/skill.html#skill-energy) | `skill-energy` | SkillTrainingScreen | active | 1 |
| [Unbuilt skill planning](../../docs/feature-tree/skill.html#skill-planned) | `skill-planned` | SkillTrainingScreen | planned | 2 |

## Settings

[[Settings]]

| Feature Tree node | ID | Parent path | Tree status or reference | Versions |
| --- | --- | --- | --- | ---: |
| [Sidebar screens](../../docs/feature-tree/settings.html#settings-root) | `settings-root` | — | active | 2 |
| [SettingsScreen](../../docs/feature-tree/settings.html#settings-screen) | `settings-screen` | Sidebar screens | active | 5 |
| [Appearance & contrast](../../docs/feature-tree/settings.html#appearance-card) | `appearance-card` | Sidebar screens / SettingsScreen | active | 2 |
| [Measurement units](../../docs/feature-tree/settings.html#units-card) | `units-card` | Sidebar screens / SettingsScreen | active | 3 |
| [Audio cues & haptics](../../docs/feature-tree/settings.html#feedback-card) | `feedback-card` | Sidebar screens / SettingsScreen | active | 1 |
| [Notifications & reminders](../../docs/feature-tree/settings.html#reminders-card) | `reminders-card` | Sidebar screens / SettingsScreen | placeholder | 2 |
| [AccountInfoScreen](../../docs/feature-tree/settings.html#account-info-screen) | `account-info-screen` | Sidebar screens | active | 3 |
| [Active account telemetry](../../docs/feature-tree/settings.html#account-telemetry) | `account-telemetry` | Sidebar screens / AccountInfoScreen | active | 1 |
| [Username & callsign](../../docs/feature-tree/settings.html#callsign-card) | `callsign-card` | Sidebar screens / AccountInfoScreen | active | 1 |
| [AthleteInfoScreen](../../docs/feature-tree/settings.html#athlete-info-screen) | `athlete-info-screen` | Sidebar screens | active | 4 |
| [Biometric overview](../../docs/feature-tree/settings.html#biometric-overview) | `biometric-overview` | Sidebar screens / AthleteInfoScreen | active | 1 |
| [Athlete fields](../../docs/feature-tree/settings.html#athlete-fields) | `athlete-fields` | Sidebar screens / AthleteInfoScreen | active | 2 |

## Recovery and Progress update (21 November 2026)

The tables above remain the historical baseline snapshot. Current implementation: [[Recovery and Progress]]; evidence and unrun native acceptance: [[2026-11-21 Recovery and Progress Handoff]]. Existing Home nodes are now active implementation (not physical-device verification).

| Current node | Canonical ID | Parent |
| --- | --- | --- |
| [Recovery](../../docs/feature-tree/home.html#recovery-panel) | `home:recovery-panel` | Home sections |
| [Morning questionnaire](../../docs/feature-tree/home.html#morning-questionnaire) | `home:morning-questionnaire` | Recovery |
| [Progress](../../docs/feature-tree/home.html#progress-panel) | `home:progress-panel` | Home sections |
| [Recovery storage and eight tables](../../docs/feature-tree/database.html#recovery-storage) | `database:recovery-storage` | caps.db v10 |
| [Native Health Adapters](../../docs/feature-tree/architecture.html#health-adapters) | `architecture:health-adapters` | App |
