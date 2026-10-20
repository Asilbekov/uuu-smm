import { makeStore } from '@/stores/make-store';

// ---------------------------------------------------------------------------
// EVENT EDITOR store — the create/edit EVENT form (the «Мероприятия» analogue
// of the test editor): title, summary, brief (ТЗ), deadline, budget,
// restrictions, kind, cover color, publication variant and the ROLES
// (the ТЗ templates — the event's answer to the test's question list).
// One `resetEventForm()` returns the form to its pristine "new event" shape.
// ---------------------------------------------------------------------------

export interface EventRoleDraft {
  // Local drafts in create mode have a temp id ("local-*"); edit mode works
  // against real SmmRole ids (immediate server add/update/delete).
  id: string;
  name: string;
  brief: string;
  payment: string;
  deadline: string;
}

interface EventEditorData {
  evTitle: string;
  evSummary: string;
  evBrief: string;
  evDeadline: string;
  evBudget: string;
  evRestrictions: string;
  evKind: 'business' | 'government';
  evCoverColor: string;
  // Publication variant — the SAME semantics as the test's: false = only
  // people with the link, true = the general events library (discover).
  evIsPublic: boolean;
  roles: EventRoleDraft[];
  // Set while the editor is bound to an existing event (edit mode)
  editingEventId: string | null;
  // Files attached to the bound event (edit mode, SmmFile rows)
  evFiles: any[];
  // Section collapse states — all sections start collapsed, the page opens
  // as a compact list of one-line cards (the test editor's behavior)
  evInfoExpanded: boolean;
  evFilesExpanded: boolean;
  evCoverExpanded: boolean;
  evRolesExpanded: boolean;
  // Upload progress marker
  evFileBusy: boolean;
}

const INITIAL: EventEditorData = {
  evTitle: '',
  evSummary: '',
  evBrief: '',
  evDeadline: '',
  evBudget: '',
  evRestrictions: '',
  evKind: 'business',
  evCoverColor: '',
  evIsPublic: true,
  roles: [],
  editingEventId: null,
  evFiles: [],
  evInfoExpanded: false,
  evFilesExpanded: false,
  evCoverExpanded: false,
  evRolesExpanded: false,
  evFileBusy: false,
};

export const useEventEditorStore = makeStore(INITIAL);

// Fresh, hook-free read for long-running handlers (save/edit flows)
export const eventEditorNow = () => useEventEditorStore.getState();

function freshEventEditor(): EventEditorData {
  return { ...INITIAL, roles: [], evFiles: [] };
}

/** Return every form field to its pristine "new event" shape. */
export function resetEventForm() {
  useEventEditorStore.setState(freshEventEditor());
}

export const EMPTY_ROLE: EventRoleDraft = {
  id: '', name: '', brief: '', payment: '', deadline: '',
};
