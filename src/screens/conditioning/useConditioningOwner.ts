import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";

import { getConditioningOwnerId } from "../../data/conditioningRepository";

export function useConditioningOwner() {
  const db = useSQLiteContext();
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getConditioningOwnerId(db).then((id) => {
      if (!cancelled) {
        setOwnerId(id);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [db]);

  return { db, ownerId };
}
