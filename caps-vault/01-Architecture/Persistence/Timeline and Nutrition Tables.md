# Timeline and Nutrition Tables

Use this note for persistence work in [[Home]], [[Nutrition]], and the bodyweight portion of [[Settings]]. See [[Data and Persistence]] for migration sequencing and [[Conditioning Tables]] for training-session links.

## Timeline and sleep

| Table | Relationship and ownership |
| --- | --- |
| `timeline_entries` | Timeline hub with integer primary key and category `kind`, title, start/end timestamps, status, and notes. `src/data/timelineRepository.ts` owns shared queries. Day queries include overlapping timed entries and point events within local day bounds. |
| `weight_logs` | `timeline_entry_id` is both primary key and foreign key to `timeline_entries` with `ON DELETE CASCADE`. `weight_kg` is strictly positive. The repository writes/edits the pair transactionally and deletes the parent to delete the log. `getLatestWeightKg` orders by timestamp, then row ID. |
| `sleep_schedules` | Independent schedule periods with local minutes and effective wake dates. The start date is inclusive and the optional end date exclusive. Replacing or disabling a default closes the previous range and removes later ranges in a transaction. Day display projects virtual schedule entries and suppresses them when a concrete sleep entry overlaps. Manual sleep periods live directly in `timeline_entries` with `kind = 'sleep'`. |

## Nutrition

| Table | Relationship and ownership |
| --- | --- |
| `meal_logs` | One diary header per timeline entry. Cascade on timeline deletion. `operation_id` is nullable with a partial unique index. `saved_meal_id` is a nullable source-template identifier without a SQL foreign key. |
| `meal_items` | Many line items per diary meal, cascading through `meal_logs`. v5 replaced `fdc_id` with `source`, `external_id`, `serving_id`, `storage_policy`, and optional extra nutrient JSON. Legacy USDA rows migrate as snapshots with preserved IDs and nutrients. |
| `nutrition_operations` | Operation-ID receipts with kind, `pending`/`committed` status, and optional result ID. Used for repeat-safe create operations. |
| `custom_foods` | User-authored serving, macro, and extra nutrient records. `operation_id` is unique. Historical snapshots can outlive catalog edits or deletion. |
| `food_favourites` | Distinct exact serving/amount configurations via unique `config_key`. v6 adds nullable `snapshot_json` for reopening from saved detail when available. |
| `saved_meals` | Reusable meal templates with their own IDs and operation receipts. Creating, editing, or deleting a template is separate from diary logging. |
| `saved_meal_items` | Ordered template items cascading on `saved_meals` deletion. Same provider identity and snapshot/reference concepts as diary items. |
| `nutrition_workspace` | One durable draft payload keyed by `id = 1`, with `updated_at`. Its existence is the migration-repair sentinel. |

`src/data/nutritionRepository.ts` owns diary writes, joins and queries. A new meal writes the timeline parent and diary children with its operation receipt. `src/data/nutritionCatalogRepository.ts` owns custom foods, favorites, templates, workspace persistence, and usage queries. Source and storage policy decide what per-serving facts can be stored and what must be hydrated. Preserve the distinction when changing catalog code or restoring drafts. The app removed the live USDA client in `fe847c6`, but v5 still supports migrated snapshot rows. Deleting a saved meal cascades its template items while diary logs retain their own item rows.

Evidence: `src/data/database.ts`, `src/data/nutritionMigration.ts`, the two nutrition repositories, `src/data/timelineRepository.ts`, and current verification scripts in [[Data and Persistence]]. Feature Tree: [`database.html`](../../../docs/feature-tree/database.html).
