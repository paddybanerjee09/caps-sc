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
import { activityFormValues, type SkillActivityForm } from "../skill/activityForm";
import { templateFingerprint } from "../skill/drafts";
import type { SkillDraft } from "../skill/types";

export type SkillStackEntry =
  | { key: string; name: "builder" }
  | { key: string; name: "picker" }
  | { key: string; name: "editor"; activityId: string; fresh: boolean; baseline: string }
  | { key: string; name: "detail"; sessionId: string };

type ConfirmRequest = {
  confirmLabel: string;
  message: string;
  onConfirm: () => void;
  title: string;
};

type SkillWorkspaceValue = {
  bumpRevision: () => void;
  closeBranch: () => void;
  push: (entry: SkillStackEntry) => void;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activityForm: { activityId: string; value: SkillActivityForm } | null;
  setActivityForm: (form: { activityId: string; value: SkillActivityForm } | null) => void;
  calendarDate: string | null;
  calendarNonce: number;
  completeLog: (localDate: string) => void;
  confirm: ConfirmRequest | null;
  discardBaseline: string;
  dismissConfirm: () => void;
  draft: SkillDraft | null;
  handleHardwareBack: () => boolean;
  markTemplateSaved: (draft: SkillDraft) => void;
  markTemplateUnsaved: (draft: SkillDraft) => void;
  openBuilder: (draft: SkillDraft) => void;
  openDetail: (sessionId: string) => void;
  pop: (levels?: number) => void;
  registerBackHandler: (handler: (() => boolean) | null) => void;
  requestConfirm: (request: ConfirmRequest) => void;
  resetWorkspace: () => void;
  revision: number;
  stack: SkillStackEntry[];
  templateBaseline: string | null;
  updateDraft: (draft: SkillDraft) => void;
};

const SkillWorkspaceContext = createContext<SkillWorkspaceValue | null>(null);

export function SkillWorkspaceProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<SkillStackEntry[]>([]);
  const [draft, setDraft] = useState<SkillDraft | null>(null);
  const [discardBaseline, setDiscardBaseline] = useState("");
  const [templateBaseline, setTemplateBaseline] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [revision, setRevision] = useState(0);
  const [calendarDate, setCalendarDate] = useState<string | null>(null);
  const [calendarNonce, setCalendarNonce] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activityForm, setActivityForm] = useState<{ activityId: string; value: SkillActivityForm } | null>(null);
  const backHandler = useRef<(() => boolean) | null>(null);

  const resetWorkspace = useCallback(() => {
    if (savingRef.current) return;
    setActivityForm(null);
    setSearchQuery("");
    setStack([]);
    setDraft(null);
    setDiscardBaseline("");
    setTemplateBaseline(null);
    setConfirm(null);
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

  const value = useMemo<SkillWorkspaceValue>(
    () => ({
      bumpRevision: () => setRevision((current) => current + 1),
      calendarDate,
      calendarNonce,
      activityForm,
      setActivityForm,
      searchQuery,
      setSearchQuery,
      saving,
      setSaving: (next) => { savingRef.current = next; setSaving(next); },
      push: (entry) => setStack((current) => [...current, entry]),
      closeBranch: () => {
        if (savingRef.current) return;
        const editing = draft?.activities.find((activity) => activity.id === activityForm?.activityId);
        const formChanged = editing && activityForm && JSON.stringify(activityForm.value) !== JSON.stringify(activityFormValues(editing));
        if (draft && (JSON.stringify(draft) !== discardBaseline || formChanged)) {
          setConfirm({ confirmLabel: "Discard", message: "Unlogged changes will be discarded. Saved sessions remain available.", onConfirm: resetWorkspace, title: "Leave session?" });
        } else resetWorkspace();
      },
      completeLog: (localDate) => {
        setActivityForm(null);
        setSearchQuery("");
        setCalendarDate(localDate);
        setCalendarNonce((current) => current + 1);
        setStack([]);
        setDraft(null);
        setDiscardBaseline("");
        setTemplateBaseline(null);
        setConfirm(null);
        setRevision((current) => current + 1);
      },
      confirm,
      discardBaseline,
      dismissConfirm: () => setConfirm(null),
      draft,
      handleHardwareBack,
      markTemplateSaved: (next) => {
        setDraft(next);
        setDiscardBaseline(JSON.stringify(next));
        setTemplateBaseline(templateFingerprint(next));
      },
      markTemplateUnsaved: (next) => {
        setDraft(next);
        setTemplateBaseline(null);
      },
      openBuilder: (next) => {
        setDraft(next);
        setActivityForm(null);
        setSearchQuery("");
        setDiscardBaseline(JSON.stringify(next));
        setTemplateBaseline(next.templateLink === "linked" ? templateFingerprint(next) : null);
        setConfirm(null);
        setStack([{ key: createId(), name: "builder" }]);
      },
      openDetail: (sessionId) => {
        setConfirm(null);
        setStack([{ key: createId(), name: "detail", sessionId }]);
      },
      pop: (count = 1) => setStack((current) => current.slice(0, -(typeof count === "number" ? count : 1))),
      registerBackHandler: (handler) => {
        backHandler.current = handler;
      },
      requestConfirm: setConfirm,
      resetWorkspace,
      revision,
      stack,
      templateBaseline,
      updateDraft: setDraft,
    }),
    [
      calendarDate,
      calendarNonce,
      activityForm,
      searchQuery,
      saving,
      confirm,
      discardBaseline,
      draft,
      handleHardwareBack,
      resetWorkspace,
      revision,
      stack,
      templateBaseline,
    ],
  );

  return (
    <SkillWorkspaceContext.Provider value={value}>{children}</SkillWorkspaceContext.Provider>
  );
}

export function useSkillWorkspace() {
  const value = useContext(SkillWorkspaceContext);
  if (!value) {
    throw new Error("useSkillWorkspace must be used inside SkillWorkspaceProvider");
  }
  return value;
}
