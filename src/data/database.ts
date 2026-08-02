import type { SQLiteDatabase } from "expo-sqlite";

const DATABASE_VERSION = 5;

export async function migrateDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  const versionResult = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );

  const currentVersion = versionResult?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS timeline_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        start_at INTEGER NOT NULL,
        end_at INTEGER,
        status TEXT NOT NULL DEFAULT 'planned',
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS timeline_entries_start_at
      ON timeline_entries (start_at);
    `);
  }

  if (currentVersion < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS weight_logs (
        timeline_entry_id INTEGER PRIMARY KEY NOT NULL,
        weight_kg REAL NOT NULL CHECK (weight_kg > 0),
        FOREIGN KEY (timeline_entry_id)
          REFERENCES timeline_entries (id)
          ON DELETE CASCADE
      );
    `);
  }

  if (currentVersion < 3) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sleep_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_minute INTEGER NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
        end_minute INTEGER NOT NULL CHECK (end_minute BETWEEN 0 AND 1439),
        effective_from_wake_date TEXT NOT NULL,
        effective_until_wake_date TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        CHECK (start_minute != end_minute),
        CHECK (
          effective_until_wake_date IS NULL
          OR effective_until_wake_date > effective_from_wake_date
        )
      );

      CREATE INDEX IF NOT EXISTS sleep_schedules_wake_dates
      ON sleep_schedules (
        effective_from_wake_date,
        effective_until_wake_date
      );
    `);
  }

  if (currentVersion < 4) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS meal_logs (
        timeline_entry_id INTEGER PRIMARY KEY NOT NULL,
        FOREIGN KEY (timeline_entry_id)
          REFERENCES timeline_entries (id)
          ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS meal_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_timeline_entry_id INTEGER NOT NULL,
        fdc_id INTEGER NOT NULL CHECK (fdc_id > 0),
        food_description TEXT NOT NULL
          CHECK (length(trim(food_description)) > 0),
        brand_name TEXT,
        quantity REAL NOT NULL CHECK (quantity > 0),
        serving_amount REAL NOT NULL CHECK (serving_amount > 0),
        serving_unit TEXT NOT NULL
          CHECK (serving_unit IN ('g', 'ml')),
        serving_description TEXT NOT NULL
          CHECK (length(trim(serving_description)) > 0),
        energy_kcal_per_serving REAL
          CHECK (
            energy_kcal_per_serving IS NULL
            OR energy_kcal_per_serving >= 0
          ),
        protein_g_per_serving REAL
          CHECK (
            protein_g_per_serving IS NULL
            OR protein_g_per_serving >= 0
          ),
        carbohydrates_g_per_serving REAL
          CHECK (
            carbohydrates_g_per_serving IS NULL
            OR carbohydrates_g_per_serving >= 0
          ),
        fat_g_per_serving REAL
          CHECK (
            fat_g_per_serving IS NULL
            OR fat_g_per_serving >= 0
          ),
        FOREIGN KEY (meal_timeline_entry_id)
          REFERENCES meal_logs (timeline_entry_id)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS meal_items_meal_timeline_entry_id
      ON meal_items (meal_timeline_entry_id);
    `);
  }

  if (currentVersion < 5) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS athlete_conditioning_baselines (
          id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
          maximum_heart_rate_bpm INTEGER DEFAULT NULL
            CHECK (
              maximum_heart_rate_bpm IS NULL
              OR (
                typeof(maximum_heart_rate_bpm) = 'integer'
                AND maximum_heart_rate_bpm BETWEEN 60 AND 260
              )
            ),
          threshold_pace_seconds_per_km REAL DEFAULT NULL
            CHECK (
              threshold_pace_seconds_per_km IS NULL
              OR (
                typeof(threshold_pace_seconds_per_km) IN ('integer', 'real')
                AND threshold_pace_seconds_per_km BETWEEN 30 AND 3600
              )
            ),
          maximum_aerobic_speed_kph REAL DEFAULT NULL
            CHECK (
              maximum_aerobic_speed_kph IS NULL
              OR (
                typeof(maximum_aerobic_speed_kph) IN ('integer', 'real')
                AND maximum_aerobic_speed_kph > 0
                AND maximum_aerobic_speed_kph <= 60
              )
            ),
          created_at INTEGER NOT NULL
            CHECK (
              typeof(created_at) = 'integer'
              AND created_at >= 0
            ),
          updated_at INTEGER NOT NULL
            CHECK (
              typeof(updated_at) = 'integer'
              AND updated_at >= created_at
            )
        );

        CREATE TABLE IF NOT EXISTS conditioning_session_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL
            CHECK (
              typeof(title) = 'text'
              AND length(trim(title)) BETWEEN 1 AND 80
            ),
          activity TEXT NOT NULL
            CHECK (
              activity IN (
                'running',
                'hill_sprints',
                'assault_bike',
                'rowing',
                'swimming',
                'circuit',
                'other'
              )
            ),
          protocol_type TEXT NOT NULL
            CHECK (
              protocol_type IN (
                'continuous',
                'time_intervals',
                'distance_intervals',
                'circuit'
              )
            ),
          intensity_method TEXT DEFAULT NULL
            CHECK (
              intensity_method IS NULL
              OR intensity_method IN ('rpe', 'heart_rate', 'pace')
            ),
          intensity_value REAL DEFAULT NULL,
          intensity_reference TEXT DEFAULT NULL
            CHECK (
              intensity_reference IS NULL
              OR intensity_reference IN (
                'max_heart_rate',
                'threshold_pace',
                'maximum_aerobic_speed'
              )
            ),
          continuous_duration_seconds INTEGER DEFAULT NULL
            CHECK (
              continuous_duration_seconds IS NULL
              OR (
                typeof(continuous_duration_seconds) = 'integer'
                AND continuous_duration_seconds BETWEEN 1 AND 86400
              )
            ),
          continuous_distance_meters REAL DEFAULT NULL
            CHECK (
              continuous_distance_meters IS NULL
              OR (
                typeof(continuous_distance_meters) IN ('integer', 'real')
                AND continuous_distance_meters > 0
                AND continuous_distance_meters <= 1000000
              )
            ),
          interval_work_duration_seconds INTEGER DEFAULT NULL
            CHECK (
              interval_work_duration_seconds IS NULL
              OR (
                typeof(interval_work_duration_seconds) = 'integer'
                AND interval_work_duration_seconds BETWEEN 1 AND 86400
              )
            ),
          interval_work_distance_meters REAL DEFAULT NULL
            CHECK (
              interval_work_distance_meters IS NULL
              OR (
                typeof(interval_work_distance_meters) IN ('integer', 'real')
                AND interval_work_distance_meters > 0
                AND interval_work_distance_meters <= 1000000
              )
            ),
          distance_total_duration_seconds INTEGER DEFAULT NULL
            CHECK (
              distance_total_duration_seconds IS NULL
              OR (
                typeof(distance_total_duration_seconds) = 'integer'
                AND distance_total_duration_seconds BETWEEN 1 AND 86400
              )
            ),
          rest_between_repetitions_seconds INTEGER DEFAULT NULL
            CHECK (
              rest_between_repetitions_seconds IS NULL
              OR (
                typeof(rest_between_repetitions_seconds) = 'integer'
                AND rest_between_repetitions_seconds BETWEEN 0 AND 86400
              )
            ),
          repetitions_per_set INTEGER DEFAULT NULL
            CHECK (
              repetitions_per_set IS NULL
              OR (
                typeof(repetitions_per_set) = 'integer'
                AND repetitions_per_set BETWEEN 1 AND 100
              )
            ),
          set_count INTEGER DEFAULT NULL
            CHECK (
              set_count IS NULL
              OR (
                typeof(set_count) = 'integer'
                AND set_count BETWEEN 1 AND 50
              )
            ),
          rest_between_sets_seconds INTEGER DEFAULT NULL
            CHECK (
              rest_between_sets_seconds IS NULL
              OR (
                typeof(rest_between_sets_seconds) = 'integer'
                AND rest_between_sets_seconds BETWEEN 0 AND 86400
              )
            ),
          circuit_round_count INTEGER DEFAULT NULL
            CHECK (
              circuit_round_count IS NULL
              OR (
                typeof(circuit_round_count) = 'integer'
                AND circuit_round_count BETWEEN 1 AND 50
              )
            ),
          circuit_rest_between_stations_seconds INTEGER DEFAULT NULL
            CHECK (
              circuit_rest_between_stations_seconds IS NULL
              OR (
                typeof(circuit_rest_between_stations_seconds) = 'integer'
                AND circuit_rest_between_stations_seconds BETWEEN 0 AND 86400
              )
            ),
          circuit_rest_between_rounds_seconds INTEGER DEFAULT NULL
            CHECK (
              circuit_rest_between_rounds_seconds IS NULL
              OR (
                typeof(circuit_rest_between_rounds_seconds) = 'integer'
                AND circuit_rest_between_rounds_seconds BETWEEN 0 AND 86400
              )
            ),
          notes TEXT DEFAULT NULL
            CHECK (
              notes IS NULL
              OR (
                typeof(notes) = 'text'
                AND length(trim(notes)) BETWEEN 1 AND 2000
              )
            ),
          created_at INTEGER NOT NULL
            CHECK (
              typeof(created_at) = 'integer'
              AND created_at >= 0
            ),
          updated_at INTEGER NOT NULL
            CHECK (
              typeof(updated_at) = 'integer'
              AND updated_at >= created_at
            ),
          CHECK (
            (
              intensity_method IS NULL
              AND intensity_value IS NULL
              AND intensity_reference IS NULL
            )
            OR (
              intensity_method = 'rpe'
              AND intensity_value IS NOT NULL
              AND typeof(intensity_value) IN ('integer', 'real')
              AND intensity_value BETWEEN 1 AND 10
              AND intensity_reference IS NULL
            )
            OR (
              intensity_method = 'heart_rate'
              AND intensity_value IS NOT NULL
              AND typeof(intensity_value) IN ('integer', 'real')
              AND intensity_value BETWEEN 30 AND 260
              AND intensity_reference = 'max_heart_rate'
            )
            OR (
              intensity_method = 'pace'
              AND intensity_value IS NOT NULL
              AND typeof(intensity_value) IN ('integer', 'real')
              AND intensity_value BETWEEN 30 AND 3600
              AND intensity_reference = 'threshold_pace'
            )
            OR (
              intensity_method = 'pace'
              AND intensity_value IS NOT NULL
              AND typeof(intensity_value) IN ('integer', 'real')
              AND intensity_value > 0
              AND intensity_value <= 60
              AND intensity_reference = 'maximum_aerobic_speed'
            )
          ),
          CHECK (
            (
              protocol_type = 'continuous'
              AND continuous_duration_seconds IS NOT NULL
              AND interval_work_duration_seconds IS NULL
              AND interval_work_distance_meters IS NULL
              AND distance_total_duration_seconds IS NULL
              AND rest_between_repetitions_seconds IS NULL
              AND repetitions_per_set IS NULL
              AND set_count IS NULL
              AND rest_between_sets_seconds IS NULL
              AND circuit_round_count IS NULL
              AND circuit_rest_between_stations_seconds IS NULL
              AND circuit_rest_between_rounds_seconds IS NULL
            )
            OR (
              protocol_type = 'time_intervals'
              AND continuous_duration_seconds IS NULL
              AND continuous_distance_meters IS NULL
              AND interval_work_duration_seconds IS NOT NULL
              AND interval_work_distance_meters IS NULL
              AND distance_total_duration_seconds IS NULL
              AND rest_between_repetitions_seconds IS NOT NULL
              AND repetitions_per_set IS NOT NULL
              AND set_count IS NOT NULL
              AND rest_between_sets_seconds IS NOT NULL
              AND circuit_round_count IS NULL
              AND circuit_rest_between_stations_seconds IS NULL
              AND circuit_rest_between_rounds_seconds IS NULL
            )
            OR (
              protocol_type = 'distance_intervals'
              AND continuous_duration_seconds IS NULL
              AND continuous_distance_meters IS NULL
              AND interval_work_duration_seconds IS NULL
              AND interval_work_distance_meters IS NOT NULL
              AND distance_total_duration_seconds IS NOT NULL
              AND rest_between_repetitions_seconds IS NOT NULL
              AND repetitions_per_set IS NOT NULL
              AND set_count IS NOT NULL
              AND rest_between_sets_seconds IS NOT NULL
              AND circuit_round_count IS NULL
              AND circuit_rest_between_stations_seconds IS NULL
              AND circuit_rest_between_rounds_seconds IS NULL
              AND distance_total_duration_seconds >
                rest_between_repetitions_seconds
                  * (repetitions_per_set - 1)
                  * set_count
                + rest_between_sets_seconds * (set_count - 1)
            )
            OR (
              protocol_type = 'circuit'
              AND continuous_duration_seconds IS NULL
              AND continuous_distance_meters IS NULL
              AND interval_work_duration_seconds IS NULL
              AND interval_work_distance_meters IS NULL
              AND distance_total_duration_seconds IS NULL
              AND rest_between_repetitions_seconds IS NULL
              AND repetitions_per_set IS NULL
              AND set_count IS NULL
              AND rest_between_sets_seconds IS NULL
              AND circuit_round_count IS NOT NULL
              AND circuit_rest_between_stations_seconds IS NOT NULL
              AND circuit_rest_between_rounds_seconds IS NOT NULL
            )
          )
        );

        CREATE INDEX IF NOT EXISTS conditioning_session_templates_updated_at
        ON conditioning_session_templates (updated_at DESC, id DESC);

        CREATE TABLE IF NOT EXISTS conditioning_template_stations (
          template_id INTEGER NOT NULL
            CHECK (
              typeof(template_id) = 'integer'
              AND template_id > 0
            ),
          position INTEGER NOT NULL
            CHECK (
              typeof(position) = 'integer'
              AND position BETWEEN 0 AND 29
            ),
          station_name TEXT NOT NULL
            CHECK (
              typeof(station_name) = 'text'
              AND length(trim(station_name)) BETWEEN 1 AND 60
            ),
          work_duration_seconds INTEGER NOT NULL
            CHECK (
              typeof(work_duration_seconds) = 'integer'
              AND work_duration_seconds BETWEEN 1 AND 86400
            ),
          PRIMARY KEY (template_id, position),
          FOREIGN KEY (template_id)
            REFERENCES conditioning_session_templates (id)
            ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS conditioning_logs (
          timeline_entry_id INTEGER PRIMARY KEY NOT NULL
            CHECK (
              typeof(timeline_entry_id) = 'integer'
              AND timeline_entry_id > 0
            ),
          source_template_id INTEGER DEFAULT NULL
            CHECK (
              source_template_id IS NULL
              OR (
                typeof(source_template_id) = 'integer'
                AND source_template_id > 0
              )
            ),
          activity TEXT NOT NULL
            CHECK (
              activity IN (
                'running',
                'hill_sprints',
                'assault_bike',
                'rowing',
                'swimming',
                'circuit',
                'other'
              )
            ),
          protocol_type TEXT NOT NULL
            CHECK (
              protocol_type IN (
                'continuous',
                'time_intervals',
                'distance_intervals',
                'circuit'
              )
            ),
          intensity_method TEXT DEFAULT NULL
            CHECK (
              intensity_method IS NULL
              OR intensity_method IN ('rpe', 'heart_rate', 'pace')
            ),
          intensity_value REAL DEFAULT NULL,
          intensity_reference TEXT DEFAULT NULL
            CHECK (
              intensity_reference IS NULL
              OR intensity_reference IN (
                'max_heart_rate',
                'threshold_pace',
                'maximum_aerobic_speed'
              )
            ),
          intensity_baseline_value REAL DEFAULT NULL,
          continuous_duration_seconds INTEGER DEFAULT NULL
            CHECK (
              continuous_duration_seconds IS NULL
              OR (
                typeof(continuous_duration_seconds) = 'integer'
                AND continuous_duration_seconds BETWEEN 1 AND 86400
              )
            ),
          continuous_distance_meters REAL DEFAULT NULL
            CHECK (
              continuous_distance_meters IS NULL
              OR (
                typeof(continuous_distance_meters) IN ('integer', 'real')
                AND continuous_distance_meters > 0
                AND continuous_distance_meters <= 1000000
              )
            ),
          interval_work_duration_seconds INTEGER DEFAULT NULL
            CHECK (
              interval_work_duration_seconds IS NULL
              OR (
                typeof(interval_work_duration_seconds) = 'integer'
                AND interval_work_duration_seconds BETWEEN 1 AND 86400
              )
            ),
          interval_work_distance_meters REAL DEFAULT NULL
            CHECK (
              interval_work_distance_meters IS NULL
              OR (
                typeof(interval_work_distance_meters) IN ('integer', 'real')
                AND interval_work_distance_meters > 0
                AND interval_work_distance_meters <= 1000000
              )
            ),
          distance_total_duration_seconds INTEGER DEFAULT NULL
            CHECK (
              distance_total_duration_seconds IS NULL
              OR (
                typeof(distance_total_duration_seconds) = 'integer'
                AND distance_total_duration_seconds BETWEEN 1 AND 86400
              )
            ),
          rest_between_repetitions_seconds INTEGER DEFAULT NULL
            CHECK (
              rest_between_repetitions_seconds IS NULL
              OR (
                typeof(rest_between_repetitions_seconds) = 'integer'
                AND rest_between_repetitions_seconds BETWEEN 0 AND 86400
              )
            ),
          repetitions_per_set INTEGER DEFAULT NULL
            CHECK (
              repetitions_per_set IS NULL
              OR (
                typeof(repetitions_per_set) = 'integer'
                AND repetitions_per_set BETWEEN 1 AND 100
              )
            ),
          set_count INTEGER DEFAULT NULL
            CHECK (
              set_count IS NULL
              OR (
                typeof(set_count) = 'integer'
                AND set_count BETWEEN 1 AND 50
              )
            ),
          rest_between_sets_seconds INTEGER DEFAULT NULL
            CHECK (
              rest_between_sets_seconds IS NULL
              OR (
                typeof(rest_between_sets_seconds) = 'integer'
                AND rest_between_sets_seconds BETWEEN 0 AND 86400
              )
            ),
          circuit_round_count INTEGER DEFAULT NULL
            CHECK (
              circuit_round_count IS NULL
              OR (
                typeof(circuit_round_count) = 'integer'
                AND circuit_round_count BETWEEN 1 AND 50
              )
            ),
          circuit_rest_between_stations_seconds INTEGER DEFAULT NULL
            CHECK (
              circuit_rest_between_stations_seconds IS NULL
              OR (
                typeof(circuit_rest_between_stations_seconds) = 'integer'
                AND circuit_rest_between_stations_seconds BETWEEN 0 AND 86400
              )
            ),
          circuit_rest_between_rounds_seconds INTEGER DEFAULT NULL
            CHECK (
              circuit_rest_between_rounds_seconds IS NULL
              OR (
                typeof(circuit_rest_between_rounds_seconds) = 'integer'
                AND circuit_rest_between_rounds_seconds BETWEEN 0 AND 86400
              )
            ),
          CHECK (
            (
              intensity_method IS NULL
              AND intensity_value IS NULL
              AND intensity_reference IS NULL
              AND intensity_baseline_value IS NULL
            )
            OR (
              intensity_method = 'rpe'
              AND intensity_value IS NOT NULL
              AND typeof(intensity_value) IN ('integer', 'real')
              AND intensity_value BETWEEN 1 AND 10
              AND intensity_reference IS NULL
              AND intensity_baseline_value IS NULL
            )
            OR (
              intensity_method = 'heart_rate'
              AND intensity_value IS NOT NULL
              AND typeof(intensity_value) IN ('integer', 'real')
              AND intensity_value BETWEEN 30 AND 260
              AND intensity_reference = 'max_heart_rate'
              AND intensity_baseline_value IS NOT NULL
              AND typeof(intensity_baseline_value) IN ('integer', 'real')
              AND intensity_baseline_value BETWEEN 60 AND 260
              AND intensity_value <= intensity_baseline_value
            )
            OR (
              intensity_method = 'pace'
              AND intensity_value IS NOT NULL
              AND typeof(intensity_value) IN ('integer', 'real')
              AND intensity_value BETWEEN 30 AND 3600
              AND intensity_reference = 'threshold_pace'
              AND intensity_baseline_value IS NOT NULL
              AND typeof(intensity_baseline_value) IN ('integer', 'real')
              AND intensity_baseline_value BETWEEN 30 AND 3600
            )
            OR (
              intensity_method = 'pace'
              AND intensity_value IS NOT NULL
              AND typeof(intensity_value) IN ('integer', 'real')
              AND intensity_value > 0
              AND intensity_value <= 60
              AND intensity_reference = 'maximum_aerobic_speed'
              AND intensity_baseline_value IS NOT NULL
              AND typeof(intensity_baseline_value) IN ('integer', 'real')
              AND intensity_baseline_value > 0
              AND intensity_baseline_value <= 60
            )
          ),
          CHECK (
            (
              protocol_type = 'continuous'
              AND continuous_duration_seconds IS NOT NULL
              AND interval_work_duration_seconds IS NULL
              AND interval_work_distance_meters IS NULL
              AND distance_total_duration_seconds IS NULL
              AND rest_between_repetitions_seconds IS NULL
              AND repetitions_per_set IS NULL
              AND set_count IS NULL
              AND rest_between_sets_seconds IS NULL
              AND circuit_round_count IS NULL
              AND circuit_rest_between_stations_seconds IS NULL
              AND circuit_rest_between_rounds_seconds IS NULL
            )
            OR (
              protocol_type = 'time_intervals'
              AND continuous_duration_seconds IS NULL
              AND continuous_distance_meters IS NULL
              AND interval_work_duration_seconds IS NOT NULL
              AND interval_work_distance_meters IS NULL
              AND distance_total_duration_seconds IS NULL
              AND rest_between_repetitions_seconds IS NOT NULL
              AND repetitions_per_set IS NOT NULL
              AND set_count IS NOT NULL
              AND rest_between_sets_seconds IS NOT NULL
              AND circuit_round_count IS NULL
              AND circuit_rest_between_stations_seconds IS NULL
              AND circuit_rest_between_rounds_seconds IS NULL
            )
            OR (
              protocol_type = 'distance_intervals'
              AND continuous_duration_seconds IS NULL
              AND continuous_distance_meters IS NULL
              AND interval_work_duration_seconds IS NULL
              AND interval_work_distance_meters IS NOT NULL
              AND distance_total_duration_seconds IS NOT NULL
              AND rest_between_repetitions_seconds IS NOT NULL
              AND repetitions_per_set IS NOT NULL
              AND set_count IS NOT NULL
              AND rest_between_sets_seconds IS NOT NULL
              AND circuit_round_count IS NULL
              AND circuit_rest_between_stations_seconds IS NULL
              AND circuit_rest_between_rounds_seconds IS NULL
              AND distance_total_duration_seconds >
                rest_between_repetitions_seconds
                  * (repetitions_per_set - 1)
                  * set_count
                + rest_between_sets_seconds * (set_count - 1)
            )
            OR (
              protocol_type = 'circuit'
              AND continuous_duration_seconds IS NULL
              AND continuous_distance_meters IS NULL
              AND interval_work_duration_seconds IS NULL
              AND interval_work_distance_meters IS NULL
              AND distance_total_duration_seconds IS NULL
              AND rest_between_repetitions_seconds IS NULL
              AND repetitions_per_set IS NULL
              AND set_count IS NULL
              AND rest_between_sets_seconds IS NULL
              AND circuit_round_count IS NOT NULL
              AND circuit_rest_between_stations_seconds IS NOT NULL
              AND circuit_rest_between_rounds_seconds IS NOT NULL
            )
          ),
          FOREIGN KEY (timeline_entry_id)
            REFERENCES timeline_entries (id)
            ON DELETE CASCADE,
          FOREIGN KEY (source_template_id)
            REFERENCES conditioning_session_templates (id)
            ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS conditioning_logs_source_template_id
        ON conditioning_logs (source_template_id);

        CREATE TABLE IF NOT EXISTS conditioning_log_stations (
          timeline_entry_id INTEGER NOT NULL
            CHECK (
              typeof(timeline_entry_id) = 'integer'
              AND timeline_entry_id > 0
            ),
          position INTEGER NOT NULL
            CHECK (
              typeof(position) = 'integer'
              AND position BETWEEN 0 AND 29
            ),
          station_name TEXT NOT NULL
            CHECK (
              typeof(station_name) = 'text'
              AND length(trim(station_name)) BETWEEN 1 AND 60
            ),
          work_duration_seconds INTEGER NOT NULL
            CHECK (
              typeof(work_duration_seconds) = 'integer'
              AND work_duration_seconds BETWEEN 1 AND 86400
            ),
          PRIMARY KEY (timeline_entry_id, position),
          FOREIGN KEY (timeline_entry_id)
            REFERENCES conditioning_logs (timeline_entry_id)
            ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS conditioning_adaptation_scores (
          timeline_entry_id INTEGER PRIMARY KEY NOT NULL
            CHECK (
              typeof(timeline_entry_id) = 'integer'
              AND timeline_entry_id > 0
            ),
          aerobic_base_score REAL NOT NULL
            CHECK (
              typeof(aerobic_base_score) IN ('integer', 'real')
              AND aerobic_base_score BETWEEN 0 AND 100
            ),
          aerobic_power_score REAL NOT NULL
            CHECK (
              typeof(aerobic_power_score) IN ('integer', 'real')
              AND aerobic_power_score BETWEEN 0 AND 100
            ),
          alactic_power_score REAL NOT NULL
            CHECK (
              typeof(alactic_power_score) IN ('integer', 'real')
              AND alactic_power_score BETWEEN 0 AND 100
            ),
          alactic_capacity_score REAL NOT NULL
            CHECK (
              typeof(alactic_capacity_score) IN ('integer', 'real')
              AND alactic_capacity_score BETWEEN 0 AND 100
            ),
          lactic_power_score REAL NOT NULL
            CHECK (
              typeof(lactic_power_score) IN ('integer', 'real')
              AND lactic_power_score BETWEEN 0 AND 100
            ),
          lactic_capacity_score REAL NOT NULL
            CHECK (
              typeof(lactic_capacity_score) IN ('integer', 'real')
              AND lactic_capacity_score BETWEEN 0 AND 100
            ),
          recovery_score REAL NOT NULL
            CHECK (
              typeof(recovery_score) IN ('integer', 'real')
              AND recovery_score BETWEEN 0 AND 100
            ),
          primary_adaptation TEXT NOT NULL
            CHECK (
              primary_adaptation IN (
                'aerobic_base',
                'aerobic_power',
                'alactic_power',
                'alactic_capacity',
                'lactic_power',
                'lactic_capacity',
                'recovery'
              )
            ),
          evidence_level TEXT NOT NULL
            CHECK (evidence_level IN ('full', 'limited')),
          scoring_model_version TEXT NOT NULL
            CHECK (
              typeof(scoring_model_version) = 'text'
              AND length(trim(scoring_model_version)) BETWEEN 1 AND 50
            ),
          FOREIGN KEY (timeline_entry_id)
            REFERENCES conditioning_logs (timeline_entry_id)
            ON DELETE CASCADE
        );
      `);
    });
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
