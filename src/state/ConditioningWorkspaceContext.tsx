import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { WorkoutDraft } from "../conditioning/drafts";
import type { StructuredFormat, WorkoutSnapshot } from "../conditioning/types";

export type ConditioningLogRequest = {
  date: string;
  planSessionId: string | null;
  snapshot: WorkoutSnapshot;
  templateId: string | null;
  time: Date;
};

export type ConditioningStackEntry =
  | { key: string; name: "detail"; sessionId: string }
  | { key: string; name: "emphasis"; sessionId: string | null }
  | { key: string; name: "free" }
  | { key: string; name: "log"; planSessionId: string | null }
  | { key: string; name: "runner"; sessionId: string }
  | { key: string; name: "saved" }
  | { key: string; name: "station"; stationId: string | null }
  | { key: string; name: "summary"; sessionId: string };

export type ConditioningEditor = {
  draft: WorkoutDraft;
  format: StructuredFormat;
  planSessionId: string | null;
  savedSnapshot: string;
  templateId: string | null;
};

type ConfirmRequest = {
  cancelLabel?: string;
  confirmLabel: string;
  message: string;
  onConfirm: () => void;
  title: string;
};

type ConditioningWorkspaceValue = {
  bumpRevision: () => void;
  closeEditor: () => void;
  confirm: ConfirmRequest | null;
  confirmDiscard: (onConfirm: () => void) => void;
  dismissConfirm: () => void;
  editor: ConditioningEditor | null;
  handleHardwareBack: () => boolean;
  logRequest: ConditioningLogRequest | null;
  openEditor: (editor: ConditioningEditor) => void;
  pop: () => void;
  push: (entry: ConditioningStackEntry) => void;
  registerBackHandler: (handler: (() => boolean) | null) => void;
  requestConfirm: (request: ConfirmRequest) => void;
  setLogRequest: (request: ConditioningLogRequest | null) => void;
  resetStack: () => void;
  revision: number;
  stack: ConditioningStackEntry[];
  updateEditor: (draft: WorkoutDraft) => void;
};

const ConditioningWorkspaceContext =
  createContext<ConditioningWorkspaceValue | null>(null);

export function ConditioningWorkspaceProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<ConditioningStackEntry[]>([]);
  const [editor, setEditor] = useState<ConditioningEditor | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [revision, setRevision] = useState(0);
  const [logRequest, setLogRequest] = useState<ConditioningLogRequest | null>(null);
  const backHandler = useRef<(() => boolean) | null>(null);

  const pop = useCallback(() => {
    setStack((current) => current.slice(0, -1));
  }, []);

  const push = useCallback((entry: ConditioningStackEntry) => {
    setStack((current) => [...current, entry]);
  }, []);

  const closeEditor = useCallback(() => {
    setEditor(null);
  }, []);

  const handleHardwareBack = useCallback(() => {
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

    if (editor) {
      if (editor.savedSnapshot !== JSON.stringify(editor.draft)) {
        setConfirm({
          confirmLabel: "Discard",
          message: "This workout has unsaved changes.",
          onConfirm: () => setEditor(null),
          title: "Discard changes?",
        });
      } else {
        setEditor(null);
      }
      return true;
    }

    return false;
  }, [confirm, editor, stack.length]);

  const value = useMemo<ConditioningWorkspaceValue>(
    () => ({
      bumpRevision: () => setRevision((current) => current + 1),
      closeEditor,
      confirm,
      confirmDiscard: (onConfirm) =>
        setConfirm({
          confirmLabel: "Discard",
          message: "This recording will be removed. A planned session stays on the calendar.",
          onConfirm,
          title: "Discard recording?",
        }),
      dismissConfirm: () => setConfirm(null),
      editor,
      handleHardwareBack,
      logRequest,
      openEditor: setEditor,
      pop,
      push,
      registerBackHandler: (handler) => {
        backHandler.current = handler;
      },
      requestConfirm: setConfirm,
      setLogRequest,
      resetStack: () => setStack([]),
      revision,
      stack,
      updateEditor: (draft) =>
        setEditor((current) => (current ? { ...current, draft } : current)),
    }),
    [closeEditor, confirm, editor, handleHardwareBack, logRequest, pop, push, revision, stack],
  );

  return (
    <ConditioningWorkspaceContext.Provider value={value}>
      {children}
    </ConditioningWorkspaceContext.Provider>
  );
}

export function useConditioningWorkspace() {
  const value = useContext(ConditioningWorkspaceContext);
  if (!value) {
    throw new Error("useConditioningWorkspace must be used inside ConditioningWorkspaceProvider");
  }

  return value;
}

export function editorIsDirty(editor: ConditioningEditor | null) {
  return editor !== null && editor.savedSnapshot !== JSON.stringify(editor.draft);
}
