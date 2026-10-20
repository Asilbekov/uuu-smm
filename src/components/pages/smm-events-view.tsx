'use client';

import React from 'react';
import {
  ArrowLeft, Banknote, Briefcase, Building2, CalendarClock, FileText, Landmark,
  Loader2, Paperclip, Pencil, Plus, ShieldAlert, Trash2, Upload, UserPlus, Users, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ResizableSheetFrame } from '@/components/resize-sheet';
import { api } from '@/lib/api';
import { uploadSmmFile, sniffType, smmCoverColor } from '@/lib/smm-client';
import { useSessionStore } from '@/stores/session-store';
import { tUI } from '@/lib/i18n';
import type { SmmEventItem } from '@/lib/app-types';

// ---------------------------------------------------------------------------
// SMM EVENTS — the customer's events manager: the list of my events
// («+ Создать»), and per event the SAME resizable window the test editor
// uses, with four tabs: Инфо (the brief), Роли (ТЗ templates + assigned
// specialists), Отклики (incoming applications), Приглашения (sent invites).
// ---------------------------------------------------------------------------

type Tab = 'info' | 'roles' | 'apps' | 'invites';

export interface SmmEventsViewProps {
  goHome: () => void;
}

const EMPTY_FORM = {
  title: '', summary: '', brief: '', deadline: '', budget: '', restrictions: '',
  kind: 'business' as string, status: 'open' as string,
};

