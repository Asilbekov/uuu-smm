'use client';

import React from 'react';
import {
  ArrowLeft, Briefcase, ClipboardList, Landmark, Link2, Loader2, Palette, Paperclip,
  Plus, Sparkles, Trash2, Upload, UserPlus, Users, X, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Collapse } from '@/components/motion';
import { PhotoshopColorPicker } from '@/components/color-picker';
import { api } from '@/lib/api';
import { uploadSmmFile, sniffType } from '@/lib/smm-client';
import { useSessionStore } from '@/stores/session-store';
import { useEventEditorStore, EMPTY_ROLE, type EventRoleDraft } from '@/stores/event-editor-store';
import { tUI } from '@/lib/i18n';

/**
 * CREATE / EDIT EVENT — the full-page editor, a one-to-one visual clone of
 * the test editor (create-edit-view.tsx + the editor body in app-root):
 * the same sticky 56px header, the same rounded-4xl collapsible section
 * cards, the same publication-variant option cards, the same fixed bottom
 * save bar. Only the TEXT is different — an event stores its brief (ТЗ),
 * its roles (the reusable ТЗ templates — the analogue of the question list),
 * its deadline/budget/restrictions and its publication variant.
 */

export interface SmmEventEditorViewProps {
  goHome: () => void;
  handleSaveEvent: () => void;
  busy: boolean;
}

