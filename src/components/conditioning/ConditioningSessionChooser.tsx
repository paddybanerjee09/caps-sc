import type { StructuredFormat } from "../../conditioning/types";
import { SessionChooser, type SessionOption } from "../training/SessionChooser";

const options: SessionOption<"free" | StructuredFormat>[] = [
  { value: "free", title: "Free Session", description: "Run / bike", icon: "walk-outline" },
  { value: "time_interval", title: "Time Interval", description: "Work / rest timer", icon: "timer-outline" },
  { value: "sprint", title: "Sprints", description: "Distance repeats", icon: "flash-outline" },
  { value: "circuit", title: "Circuit", description: "Station rounds", icon: "repeat-outline" },
];

export function ConditioningSessionChooser({ onClose, onSelect }: {
  onClose: () => void;
  onSelect: (format: "free" | StructuredFormat) => void;
}) {
  return <SessionChooser onClose={onClose} onSelect={onSelect} options={options} />;
}
