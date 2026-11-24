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
import { STRENGTH_SEARCH_PAGE } from "../strength/catalog";
import type { ExerciseForm } from "../strength/exerciseForm";
import type { StrengthDraft } from "../strength/types";

export type StrengthStackEntry =
  | {
      baseline: string;
      exerciseId: string;
      fresh: boolean;
      key: string;
      name: "editor";
    }
  | { key: string; name: "builder" }
  | { key: string; name: "picker" }
  | { key: string; name: "detail"; sessionId: string }
  | { key: string; name: "emphasis"; sessionId: string | null };

export type StrengthBuilderMode = "log" | "template";

type ConfirmRequest = {
  confirmLabel: string;
  message: string;
  onConfirm: () => void;
  title: string;
};

type StrengthWorkspaceValue = {
  bumpRevision: () => void;
  closeBranch: () => void;
  confirm: ConfirmRequest | null;
  dismissConfirm: () => void;
  draft: StrengthDraft | null;
  editorForm: { exerciseId: string; value: ExerciseForm } | null;
  setEditorForm: (form: { exerciseId: string; value: ExerciseForm } | null) => void;
  handleHardwareBack: () => boolean;
  mode: StrengthBuilderMode | null;
  openBuilder: (draft: StrengthDraft, mode: StrengthBuilderMode) => void;
  openDetail: (sessionId: string) => void;
  pop: (count?: number) => void;
  push: (entry: StrengthStackEntry) => void;
  registerBackHandler: (handler: (() => boolean) | null) => void;
  requestConfirm: (request: ConfirmRequest) => void;
  resetWorkspace: () => void;
  revision: number;
  savedSnapshot: string;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  markSaved: (draft: StrengthDraft) => void;
  searchLimit: number;
  searchQuery: string;
  setSearchLimit: (limit: number) => void;
  setSearchQuery: (query: string) => void;
  stack: StrengthStackEntry[];
  updateDraft: (draft: StrengthDraft) => void;
};

const StrengthWorkspaceContext = createContext<StrengthWorkspaceValue | null>(null);

export function StrengthWorkspaceProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<StrengthStackEntry[]>([]);
  const [draft, setDraft] = useState<StrengthDraft | null>(null);
  const [editorForm, setEditorForm] = useState<{ exerciseId: string; value: ExerciseForm } | null>(null);
  const [mode, setMode] = useState<StrengthBuilderMode | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLimit, setSearchLimit] = useState(STRENGTH_SEARCH_PAGE);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const backHandler = useRef<(() => boolean) | null>(null);

  const pop = useCallback((count = 1) => {
    const levels = typeof count === "number" ? count : 1;
    setStack((current) => current.slice(0, -levels));
  }, []);

  const push = useCallback((entry: StrengthStackEntry) => {
    setStack((current) => [...current, entry]);
  }, []);

  const resetWorkspace = useCallback(() => {
    if (savingRef.current) return;
    setStack([]);
    setDraft(null);
    setEditorForm(null);
    setMode(null);
    setSavedSnapshot("");
    setSearchQuery("");
    setSearchLimit(STRENGTH_SEARCH_PAGE);
  }, []);

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
    () => ({
      bumpRevision: () => setRevision((current) => current + 1),
      closeBranch: () => {
        if (savingRef.current) return;
        if (draft && JSON.stringify(draft) !== savedSnapshot) {
          setConfirm({
            confirmLabel: "Discard",
            message: "This workout has unsaved changes.",
            onConfirm: resetWorkspace,
            title: "Discard changes?",
          });
        } else {
          resetWorkspace();
        }
      },
      confirm,
      dismissConfirm: () => setConfirm(null),
      draft,
      editorForm,
      setEditorForm,
      handleHardwareBack,
      mode,
      openBuilder: (next, nextMode) => {
        setDraft(next);
        setEditorForm(null);
        setMode(nextMode);
        setSavedSnapshot(JSON.stringify(next));
        setSearchQuery("");
        setSearchLimit(STRENGTH_SEARCH_PAGE);
        setStack([{ key: createId(), name: "builder" }]);
      },
      openDetail: (sessionId) => {
        setStack([{ key: createId(), name: "detail", sessionId }]);
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
      markSaved: (next) => { setDraft(next); setSavedSnapshot(JSON.stringify(next)); },
      searchLimit,
      searchQuery,
      setSearchLimit,
      setSearchQuery,
      stack,
      updateDraft: setDraft,
    }),
    [
      confirm,
      draft,
      editorForm,
      handleHardwareBack,
      mode,
      pop,
      push,
      resetWorkspace,
      revision,
      savedSnapshot,
      saving,
      searchLimit,
      searchQuery,
      stack,
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