export default function SmmEventEditorView({ goHome, handleSaveEvent, busy }: SmmEventEditorViewProps) {
  const lang = useSessionStore(s => s.lang);
  const t = React.useCallback((key: string, vars?: Record<string, string | number>) => tUI(lang, key, vars), [lang]);

  const evTitle = useEventEditorStore(s => s.evTitle);
  const setEvTitle = useEventEditorStore(s => s.setEvTitle);
  const evSummary = useEventEditorStore(s => s.evSummary);
  const setEvSummary = useEventEditorStore(s => s.setEvSummary);
  const evBrief = useEventEditorStore(s => s.evBrief);
  const setEvBrief = useEventEditorStore(s => s.setEvBrief);
  const evDeadline = useEventEditorStore(s => s.evDeadline);
  const setEvDeadline = useEventEditorStore(s => s.setEvDeadline);
  const evBudget = useEventEditorStore(s => s.evBudget);
  const setEvBudget = useEventEditorStore(s => s.setEvBudget);
  const evRestrictions = useEventEditorStore(s => s.evRestrictions);
  const setEvRestrictions = useEventEditorStore(s => s.setEvRestrictions);
  const evKind = useEventEditorStore(s => s.evKind);
  const setEvKind = useEventEditorStore(s => s.setEvKind);
  const evCoverColor = useEventEditorStore(s => s.evCoverColor);
  const setEvCoverColor = useEventEditorStore(s => s.setEvCoverColor);
  const evIsPublic = useEventEditorStore(s => s.evIsPublic);
  const setEvIsPublic = useEventEditorStore(s => s.setEvIsPublic);
  const roles = useEventEditorStore(s => s.roles);
  const setRoles = useEventEditorStore(s => s.setRoles);
  const editingEventId = useEventEditorStore(s => s.editingEventId);
  const evFiles = useEventEditorStore(s => s.evFiles);
  const setEvFiles = useEventEditorStore(s => s.setEvFiles);
  const evInfoExpanded = useEventEditorStore(s => s.evInfoExpanded);
  const setEvInfoExpanded = useEventEditorStore(s => s.setEvInfoExpanded);
  const evFilesExpanded = useEventEditorStore(s => s.evFilesExpanded);
  const setEvFilesExpanded = useEventEditorStore(s => s.setEvFilesExpanded);
  const evCoverExpanded = useEventEditorStore(s => s.evCoverExpanded);
  const setEvCoverExpanded = useEventEditorStore(s => s.setEvCoverExpanded);
  const evRolesExpanded = useEventEditorStore(s => s.evRolesExpanded);
  const setEvRolesExpanded = useEventEditorStore(s => s.setEvRolesExpanded);
  const evFileBusy = useEventEditorStore(s => s.evFileBusy);
  const setEvFileBusy = useEventEditorStore(s => s.setEvFileBusy);

  const isEdit = !!editingEventId;
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // One toast state for the role/file side-actions (add/update/delete/upload)
  const [sideError, setSideError] = React.useState('');

  // ---- roles -------------------------------------------------------------
  const updateRoleLocal = (id: string, patch: Partial<EventRoleDraft>) =>
    setRoles(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const addRole = async () => {
    setSideError('');
    if (isEdit) {
      // EDIT mode — the role goes to the server immediately and comes back
      // with its real id (the reusable ТЗ template persists at once).
      const draft = { ...EMPTY_ROLE, id: `local-${Date.now()}` };
      setRoles(prev => [...prev, draft]);
      try {
        const created = await api.addSmmRole(editingEventId!, { name: '' });
        setRoles(prev => prev.map(r => (r.id === draft.id ? { ...created, name: r.name || created.name } : r)));
      } catch {
        setRoles(prev => prev.filter(r => r.id !== draft.id));
        setSideError(t('error'));
      }
    } else {
      // CREATE mode — the draft stays local; the whole array is sent with
      // the create call (the server creates the roles inline).
      setRoles(prev => [...prev, { ...EMPTY_ROLE, id: `local-${Date.now()}` }]);
    }
  };

  const removeRole = async (role: EventRoleDraft) => {
    setSideError('');
    if (isEdit && !role.id.startsWith('local-')) {
      try { await api.deleteSmmRole(role.id); } catch { setSideError(t('error')); return; }
    }
    setRoles(prev => prev.filter(r => r.id !== role.id));
  };

  const commitRole = async (role: EventRoleDraft) => {
    if (!role.name.trim()) return; // nothing typed yet — nothing to save
    if (isEdit && !role.id.startsWith('local-')) {
      try { await api.updateSmmRole(role.id, { name: role.name, brief: role.brief, payment: role.payment, deadline: role.deadline }); } catch { setSideError(t('error')); }
    }
  };

  // ---- files (edit mode only — an event must exist to carry files) --------
  const addFile = async (f: File) => {
    if (!isEdit || evFileBusy) return;
    setSideError('');
    setEvFileBusy(true);
    try {
      const up = await uploadSmmFile(f);
      const row = await api.addSmmFile({ ownerType: 'event', ownerId: editingEventId!, title: f.name, type: sniffType(f), url: up.url, size: up.size ?? null, tgMessageId: up.tgMessageId ?? null });
      setEvFiles(prev => [...prev, row]);
    } catch { setSideError(t('error')); }
    setEvFileBusy(false);
  };

  const removeFile = async (id: string) => {
    setSideError('');
    try { await api.deleteSmmFile(id); setEvFiles(prev => prev.filter(f => f.id !== id)); } catch { setSideError(t('error')); }
  };

  // A plain JSX helper (NOT a component) — keeps the collapsible section
  // headers terse without triggering the static-components rule.
  const chev = (open: boolean) => (open
    ? <ChevronRight className="w-4 h-4 ml-auto shrink-0" />
    : <ChevronDown className="w-4 h-4 ml-auto shrink-0" />);

  return (
    <div className="min-h-screen bg-background screen-enter">
      {/* The same sticky header chrome as the test editor — the uniform
          56px top-panel contract (h-14 mobile / h-16 desktop). */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-4xl mx-auto px-4 h-14 lg:h-16 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goHome} className="rounded-full"><ArrowLeft className="w-4 h-4 mr-1" /> {t('back')}</Button>
          <h1 className="text-lg font-bold">{isEdit ? t('smmEditEventTitle') : t('smmNewEvent')}</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-32 space-y-6">
        {/* ── EVENT INFORMATION — the same collapsible card the test's info
            block uses, with the same publication-variant option cards ── */}
        <Card className="rounded-4xl border border-black bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setEvInfoExpanded(v => !v)}
            className="w-full flex items-center gap-1.5 px-6 py-4 text-left hover:bg-muted/50 transition-colors"
          >
            <ClipboardList className="w-4 h-4 shrink-0" />
            <span className="font-semibold text-base">{t('smmEventInformation')}</span>
            {chev(evInfoExpanded)}
          </button>
          <Collapse open={evInfoExpanded} className="pt-0">
            <CardContent className="space-y-4 !pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('smmEventTitle')}</Label>
                  <Input value={evTitle} onChange={e => setEvTitle(e.target.value)} maxLength={200} placeholder={t('smmEventTitle')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('smmEventKind')}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setEvKind('business')} className={`p-2.5 rounded-xl border-2 transition-all text-left ${evKind === 'business' ? 'border-primary bg-[#FFE8DE] shadow-md' : 'border-transparent bg-muted/50 hover:bg-muted'}`}>
                      <div className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-cta shrink-0" /><span className="font-semibold text-sm">{t('smmKindBusiness')}</span></div>
                    </button>
                    <button type="button" onClick={() => setEvKind('government')} className={`p-2.5 rounded-xl border-2 transition-all text-left ${evKind === 'government' ? 'border-primary bg-[#FFE8DE] shadow-md' : 'border-transparent bg-muted/50 hover:bg-muted'}`}>
                      <div className="flex items-center gap-2"><Landmark className="w-4 h-4 text-primary shrink-0" /><span className="font-semibold text-sm">{t('smmKindGovernment')}</span></div>
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('smmEventSummary')}</Label>
                <Textarea value={evSummary} onChange={e => setEvSummary(e.target.value)} maxLength={1000} rows={2} placeholder={t('smmEventSummaryHint')} />
              </div>
              <div className="space-y-2">
                <Label>{t('smmEventBrief')}</Label>
                <Textarea value={evBrief} onChange={e => setEvBrief(e.target.value)} maxLength={20000} rows={5} placeholder={t('smmEventBriefHint')} />
                <p className="text-xs text-muted-foreground">{t('smmEventBriefHint')}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('smmEventDeadline')}</Label>
                  <Input value={evDeadline} onChange={e => setEvDeadline(e.target.value)} maxLength={120} placeholder={t('smmEventDeadlineHint')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('smmEventBudget')}</Label>
                  <Input value={evBudget} onChange={e => setEvBudget(e.target.value)} maxLength={120} placeholder={t('smmEventBudgetHint')} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('smmEventRestrictions')}</Label>
                <Textarea value={evRestrictions} onChange={e => setEvRestrictions(e.target.value)} maxLength={2000} rows={2} placeholder={t('smmEventRestrictionsHint')} />
              </div>
              {/* Publication variant — the SAME option-card pair the test
              editor uses: «Только по ссылке» keeps the event out of the
              general library (the link still opens it), «Всему сообществу»
              puts it into the general events library (discover). */}
              <div className="space-y-2">
                <Label>{t('publishVariant')}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEvIsPublic(false)}
                    className={`p-2.5 sm:p-3 rounded-xl border-2 transition-all text-left ${
                      !evIsPublic
                        ? 'border-primary bg-[#FFE8DE] shadow-md'
                        : 'border-transparent bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <Link2 className="w-4 h-4 text-cta shrink-0" />
                      <span className="font-semibold text-sm">{t('shareOptLink')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('shareOptLinkSub')}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEvIsPublic(true)}
                    className={`p-2.5 sm:p-3 rounded-xl border-2 transition-all text-left ${
                      evIsPublic
                        ? 'border-primary bg-[#FFE8DE] shadow-md'
                        : 'border-transparent bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <Users className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-semibold text-sm">{t('shareOptCommunity')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('shareOptCommunitySub')}</p>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{t('publishNote')}</p>
              </div>
            </CardContent>
          </Collapse>
        </Card>

        {/* ── ATTACHED FILES — the same collapsed-one-line card; files live
            only on an existing event (create first, attach after) ── */}
        <Card className="rounded-4xl border border-black bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setEvFilesExpanded(v => !v)}
            className="w-full flex items-center gap-1.5 px-6 py-4 text-left hover:bg-muted/50 transition-colors"
          >
            <Paperclip className="w-4 h-4 shrink-0" />
            <span className="font-semibold text-base">{t('attachedFiles', { n: evFiles.length })}</span>
            {chev(evFilesExpanded)}
          </button>
          <Collapse open={evFilesExpanded} keepMountedOnceShown>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground mb-3">{isEdit ? t('smmEventFilesHint') : t('smmEventFilesAfterCreate')}</p>
              {isEdit && (
                <>
                  <div className="space-y-2">
                    {evFiles.map(f => (
                      <div key={f.id} className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2">
                        <Paperclip className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-sm min-w-0 flex-1 truncate">{f.title}</span>
                        <button type="button" onClick={() => removeFile(f.id)} className="text-destructive shrink-0" aria-label={t('delete')}><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void addFile(f); }} />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={evFileBusy} className="mt-3 rounded-full">
                    {evFileBusy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />} {t('smmUploadFile')}
                  </Button>
                </>
              )}
            </CardContent>
          </Collapse>
        </Card>

        {/* ── COVER — the same card color customization (the feed derives the
            color automatically when nothing is chosen) ── */}
        <Card className="rounded-4xl border border-black bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setEvCoverExpanded(v => !v)}
            className="w-full flex items-center gap-1.5 px-6 py-4 text-left hover:bg-muted/50 transition-colors"
          >
            <Palette className="w-4 h-4 shrink-0" />
            <span className="font-semibold text-base">{t('cover')}</span>
            {chev(evCoverExpanded)}
          </button>
          <Collapse open={evCoverExpanded}>
            <CardContent className="space-y-4 !pt-0">
              <p className="text-xs text-muted-foreground">{t('smmEventCoverHint')}</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">{t('cardColor')}</Label>
                  <button
                    type="button"
                    onClick={() => setEvCoverColor('')}
                    title={t('auto')}
                    className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border-2 transition-all ${
                      evCoverColor === '' ? 'border-cta bg-[#FFF0D9] text-cta font-semibold' : 'border-black/10 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" /> {t('auto')}
                  </button>
                </div>
                <PhotoshopColorPicker value={evCoverColor || '#E3EEFF'} onChange={v => setEvCoverColor(v)} />
              </div>
            </CardContent>
          </Collapse>
        </Card>

        {/* ── ROLES (ТЗ) — the event's analogue of the question list: the
            reusable ТЗ templates specialists apply for / are invited to ── */}
        <Card className="rounded-4xl border border-black bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setEvRolesExpanded(v => !v)}
            className="w-full flex items-center gap-1.5 px-6 py-4 text-left hover:bg-muted/50 transition-colors"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span className="font-semibold text-base">{t('smmTabRoles')} · {t('smmRolesN', { n: roles.length })}</span>
            {chev(evRolesExpanded)}
          </button>
          <Collapse open={evRolesExpanded} keepMountedOnceShown>
            <CardContent className="!pt-0">
              <div className="flex justify-end gap-2 mb-4">
                <Button size="sm" onClick={addRole} data-testid="add-role">
                  <Plus className="w-3 h-3 mr-1" /> {t('smmAddRole')}
                </Button>
              </div>
              {roles.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{t('smmNoRolesYet')}</p>
              )}
              <div className="space-y-4">
                {roles.map((r, idx) => (
                  <Card key={r.id} className="rounded-3xl border border-black bg-white">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">{t('smmRoleN')} {idx + 1}</Badge>
                        <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => void removeRole(r)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <Input value={r.name} onChange={e => updateRoleLocal(r.id, { name: e.target.value })} onBlur={() => void commitRole(r)} maxLength={120} placeholder={t('smmRoleName')} />
                      <Textarea value={r.brief} onChange={e => updateRoleLocal(r.id, { brief: e.target.value })} onBlur={() => void commitRole(r)} rows={3} maxLength={8000} placeholder={t('smmRoleBriefPlaceholder')} />
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={r.payment} onChange={e => updateRoleLocal(r.id, { payment: e.target.value })} onBlur={() => void commitRole(r)} maxLength={120} placeholder={t('smmRolePayment')} />
                        <Input value={r.deadline} onChange={e => updateRoleLocal(r.id, { deadline: e.target.value })} onBlur={() => void commitRole(r)} maxLength={120} placeholder={t('smmRoleDeadline')} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Collapse>
        </Card>

        {sideError && <p className="text-sm text-destructive text-center">{sideError}</p>}
      </main>

      {/* Bottom action bar — the same fixed bar as the test editor: fixed to
          the screen edge on phones, a floating dock pill on desktop. */}
      <div className="desktop-dock fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-black/10">
        <div
          className="max-w-4xl mx-auto px-4 pt-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <Button
            onClick={handleSaveEvent}
            disabled={busy || !evTitle.trim()}
            className="w-full h-9 lg:h-11 lg:text-base rounded-full bg-primary hover:bg-primary/90"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? t('save') : t('smmCreateEvent')}
          </Button>
        </div>
      </div>
    </div>
  );
}

