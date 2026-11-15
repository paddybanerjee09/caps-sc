# Git commit index

Backfill inventory from `git log --all --reverse --topo-order --name-status --diff-merges=first-parent` at `e492e06`. Each reachable commit appears once. Domains come from Feature Tree version references, with a few documentation and asset changes linked by their changed paths. Use `git show <hash>` for the exact change and [[Project History]] for the chronology and branch decisions.

## Main ancestry

118 commits.

| Commit | Author date | Git subject | Related vault notes |
| --- | --- | --- | --- |
| `c88eab6` | 2026-06-30 | Initial commit | [[App Architecture]] |
| `e9ddbfb` | 2026-06-30 | Boilerplate | [[App Architecture]], [[Home]], [[Nutrition]], [[Conditioning]], [[Strength]], [[Skills Training]] |
| `f0f5834` | 2026-07-02 | Replace app with recreated Expo boilerplate | [[App Architecture]], [[Home]], [[Nutrition]], [[Conditioning]], [[Strength]], [[Skills Training]], [[Settings]] |
| `d0c1116` | 2026-07-02 | Changed README.md | [[App Architecture]] |
| `edd48ce` | 2026-07-18 | Added Athlete Information section | [[App Architecture]], [[Home]], [[Nutrition]], [[Conditioning]], [[Strength]], [[Skills Training]], [[Settings]] |
| `0b97b10` | 2026-07-02 | Update README.md | [[Conditioning]], [[Strength]], [[Skills Training]] |
| `7f48393` | 2026-07-18 | What the hell is going on | [[Settings]] |
| `dd88e65` | 2026-07-18 | Restarting boilerplate again | [[App Architecture]], [[Conditioning]], [[Strength]] |
| `37c812d` | 2026-07-20 | Boilerplate #3 | [[Conditioning]], [[Settings]] |
| `101ec87` | 2026-07-20 | Created Athlete Information Settings | [[App Architecture]], [[Settings]] |
| `3d09c81` | 2026-07-21 | Started Profile screen | [[App Architecture]], [[Home]], [[Settings]] |
| `5904f45` | 2026-07-21 | Added Quick Log button + options | [[App Architecture]], [[Home]], [[Settings]] |
| `2d78f4c` | 2026-07-22 | Added Home Screens | [[Home]] |
| `efc880c` | 2026-07-22 | Fixed quick log button bug where it sent the contents below it to hell whenever opened :) | [[Home]] |
| `ad01bfe` | 2026-07-22 | UI Improvements | [[App Architecture]], [[Home]], [[Nutrition]], [[Conditioning]], [[Strength]], [[Skills Training]], [[Settings]] |
| `2900198` | 2026-07-22 | More UI changes | [[Settings]] |
| `59dd4e8` | 2026-07-22 | Added database | [[App Architecture]], [[Data and Persistence]], [[Home]], [[Strength]], [[Skills Training]] |
| `5d1ccde` | 2026-07-22 | ACTUALLY added database | [[App Architecture]], [[Data and Persistence]] |
| `fb6ae68` | 2026-07-24 | Added database | [[Data and Persistence]], [[Home]] |
| `ea4cc2b` | 2026-07-24 | Started weight logging system | [[Data and Persistence]], [[Home]] |
| `5833c71` | 2026-07-24 | Unified weightKg across athleteInfo and homeScreen | [[App Architecture]], [[Home]], [[Settings]] |
| `ed60738` | 2026-07-25 | Added rudimentary timeline | [[Home]] |
| `d09b356` | 2026-07-25 | Added retroactive weight logging | [[Home]] |
| `3232443` | 2026-07-25 | Added log deletion and refined the DateTimePicker | [[App Architecture]], [[Home]] |
| `859b4aa` | 2026-07-26 | Added sleep logging and nightly default toggle | [[App Architecture]], [[Data and Persistence]], [[Home]] |
| `241f556` | 2026-07-28 | Added content to nutrition menu: Nutrition menu, caloric/macronutrient card | [[Data and Persistence]], [[Home]], [[Nutrition]] |
| `41b5c4d` | 2026-07-28 | Update README.md | [[Conditioning]], [[Strength]], [[Skills Training]] |
| `39af34b` | 2026-07-28 | Update README.md | [[App Architecture]] |
| `9d3b799` | 2026-07-28 | Update README.md | [[App Architecture]] |
| `a105192` | 2026-07-28 | Update README.md | [[App Architecture]] |
| `a269579` | 2026-07-28 | Added nutrition card and macronutrient display | [[Nutrition]] |
| `e845b49` | 2026-07-28 | Modified MealLogModal.tsx | [[Nutrition]] |
| `d94e5c3` | 2026-07-28 | Added separate time log modal | [[App Architecture]] |
| `ada401f` | 2026-07-28 | Configured USDA FoodData REST API key | [[Nutrition]] |
| `bfdcb3a` | 2026-07-29 | Revamped MealLogModal.tsx, added MacronutrientBreakdownCard.tsx as a reusable component | [[Nutrition]] |
| `298f627` | 2026-07-30 | Added editable calorie counter for food logging | [[Nutrition]] |
| `3225bb5` | 2026-07-30 | Differentiated planned/completed meal logging | [[Nutrition]] |
| `ea999da` | 2026-07-30 | WeightLogModal.tsx UI changes | [[Home]] |
| `e8fc8e9` | 2026-07-30 | More UI fixes, added collapsable tabs in the nutrition menu | [[App Architecture]], [[Home]], [[Nutrition]] |
| `9fc0f73` | 2026-10-02 | Fixed errors | [[App Architecture]], [[Home]] |
| `c4f7af8` | 2026-10-03 | Add a provider-neutral nutrition model and shared calculations. | [[Nutrition]] |
| `884864f` | 2026-10-03 | Store meals, custom foods, favourites, and drafts in a versioned schema. | [[Data and Persistence]], [[Nutrition]] |
| `8a1f6a3` | 2026-10-03 | Add FatSecret search and Open Food Facts barcode lookup. | [[Nutrition]] |
| `ce2ba31` | 2026-10-03 | Keep the nutrition workspace mounted above the main tabs. | [[App Architecture]], [[Nutrition]] |
| `4b6db09` | 2026-10-03 | Add the full-screen meal composer. | [[Nutrition]] |
| `4c6b3f1` | 2026-10-03 | Add reusable saved meals separate from the diary. | [[Nutrition]] |
| `8731d05` | 2026-10-03 | Add the food picker with local and FatSecret search. | [[Nutrition]] |
| `4890a26` | 2026-10-03 | Add in-screen barcode scanning through Open Food Facts. | [[Nutrition]] |
| `12b6b40` | 2026-10-03 | Add custom foods with an advisory calorie check. | [[Nutrition]] |
| `12171e9` | 2026-10-03 | Add nutrition facts with exact-serving favourites. | [[Nutrition]] |
| `60aa964` | 2026-10-03 | Animate nutrition screens up on open and down on close. | [[Nutrition]] |
| `1d7f792` | 2026-10-03 | Open the meal composer from Nutrition and Home instead of a modal. | [[App Architecture]], [[Home]], [[Nutrition]] |
| `1d8b456` | 2026-10-03 | Document the food proxy and verify migration and nutrient math. | [[Nutrition]] |
| `ece0620` | 2026-10-03 | Finish a nutrition migration that stopped before its tables existed. | [[Data and Persistence]], [[Nutrition]] |
| `ccc63a6` | 2026-10-03 | Stop the Home section slider from retriggering layout forever. | [[Home]], [[Nutrition]] |
| `6ccb251` | 2026-10-04 | Stop the Nutrition screen reloading meals on unrelated workspace updates. | [[Nutrition]] |
| `f20a3b3` | 2026-10-04 | Move micronutrients into the macro card as an expandable list. | [[Nutrition]] |
| `0627d77` | 2026-10-04 | Add a compact Meal totals card with the macros in its header. | [[Nutrition]] |
| `1daf75d` | 2026-10-04 | Give the meal and food title fields a filled background. | [[Nutrition]] |
| `c4e6bcb` | 2026-10-04 | Show Nutrition Facts calories for the default amount on open. | [[Nutrition]] |
| `02ea54a` | 2026-10-04 | Open Nutrition Facts servings in a floating dropdown. | [[Nutrition]] |
| `20a5fbb` | 2026-10-04 | Give nutrition text fields a filled background and readable contrast. | [[Nutrition]] |
| `0deafb1` | 2026-10-04 | Make Add Meal Item the focus and put meal actions on the composer. | [[Nutrition]] |
| `015743c` | 2026-10-04 | Add a three-dot Edit Meal action on each logged diary meal. | [[Nutrition]] |
| `1041599` | 2026-10-04 | Put custom-food macros in one row and micronutrients in two columns. | [[Nutrition]] |
| `e8925f8` | 2026-10-04 | Start each custom food on a fresh form and keep edits on the original record. | [[Nutrition]] |
| `14c1595` | 2026-10-04 | Label custom-food facts Create Custom Food and drop the serving equation. | [[Nutrition]] |
| `dde7751` | 2026-10-04 | Keep favourite food details so starred foods can open again. | [[Data and Persistence]], [[Nutrition]] |
| `f8de697` | 2026-10-04 | Overlay the food-picker sort menu and let custom foods be edited or deleted. | [[Nutrition]] |
| `4d8f785` | 2026-10-04 | Prompt barcode entry clearly and drop extra Dismiss buttons. | [[Nutrition]] |
| `3ff3e8a` | 2026-10-04 | Verify meal edits, separate custom foods, and favourite snapshots. | [[Nutrition]] |
| `fe847c6` | 2026-10-05 | Remove the USDA FoodData Central API client. | [[Nutrition]] |
| `9b8f6e2` | 2026-10-05 | Add update and delete APIs for saved meals. | [[Nutrition]] |
| `3b34380` | 2026-10-05 | Add saved-meal template drafts for the meal composer. | [[Nutrition]] |
| `7c98213` | 2026-10-05 | Open saved meals in the meal log editor from the workspace. | [[Nutrition]] |
| `13b3d68` | 2026-10-05 | Add a compact MacronutrientBreakdownCard variant for nested screens. | [[Nutrition]] |
| `39add05` | 2026-10-05 | Shrink the inline LogTimeChanger pill for meal log headers. | [[App Architecture]], [[Nutrition]] |
| `6397e58` | 2026-10-05 | Reorder meal log content and support editing saved templates. | [[Nutrition]] |
| `a553465` | 2026-10-05 | Add edit and delete controls on the saved meals list. | [[Nutrition]] |
| `e5cf05f` | 2026-10-05 | Use compact macro totals on nutrition facts with clearer spacing. | [[Nutrition]] |
| `64d6eb3` | 2026-10-05 | Close barcode and custom-food screens to the nutrition home. | [[Nutrition]] |
| `fabae46` | 2026-10-05 | Add meal item back bar and a prominent create-custom-food action. | [[Nutrition]] |
| `59c7ef6` | 2026-10-05 | Show compact macro totals inline with the card title. | [[Nutrition]] |
| `2c0cfb4` | 2026-10-08 | AppStateContext.tsx bug fix | [[App Architecture]] |
| `c8ddb63` | 2026-10-11 | Defer home and nutrition loads with requestIdleCallback via scheduleIdleTask. | [[App Architecture]], [[Home]], [[Nutrition]] |
| `3f111e1` | 2026-10-11 | Add a local conditioning data model with explicit session status. | [[Data and Persistence]], [[Conditioning]] |
| `50427a5` | 2026-10-11 | Add a reusable monthly calendar with explicit planned and logged markers. | [[App Architecture]], [[Conditioning]] |
| `0772f4e` | 2026-10-11 | Share the distance unit and refresh the home timeline after conditioning saves. | [[App Architecture]], [[Home]], [[Settings]] |
| `64bc57b` | 2026-10-11 | Add workout draft and summary helpers for conditioning editors. | [[Conditioning]] |
| `001e7f3` | 2026-10-11 | Add conditioning form controls and the saved-workout grid. | [[Conditioning]] |
| `4539314` | 2026-10-11 | Add conditioning workspace state for screen and editor navigation. | [[Conditioning]] |
| `f2b5a37` | 2026-10-11 | Show the conditioning calendar, saved workouts, and session chooser. | [[Conditioning]] |
| `002c288` | 2026-10-11 | Add workout editors for planning, logging, and saving templates. | [[Conditioning]] |
| `d08cadc` | 2026-10-11 | Add a timer-only free conditioning session. | [[Conditioning]] |
| `7e20d09` | 2026-10-11 | Wire conditioning screens into the app navigation. | [[App Architecture]], [[Conditioning]] |
| `6e7f23e` | 2026-10-11 | Drive structured workouts from a timestamp-based runner. | [[Conditioning]] |
| `d06af5a` | 2026-10-11 | Filter GPS points and calculate splits and elevation. | [[Conditioning]] |
| `920f146` | 2026-10-11 | Record free-session routes in the background. | [[Conditioning]] |
| `4123903` | 2026-10-11 | Show a recorded route on the session detail. | [[Conditioning]] |
| `091cc58` | 2026-10-11 | Add retryable conditioning upload that reuses acknowledged batches. | [[Data and Persistence]], [[Conditioning]] |
| `3c97333` | 2026-10-11 | Add provisional training-emphasis estimates. | [[Conditioning]] |
| `e677232` | 2026-10-11 | Document conditioning behavior and persist the project rules. | [[Conditioning]] |
| `aefd18e` | 2026-10-11 | Drop an extra blank line from the conditioning checks. | [[Conditioning]] |
| `3587129` | 2026-11-02 | Install spencerpauly react-native-patterns agent skill | [[App Architecture]] |
| `17e5a94` | 2026-11-02 | Derive conditioning load state from fetch key instead of effect setState. | [[Conditioning]] |
| `cb31dff` | 2026-11-02 | Establish CAPS S&C UI style guide (.mdc) and high-contrast theme tokens | [[App Architecture]] |
| `5c595dd` | 2026-11-02 | Add synthesized audio cue and haptic feedback engine and renovate app chrome | [[App Architecture]] |
| `6b9fc9a` | 2026-11-02 | Renovate Settings and Account Information screens with card-by-card controls | [[Settings]] |
| `ce8f0d6` | 2026-11-02 | Renovate Athlete Information screen with card-by-card steppers and scroll presets | [[Settings]] |
| `67d99b6` | 2026-11-02 | Renovate Home dashboard, inline Weight/Sleep cards, and stepper time controls | [[App Architecture]], [[Home]], [[Nutrition]] |
| `e9d18be` | 2026-11-02 | Renovate Conditioning hub, monthly calendar card, and saved workouts grid | [[Conditioning]] |
| `45e2f29` | 2026-11-02 | Renovate Conditioning workout composer, station editor, and manual logger with +/- steppers | [[Conditioning]] |
| `87e259b` | 2026-11-02 | Renovate Conditioning workout runner, free session, detail, emphasis, and confirm dialog | [[Conditioning]] |
| `9917cee` | 2026-11-02 | Renovate Nutrition diary, meal composer, facts, custom food, and food picker with cards and steppers | [[Nutrition]] |
| `75dd681` | 2026-11-03 | Add .mdc files and feature tree | [[App Architecture]] |
| `af9550c` | 2026-11-09 | Implemented 3-part workflow | [[App Architecture]] |
| `09346ce` | 2026-11-10 | Replace app logo with supplied CAPS Logo v3 | [[App Architecture]] |
| `e492e06` | 2026-11-15 | Expanded on agent context retrieval guidelines | [[App Architecture]] |

