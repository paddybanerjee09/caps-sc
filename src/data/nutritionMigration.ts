export const nutritionV5RebuildSql = `
DROP TABLE IF EXISTS meal_items_v5;

CREATE TABLE meal_items_v5 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_timeline_entry_id INTEGER NOT NULL,
  source TEXT NOT NULL
    CHECK (source IN ('fatsecret', 'openfoodfacts', 'custom', 'usda')),
  external_id TEXT NOT NULL CHECK (length(external_id) > 0),
  serving_id TEXT NOT NULL CHECK (length(serving_id) > 0),
  food_description TEXT,
  brand_name TEXT,
  quantity REAL NOT NULL CHECK (quantity > 0),
  serving_amount REAL,
  serving_unit TEXT,
  serving_description TEXT,
  storage_policy TEXT NOT NULL
    CHECK (storage_policy IN ('snapshot', 'reference')),
  energy_kcal_per_serving REAL
    CHECK (energy_kcal_per_serving IS NULL OR energy_kcal_per_serving >= 0),
  protein_g_per_serving REAL
    CHECK (protein_g_per_serving IS NULL OR protein_g_per_serving >= 0),
  carbohydrates_g_per_serving REAL
    CHECK (
      carbohydrates_g_per_serving IS NULL
      OR carbohydrates_g_per_serving >= 0
    ),
  fat_g_per_serving REAL
    CHECK (fat_g_per_serving IS NULL OR fat_g_per_serving >= 0),
  extra_nutrients_json TEXT,
  CHECK (
    (
      storage_policy = 'reference'
      AND food_description IS NULL
      AND serving_description IS NULL
    )
    OR (
      storage_policy = 'snapshot'
      AND food_description IS NOT NULL
      AND length(trim(food_description)) > 0
      AND serving_description IS NOT NULL
      AND length(trim(serving_description)) > 0
      AND serving_amount IS NOT NULL
      AND serving_amount > 0
      AND serving_unit IN ('g', 'ml', 'tsp', 'tbsp', 'serving')
    )
  ),
  FOREIGN KEY (meal_timeline_entry_id)
    REFERENCES meal_logs (timeline_entry_id)
    ON DELETE CASCADE
);

INSERT INTO meal_items_v5 (
  id,
  meal_timeline_entry_id,
  source,
  external_id,
  serving_id,
  food_description,
  brand_name,
  quantity,
  serving_amount,
  serving_unit,
  serving_description,
  storage_policy,
  energy_kcal_per_serving,
  protein_g_per_serving,
  carbohydrates_g_per_serving,
  fat_g_per_serving,
  extra_nutrients_json
)
SELECT
  id,
  meal_timeline_entry_id,
  'usda',
  CAST(fdc_id AS TEXT),
  'legacy:' || serving_unit || ':' || serving_amount || ':' || serving_description,
  food_description,
  brand_name,
  quantity,
  serving_amount,
  serving_unit,
  serving_description,
  'snapshot',
  energy_kcal_per_serving,
  protein_g_per_serving,
  carbohydrates_g_per_serving,
  fat_g_per_serving,
  NULL
FROM meal_items;

DROP TABLE meal_items;
ALTER TABLE meal_items_v5 RENAME TO meal_items;

CREATE INDEX IF NOT EXISTS meal_items_meal_timeline_entry_id
ON meal_items (meal_timeline_entry_id);

CREATE INDEX IF NOT EXISTS meal_items_food_identity
ON meal_items (source, external_id);
`;

export const nutritionV5SequenceSql = `
DELETE FROM sqlite_sequence
WHERE name = 'meal_items' OR name = 'meal_items_v5';

INSERT INTO sqlite_sequence (name, seq)
SELECT 'meal_items', COALESCE(MAX(id), 0) FROM meal_items;
`;

export const nutritionV5TablesSql = `
CREATE TABLE IF NOT EXISTS nutrition_operations (
  operation_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'committed')),
  result_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_foods (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  brand TEXT,
  barcode TEXT,
  serving_amount REAL NOT NULL CHECK (serving_amount > 0),
  serving_unit TEXT NOT NULL
    CHECK (serving_unit IN ('g', 'ml', 'tsp', 'tbsp', 'serving')),
  energy_kcal REAL NOT NULL CHECK (energy_kcal >= 0),
  protein_g REAL NOT NULL CHECK (protein_g >= 0),
  carbohydrates_g REAL NOT NULL CHECK (carbohydrates_g >= 0),
  fat_g REAL NOT NULL CHECK (fat_g >= 0),
  extra_nutrients_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS food_favourites (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  serving_id TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  config_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_meals (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_meal_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  saved_meal_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  serving_id TEXT NOT NULL,
  food_description TEXT,
  brand_name TEXT,
  quantity REAL NOT NULL CHECK (quantity > 0),
  serving_amount REAL,
  serving_unit TEXT,
  serving_description TEXT,
  storage_policy TEXT NOT NULL
    CHECK (storage_policy IN ('snapshot', 'reference')),
  energy_kcal_per_serving REAL,
  protein_g_per_serving REAL,
  carbohydrates_g_per_serving REAL,
  fat_g_per_serving REAL,
  extra_nutrients_json TEXT,
  FOREIGN KEY (saved_meal_id)
    REFERENCES saved_meals (id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS saved_meal_items_saved_meal_id
ON saved_meal_items (saved_meal_id, position);

CREATE INDEX IF NOT EXISTS saved_meals_created_at
ON saved_meals (created_at, id);

CREATE UNIQUE INDEX IF NOT EXISTS meal_logs_operation_id
ON meal_logs (operation_id)
WHERE operation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS nutrition_workspace (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

export const nutritionV5MigrationSql = `
${nutritionV5RebuildSql}
${nutritionV5SequenceSql}
ALTER TABLE meal_logs ADD COLUMN operation_id TEXT;
ALTER TABLE meal_logs ADD COLUMN saved_meal_id TEXT;
${nutritionV5TablesSql}
`;

export const nutritionV6FavouriteSnapshotSql = `
ALTER TABLE food_favourites ADD COLUMN snapshot_json TEXT;
`;
