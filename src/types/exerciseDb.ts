// Provider records are ephemeral. Never pass this object to SQLite.
export type ExerciseDbExercise = {
  exerciseId: string;
  name: string;
  gifUrl: string | null;
  bodyParts: string[];
  targetMuscles: string[];
  secondaryMuscles: string[];
  equipments: string[];
  instructions: string[];
  exerciseTypes?: string[];
};