## Archived conditioning and strength lineage

76 commits.

| Commit | Author date | Git subject | Related vault notes |
| --- | --- | --- | --- |
| `3277f49` | 2026-08-02 | Add conditioning domain model | [[Conditioning]] |
| `980ec0e` | 2026-08-02 | Add conditioning database schema | [[Conditioning]] |
| `edd841a` | 2026-08-02 | Add monthly conditioning timeline | [[Conditioning]] |
| `f9783fa` | 2026-08-02 | Add conditioning repository | [[Conditioning]] |
| `3893a83` | 2026-08-02 | Add conditioning baseline settings | [[Conditioning]] |
| `8efe318` | 2026-08-02 | Add conditioning form controls | [[Conditioning]] |
| `4ffc761` | 2026-08-02 | Add conditioning timeline metadata | [[Conditioning]] |
| `6b42cd1` | 2026-08-02 | Fix conditioning metadata type | [[Conditioning]] |
| `a53b7cc` | 2026-08-02 | Add conditioning session templates | [[Conditioning]] |
| `05a83fe` | 2026-08-02 | Add conditioning session logging | [[Conditioning]] |
| `d1240b6` | 2026-08-02 | Add conditioning session details | [[Conditioning]] |
| `bd5c21f` | 2026-08-02 | Build conditioning screen | [[Conditioning]] |
| `e2c3e86` | 2026-08-02 | Connect conditioning to Home | [[Conditioning]] |
| `a86e226` | 2026-08-09 | Add conditioning test coverage | [[Conditioning]] |
| `d20abb7` | 2026-08-09 | Persist conditioning distance units | [[Conditioning]] |
| `8eb605a` | 2026-08-09 | Add conditioning measurement controls | [[Conditioning]] |
| `befc0f6` | 2026-08-09 | Unify conditioning interval protocols | [[Conditioning]] |
| `2c124cb` | 2026-08-09 | Redesign conditioning session fields | [[Conditioning]] |
| `325291b` | 2026-08-09 | Compact conditioning log layout | [[Conditioning]] |
| `5167b4c` | 2026-08-09 | Add conditioning log updates | [[Conditioning]] |
| `276cd1b` | 2026-08-09 | Connect conditioning log editing | [[Conditioning]] |
| `fc41c3d` | 2026-08-09 | Complete conditioning regression coverage | [[Conditioning]] |
| `35e0c2b` | 2026-08-09 | Simplify distance interval work input | [[Conditioning]] |
| `6af84ea` | 2026-08-09 | Align interval work mode selector | [[Conditioning]] |
| `a59bd22` | 2026-08-09 | Align interval rest field | [[Conditioning]] |
| `e88f88f` | 2026-08-09 | Overlay compact interval work options | [[Conditioning]] |
| `695623a` | 2026-08-09 | Precisely align interval inputs | [[Conditioning]] |
| `9a57dde` | 2026-08-09 | Round compact work selector background | [[Conditioning]] |
| `a5efc56` | 2026-08-09 | Use minute-second interval rest input | [[Conditioning]] |
| `bb8ed48` | 2026-08-09 | Use minute-second interval work input | [[Conditioning]] |
| `147f87a` | 2026-08-09 | Add dedicated hill sprint protocol fields | [[Conditioning]] |
| `47e44e6` | 2026-08-09 | Compact hill sprint fields | [[Conditioning]] |
| `656a078` | 2026-08-09 | Align conditioning template header | [[Conditioning]] |
| `1154954` | 2026-09-14 | feat(strength): add draft validation and adaptation scoring | [[Strength]] |
| `b270cdf` | 2026-09-14 | feat(strength): add ExerciseDB service adapter | [[Strength]] |
| `e8b22c1` | 2026-09-14 | feat(strength): persist templates and immutable session logs | [[Strength]] |
| `44d4e27` | 2026-09-14 | refactor(training): share adaptation and month timeline UI | [[App Architecture]], [[Conditioning]], [[Strength]] |
| `9de04e0` | 2026-09-14 | feat(strength): add exercise search and prescription editor | [[Strength]] |
| `acea2c3` | 2026-09-14 | feat(strength): add workout creation and quick log modal | [[Strength]] |
| `d319861` | 2026-09-14 | feat(strength): add saved workout logging flow | [[Strength]] |
| `da78b5b` | 2026-09-14 | feat(strength): add read-only session details | [[Strength]] |
| `179a443` | 2026-09-14 | feat(strength): integrate strength timelines and screen | [[Strength]] |
| `018d898` | 2026-09-14 | fix(strength): match free ExerciseDB search and cancellation contracts | [[Strength]] |
| `86922a9` | 2026-09-14 | test(strength): verify sqlite migration and log storage | [[Strength]] |
| `51e011a` | 2026-09-14 | test(strength): verify scoring and movement evidence | [[Strength]] |
| `5ca254f` | 2026-09-14 | test(strength): cover exercise search and editor flow | [[Strength]] |
| `2933434` | 2026-09-14 | test(strength): cover workout creation and confirmation | [[Strength]] |
| `f0c6cc0` | 2026-09-14 | test(strength): cover immutable session details | [[Strength]] |
| `ac17683` | 2026-09-14 | test(strength): cover timeline integration and refresh | [[Strength]] |
| `f7108bd` | 2026-09-14 | fix(conditioning): load saved sessions without effect state cascade | [[Conditioning]] |
| `beaf2d3` | 2026-09-16 | fix(ui): align log time controls and strength modal header | [[App Architecture]], [[Strength]] |
| `c6a334a` | 2026-09-16 | feat(strength): simplify and compact exercise logging | [[Strength]] |
| `090a944` | 2026-09-16 | test(strength): cover compact form workflows and document layout rules | [[Strength]] |
| `9a39461` | 2026-09-18 | Phase 1: foundations and ExerciseDB normalization. | [[App Architecture]], [[Strength]] |
| `c32cb6b` | 2026-09-18 | Phase 2: shared collection states and compact exercise search. | [[App Architecture]], [[Strength]] |
| `ba0759f` | 2026-09-18 | Phase 3: context-specific timeline presentation resolvers. | [[App Architecture]] |
| `a9b40d1` | 2026-09-18 | Phase 4: shared modal frame and adaptation status control. | [[App Architecture]], [[Conditioning]], [[Strength]] |
| `59a1b23` | 2026-09-18 | Phase 4: shared modal frame and adaptation status control. | [[App Architecture]], [[Conditioning]], [[Strength]] |
| `6f5d88d` | 2026-09-25 | feat: complete UI redesign audit changes | [[App Architecture]], [[Conditioning]], [[Strength]] |
| `7fac1fb` | 2026-09-25 | Merge feat/ui-redesign-audit into main | [[App Architecture]], [[Strength]] |
| `741e5a8` | 2026-09-25 | fix: avoid nested virtualized action menu | [[App Architecture]], [[Strength]] |
| `009aff6` | 2026-09-25 | feat: stack session actions as full width buttons | [[App Architecture]], [[Strength]] |
| `95b4fa1` | 2026-09-25 | fix: correct stacked action button styles | [[App Architecture]], [[Strength]] |
| `278eb96` | 2026-09-25 | feat: show saved strength workouts inline | [[Strength]] |
| `e206148` | 2026-09-25 | feat: show saved conditioning sessions inline | [[Conditioning]] |
| `3f5a8e7` | 2026-09-25 | fix: reduce session action button height | [[Strength]] |
| `34ec2f8` | 2026-09-25 | style: format strength training screen | [[Strength]] |
| `1cf45e4` | 2026-09-25 | feat: remove standalone conditioning session creation | [[Conditioning]] |
| `42ddef8` | 2026-09-25 | feat: save conditioning sessions from log flow | [[Conditioning]] |
| `e330adc` | 2026-09-25 | feat: unify responsive saved session dropdowns | [[Conditioning]], [[Strength]] |
| `94648ca` | 2026-09-25 | fix: align saved session dropdown behavior | [[Conditioning]] |
| `993c823` | 2026-09-25 | style: add vertical space between saved cards | [[Conditioning]] |
| `8c312a5` | 2026-09-25 | feat: align conditioning log actions with strength | [[Conditioning]] |
| `eb7214d` | 2026-09-25 | style: separate saved cards from toggle button | [[Conditioning]] |
| `88d4f15` | 2026-09-25 | feat: remove legacy conditioning template selector | [[Conditioning]] |
| `7daf5e7` | 2026-09-25 | feat: scale saved session cards for compact grids | [[Conditioning]] |

## Separate boilerplate lineage

2 commits.

| Commit | Author date | Git subject | Related vault notes |
| --- | --- | --- | --- |
| `910fe50` | 2026-07-01 | Initial commit | [[App Architecture]] |
| `d005295` | 2026-07-02 | Recreated the boilerplate | [[App Architecture]] |
