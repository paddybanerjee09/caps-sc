import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { createId } from "../conditioning/ids";
import type { StrengthDraft } from "../strength/types";

export type StrengthStackEntry =
  | { key: string; name: "builder"; completingPlan?: boolean }
  | { key: string; name: "detail"; sessionId: string }
  | { key: string; name: "emphasis"; sessionId: string | null };

type ConfirmRequest = {
  confirmLabel: string;
  message: string;
  onConfirm: () => void;
  title: string;
};

type StrengthWorkspaceValue = {
  backFromBuilder: () => void;
  bumpRevision: () => void;
  closeBranch: () => void;
  confirm: ConfirmRequest | null;
  dismissConfirm: () => void;
  draft: StrengthDraft | null;
  handleHardwareBack: () => boolean;
  openBuilder: (draft: StrengthDraft) => void;
  openDetail: (sessionId: string) => void;
  openPlanCompletion: (draft: StrengthDraft) => void;
  pop: (count?: number) => void;
  push: (entry: StrengthStackEntry) => void;
  registerBackHandler: (handler: (() => boolean) | null) => void;
  requestConfirm: (request: ConfirmRequest) => void;
  resetWorkspace: () => void;
  revision: number;
  savedSnapshot: string;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  setTextInputFocused: (focused: boolean) => void;
  markSaved: (draft: StrengthDraft) => void;
  stack: StrengthStackEntry[];
  textInputFocused: boolean;
  updateDraft: (update: (draft: StrengthDraft) => StrengthDraft) => void;
};

const StrengthWorkspaceContext = createContext<StrengthWorkspaceValue | null>(null);

export function StrengthWorkspaceProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<StrengthStackEntry[]>([]);
  const [draft, setDraft] = useState<StrengthDraft | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [textInputFocused, setTextInputFocused] = useState(false);
  const savingRef = useRef(false);
  const backHandler = useRef<(() => boolean) | null>(null);

  const pop = useCallback((count = 1) => {
    const levels = typeof count === "number" ? count : 1;
    setStack((current) => current.slice(0, -levels));
  }, []);

  const push = useCallback((entry: StrengthStackEntry) => {
    setStack((current) => [...current, entry]);
  }, []);

  const clearDraft = useCallback(() => {
    setDraft(null);
    setSavedSnapshot("");
    setTextInputFocused(false);
  }, []);

  const resetWorkspace = useCallback(() => {
    if (savingRef.current) return;
    setStack([]);
    clearDraft();
  }, [clearDraft]);

  const handleHardwareBack = useCallback(() => {
    if (savingRef.current) return true;
    if (confirm) {
      setConfirm(null);
      return true;
    }
    if (backHandler.current?.()) {
      return true;
    }
    if (stack.length > 0) {
      setStack((current) => current.slice(0, -1));
      return true;
    }
    return false;
  }, [confirm, stack.length]);

  const value = useMemo<StrengthWorkspaceValue>(
    () => {
      function confirmDiscard(action: () => void) {
        if (savingRef.current) return;
        const hasPerformedEntries = draft?.exercises.some((exercise) =>
          exercise.sets.some(({ actual }) => actual && Object.values(actual).some((value) => typeof value === "string" ? value.trim() !== "" : value === true)),
        );
        if (draft && (hasPerformedEntries || JSON.stringify(draft) !== savedSnapshot)) {
          setConfirm({
            confirmLabel: "Discard",
            message: "This workout has unsaved changes.",
            onConfirm: action,
            title: "Discard changes?",
          });
        } else {
          action();
        }
      }

      function startDraft(next: StrengthDraft) {
        setDraft(next);
        setSavedSnapshot(JSON.stringify(next));
      }

      return {
        backFromBuilder: () => confirmDiscard(stack.length > 1 ? () => {
          pop();
          clearDraft();
        } : resetWorkspace),
        bumpRevision: () => setRevision((current) => current + 1),
        closeBranch: () => confirmDiscard(resetWorkspace),
        confirm,
        dismissConfirm: () => setConfirm(null),
        draft,
        handleHardwareBack,
        openBuilder: (next) => {
          startDraft(next);
          setStack([{ key: createId(), name: "builder" }]);
        },
        openDetail: (sessionId) => {
          clearDraft();
          setStack([{ key: createId(), name: "detail", sessionId }]);
        },
        openPlanCompletion: (next) => {
          const detail = stack.at(-1);
          if (savingRef.current || detail?.name !== "detail" || detail.sessionId !== next.sessionId) return;
          startDraft(next);
          setStack([...stack, { key: createId(), name: "builder", completingPlan: true }]);
        },
        pop,
        push,
        registerBackHandler: (handler) => {
          backHandler.current = handler;
        },
        requestConfirm: setConfirm,
        resetWorkspace,
        revision,
        savedSnapshot,
        saving,
        setSaving: (next) => { savingRef.current = next; setSaving(next); },
        setTextInputFocused,
        markSaved: startDraft,
        stack,
        textInputFocused,
        updateDraft: (update) => setDraft((current) => current ? update(current) : null),
      };
    },
    [
      clearDraft,
      confirm,
      draft,
      handleHardwareBack,
      pop,
      push,
      resetWorkspace,
      revision,
      savedSnapshot,
      saving,
      stack,
      textInputFocused,
    ],
  );

  return (
    <StrengthWorkspaceContext.Provider value={value}>
      {children}
    </StrengthWorkspaceContext.Provider>
  );
}

export function useStrengthWorkspace() {
  const value = useContext(StrengthWorkspaceContext);
  if (!value) {
    throw new Error("useStrengthWorkspace must be used inside StrengthWorkspaceProvider");
  }
  return value;
}