export default function SmmEventsView({ goHome }: SmmEventsViewProps) {
  const lang = useSessionStore(s => s.lang);
  const t = React.useCallback((key: string, vars?: Record<string, string | number>) => tUI(lang, key, vars), [lang]);
  const [events, setEvents] = React.useState<SmmEventItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SmmEventItem | null>(null); // null + sheetOpen = create
  const [form, setForm] = React.useState({ ...EMPTY_FORM });
  const [tab, setTab] = React.useState<Tab>('info');
  const [busy, setBusy] = React.useState(false);
  const [roles, setRoles] = React.useState<any[]>([]);
  const [apps, setApps] = React.useState<any[]>([]);
  const [invites, setInvites] = React.useState<any[]>([]);
  const [files, setFiles] = React.useState<any[]>([]);
  const [newRole, setNewRole] = React.useState({ name: '', brief: '', payment: '', deadline: '' });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try { setEvents(await api.getMySmmEvents()); } catch { /* transient */ }
    setLoading(false);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const openEditor = async (ev: SmmEventItem | null) => {
    setEditing(ev);
    setTab('info');
    setSheetOpen(true);
    if (ev) {
      setForm({
        title: ev.title || '', summary: ev.summary || '', brief: ev.brief || '',
        deadline: ev.deadline || '', budget: ev.budget || '', restrictions: ev.restrictions || '',
        kind: ev.kind || 'business', status: ev.status || 'open',
      });
      try {
        const detail = await api.getSmmEvent(ev.id);
        setRoles(detail.roles || []);
        setFiles(detail.files || []);
      } catch { /* transient */ }
      try { setApps((await api.getSmmApplications('inbox')).filter(a => a.eventId === ev.id)); } catch { /* transient */ }
      try { setInvites((await api.getSmmInvitations('sent')).filter(i => i.eventId === ev.id)); } catch { /* transient */ }
    } else {
      setForm({ ...EMPTY_FORM }); setRoles([]); setFiles([]); setApps([]); setInvites([]);
    }
  };

  const saveEvent = async () => {
    if (!form.title.trim() || busy) return;
    setBusy(true);
    try {
      if (editing) {
        await api.updateSmmEvent(editing.id, form);
      } else {
        const created = await api.createSmmEvent(form);
        setEditing(created);
      }
      await load();
    } catch { /* the toast surfaces via the catch below */ }
    setBusy(false);
  };

  const removeEvent = async () => {
    if (!editing || busy) return;
    setBusy(true);
    try { await api.deleteSmmEvent(editing.id); setSheetOpen(false); await load(); } catch { /* transient */ }
    setBusy(false);
  };

  const addRole = async () => {
    if (!editing || !newRole.name.trim() || busy) return;
    setBusy(true);
    try {
      await api.addSmmRole(editing.id, newRole);
      setNewRole({ name: '', brief: '', payment: '', deadline: '' });
      const detail = await api.getSmmEvent(editing.id);
      setRoles(detail.roles || []);
      await load();
    } catch { /* transient */ }
    setBusy(false);
  };

  const removeRole = async (id: string) => {
    if (!editing || busy) return;
    setBusy(true);
    try { await api.deleteSmmRole(id); setRoles(prev => prev.filter(r => r.id !== id)); await load(); } catch { /* transient */ }
    setBusy(false);
  };

  const addFile = async (f: File) => {
    if (!editing || busy) return;
    setBusy(true);
    try {
      const up = await uploadSmmFile(f);
      await api.addSmmFile({ ownerType: 'event', ownerId: editing.id, title: f.name, type: sniffType(f), url: up.url, size: up.size ?? null, tgMessageId: up.tgMessageId ?? null });
      const detail = await api.getSmmEvent(editing.id);
      setFiles(detail.files || []);
    } catch { /* transient */ }
    setBusy(false);
  };

  const removeFile = async (id: string) => {
    if (!editing || busy) return;
    setBusy(true);
    try { await api.deleteSmmFile(id); setFiles(prev => prev.filter(f => f.id !== id)); } catch { /* transient */ }
    setBusy(false);
  };

  const respondApp = async (id: string, action: 'accept' | 'decline') => {
    setBusy(true);
    try {
      await api.respondSmmApplication(id, action);
      setApps(prev => prev.map(a => (a.id === id ? { ...a, status: action === 'accept' ? 'accepted' : 'declined' } : a)));
      if (editing) { const detail = await api.getSmmEvent(editing.id); setRoles(detail.roles || []); }
    } catch { /* transient */ }
    setBusy(false);
  };

  const pendingN = (ev: SmmEventItem) => ev.pendingApplications || 0;

  const editorBody = (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Tabs — the roles tab is the brief's «вкладка ролей» */}
      <div className="flex gap-1.5 overflow-x-auto">
        {([
          ['info', t('smmTabInfo')],
          ['roles', `${t('smmTabRoles')}${roles.length ? ` (${roles.length})` : ''}`],
          ['apps', `${t('smmTabApps')}${apps.filter(a => a.status === 'pending').length ? ` (${apps.filter(a => a.status === 'pending').length})` : ''}`],
          ['invites', t('smmTabInvites')],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`shrink-0 px-3 py-1.5 rounded-full border-2 text-xs font-semibold transition-colors ${tab === key ? 'bg-cta text-white border-cta' : 'border-black/15 bg-white hover:bg-muted/50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">{t('smmEventTitle')}</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} maxLength={200} className="rounded-full border-black/20 bg-white" placeholder={t('smmEventTitle')} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">{t('smmEventSummary')}</Label>
            <Textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} rows={2} maxLength={1000} className="rounded-2xl border-black/15 bg-white" placeholder={t('smmEventSummaryHint')} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">{t('smmEventBrief')}</Label>
            <Textarea value={form.brief} onChange={e => setForm(f => ({ ...f, brief: e.target.value }))} rows={5} maxLength={20000} className="rounded-2xl border-black/15 bg-white" placeholder={t('smmEventBriefHint')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">{t('smmEventDeadline')}</Label>
              <Input value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} maxLength={120} className="rounded-full border-black/20 bg-white" placeholder={t('smmEventDeadlineHint')} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">{t('smmEventBudget')}</Label>
              <Input value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} maxLength={120} className="rounded-full border-black/20 bg-white" placeholder={t('smmEventBudgetHint')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">{t('smmEventRestrictions')}</Label>
            <Textarea value={form.restrictions} onChange={e => setForm(f => ({ ...f, restrictions: e.target.value }))} rows={2} maxLength={2000} className="rounded-2xl border-black/15 bg-white" placeholder={t('smmEventRestrictionsHint')} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">{t('smmEventKind')}</Label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setForm(f => ({ ...f, kind: 'business' }))} className={`p-2.5 rounded-xl border-2 text-left transition-all ${form.kind === 'business' ? 'border-cta bg-[#FFF0D9]' : 'border-transparent bg-muted/50'}`}>
                <div className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-cta shrink-0" /><span className="font-semibold text-sm">{t('smmKindBusiness')}</span></div>
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, kind: 'government' }))} className={`p-2.5 rounded-xl border-2 text-left transition-all ${form.kind === 'government' ? 'border-primary bg-[#FFE8DE]' : 'border-transparent bg-muted/50'}`}>
                <div className="flex items-center gap-2"><Landmark className="w-4 h-4 text-primary shrink-0" /><span className="font-semibold text-sm">{t('smmKindGovernment')}</span></div>
              </button>
            </div>
          </div>
          {editing && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t('attachedFiles', { n: files.length })}</Label>
              {files.map(f => (
                <div key={f.id} className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2">
                  <Paperclip className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-sm min-w-0 flex-1 truncate">{f.title}</span>
                  <button type="button" onClick={() => removeFile(f.id)} className="text-destructive shrink-0" aria-label={t('delete')}><X className="w-4 h-4" /></button>
                </div>
              ))}
              <input ref={fileInputRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void addFile(f); }} />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={busy} className="rounded-full">
                <Upload className="w-3.5 h-3.5 mr-1" /> {t('smmUploadFile')}
              </Button>
            </div>
          )}
        </div>
      )}

      {tab === 'roles' && (
        <div className="space-y-3">
          {roles.map(r => (
            <Card key={r.id} className="rounded-3xl border border-black/10 bg-white">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm">{r.name}</p>
                    {r.brief && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">{r.brief}</p>}
                    <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-muted-foreground">
                      {r.payment && <span className="inline-flex items-center gap-1"><Banknote className="w-3 h-3" />{r.payment}</span>}
                      {r.deadline && <span className="inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" />{r.deadline}</span>}
                    </div>
                    {(r.assigned || []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.assigned.map((a: any) => (
                          <Badge key={a.userId} variant="secondary" className="rounded-full text-[11px]">{t('smmAssigned')}: {a.name}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => removeRole(r.id)} className="text-destructive shrink-0" aria-label={t('delete')}><Trash2 className="w-4 h-4" /></button>
                </div>
              </CardContent>
            </Card>
          ))}
          {/* Add-role form — the reusable ТЗ template */}
          <Card className="rounded-3xl border border-black/10 bg-white">
            <CardContent className="p-4 space-y-2.5">
              <p className="font-bold text-sm">{t('smmAddRole')}</p>
              <Input value={newRole.name} onChange={e => setNewRole(r => ({ ...r, name: e.target.value }))} maxLength={120} className="rounded-full border-black/20 bg-white" placeholder={t('smmRoleName')} />
              <Textarea value={newRole.brief} onChange={e => setNewRole(r => ({ ...r, brief: e.target.value }))} rows={3} maxLength={8000} className="rounded-2xl border-black/15 bg-white" placeholder={t('smmRoleBriefPlaceholder')} />
              <div className="grid grid-cols-2 gap-2">
                <Input value={newRole.payment} onChange={e => setNewRole(r => ({ ...r, payment: e.target.value }))} maxLength={120} className="rounded-full border-black/20 bg-white" placeholder={t('smmRolePayment')} />
                <Input value={newRole.deadline} onChange={e => setNewRole(r => ({ ...r, deadline: e.target.value }))} maxLength={120} className="rounded-full border-black/20 bg-white" placeholder={t('smmRoleDeadline')} />
              </div>
              <Button onClick={addRole} disabled={busy || !newRole.name.trim() || !editing} className="w-full rounded-full" size="sm">
                <Plus className="w-4 h-4 mr-1" /> {t('smmAddRole')}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'apps' && (
        <div className="space-y-3">
          {apps.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">{t('smmNoApplications')}</p>}
          {apps.map(a => (
            <Card key={a.id} className="rounded-3xl border border-black/10 bg-white">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-cta text-white flex items-center justify-center text-xs font-extrabold shrink-0">{(a.specialist?.name || '?').slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{a.specialist?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.role?.name}</p>
                  </div>
                  <Badge className={`rounded-full shrink-0 ${a.status === 'accepted' ? 'bg-emerald-500' : a.status === 'declined' ? 'bg-red-500' : 'bg-amber-500'}`}>{t(`smmStatus_${a.status}`)}</Badge>
                </div>
                {a.message && <p className="text-xs whitespace-pre-wrap rounded-xl bg-muted/50 p-2.5">{a.message}</p>}
                {a.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => respondApp(a.id, 'accept')} disabled={busy} className="flex-1 rounded-full bg-emerald-600 hover:bg-emerald-600/90">{t('smmAccept')}</Button>
                    <Button size="sm" variant="outline" onClick={() => respondApp(a.id, 'decline')} disabled={busy} className="flex-1 rounded-full">{t('smmDecline')}</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === 'invites' && (
        <div className="space-y-3">
          {invites.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">{t('smmNoInvitations')}</p>}
          {invites.map(i => (
            <Card key={i.id} className="rounded-3xl border border-black/10 bg-white">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 shrink-0 text-cta" />
                  <p className="font-bold text-sm truncate flex-1">{i.specialist?.name}</p>
                  <Badge className={`rounded-full shrink-0 ${i.status === 'accepted' ? 'bg-emerald-500' : i.status === 'declined' ? 'bg-red-500' : 'bg-amber-500'}`}>{t(`smmStatus_${i.status}`)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{t('smmRoleN')}: {i.role?.name}</p>
                {i.message && <p className="text-xs whitespace-pre-wrap rounded-xl bg-muted/50 p-2.5">{i.message}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col screen-enter">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-2xl lg:max-w-3xl mx-auto px-4 h-14 lg:h-16 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goHome} className="rounded-full shrink-0"><ArrowLeft className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">{t('back')}</span></Button>
          <h1 className="text-lg font-bold truncate flex-1">{t('smmEventsTitle')}</h1>
          <Button size="sm" onClick={() => openEditor(null)} className="rounded-full bg-cta hover:bg-cta/90 text-white shrink-0">
            <Plus className="w-4 h-4 mr-1" /> {t('smmCreateEvent')}
          </Button>
        </div>
      </header>

      <main className="max-w-2xl lg:max-w-3xl w-full mx-auto px-4 py-6 pb-32 space-y-3">
        {loading && <p className="text-sm text-muted-foreground text-center py-10">{t('loading')}</p>}
        {!loading && events.length === 0 && (
          <Card className="rounded-4xl border border-black bg-white">
            <CardContent className="p-8 text-center space-y-3">
              <div className="mx-auto w-14 h-14 bg-cta rounded-2xl flex items-center justify-center shadow-lg"><Briefcase className="w-7 h-7 text-white" /></div>
              <p className="font-bold">{t('smmNoEventsYet')}</p>
              <p className="text-sm text-muted-foreground">{t('smmNoEventsHint')}</p>
              <Button onClick={() => openEditor(null)} className="rounded-full bg-cta hover:bg-cta/90 text-white"><Plus className="w-4 h-4 mr-1" /> {t('smmCreateEvent')}</Button>
            </CardContent>
          </Card>
        )}
        {events.map(ev => (
          <button key={ev.id} type="button" onClick={() => openEditor(ev)} className="w-full text-left">
            <Card className="rounded-4xl border border-black bg-white overflow-hidden hover:shadow-lg transition-shadow">
              <div className="h-2" style={{ background: smmCoverColor(ev.id) }} />
              <CardContent className="p-5">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{ev.title}</p>
                    {ev.summary && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ev.summary}</p>}
                  </div>
                  <Pencil className="w-4 h-4 shrink-0 text-muted-foreground mt-1" />
                </div>
                <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
                  <Badge variant="secondary" className="rounded-full">{t('smmRolesN', { n: (ev.roles || []).length })}</Badge>
                  {pendingN(ev) > 0 && <Badge className="rounded-full bg-amber-500">{t('smmPendingApps', { n: pendingN(ev) })}</Badge>}
                  {ev.budget && <Badge variant="outline" className="rounded-full"><Banknote className="w-3 h-3 mr-1" />{ev.budget}</Badge>}
                  {ev.deadline && <Badge variant="outline" className="rounded-full"><CalendarClock className="w-3 h-3 mr-1" />{ev.deadline}</Badge>}
                  <Badge variant="outline" className="rounded-full">{ev.kind === 'government' ? <><Landmark className="w-3 h-3 mr-1" />{t('smmKindGovernment')}</> : <><Building2 className="w-3 h-3 mr-1" />{t('smmKindBusiness')}</>}</Badge>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </main>

      {/* THE EVENT EDITOR — the same resizable window the test editor uses */}
      {sheetOpen && (
        <ResizableSheetFrame
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          initialVh={0.85}
          minVh={0.4}
          maxW="max-w-3xl"
          header={
            <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-7 h-7 rounded-lg bg-cta flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-white" /></span>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{editing ? editing.title : t('smmCreateEvent')}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{t('smmEventsTitle')}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => setSheetOpen(false)}><X className="w-4 h-4" /></Button>
            </div>
          }
          body={
            <div className="px-4 py-4">
              {editorBody}
            </div>
          }
          footer={
            <div className="shrink-0 border-t bg-white/95 backdrop-blur-md px-4 pt-3 flex gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
              {editing && (
                <Button variant="outline" onClick={removeEvent} disabled={busy} className="rounded-full border-destructive/50 text-destructive hover:bg-destructive/10 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <Button onClick={saveEvent} disabled={busy || !form.title.trim()} className="flex-1 rounded-full bg-primary hover:bg-primary/90">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t('save')}
              </Button>
            </div>
          }
        />
      )}
    </div>
  );
}
