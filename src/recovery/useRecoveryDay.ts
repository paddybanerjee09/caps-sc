import { AppState } from "react-native";
import { useEffect, useState } from "react";

export function currentRecoveryDay() {
  const now = new Date();
  return {
    localDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/** Recheck calendar boundaries and timezone on resume; DST days need not be 24 hours. */
export function useRecoveryDay() {
  const [day, setDay] = useState(currentRecoveryDay);
  useEffect(() => {
    const check = () => {
      const next = currentRecoveryDay();
      setDay((old) => old.localDate === next.localDate && old.timezone === next.timezone ? old : next);
    };
    const timer = setInterval(check, 15_000);
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") check(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  return day;
}
