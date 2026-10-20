'use client';

import React from 'react';
import {
  ArrowLeft, Banknote, Bell, CalendarClock, CheckCircle2, FileText, Inbox,
  Loader2, Megaphone, Send, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useSessionStore } from '@/stores/session-store';
import { tUI } from '@/lib/i18n';
import type { SmmApplicationItem, SmmInvitationItem } from '@/lib/app-types';

// ---------------------------------------------------------------------------
// SMM INBOX — the specialist's invitations page: received invitations
// (accept → the event gets me for that role) and the statuses of my own
// applications. The specialist-side counterpart of the events manager.
// ---------------------------------------------------------------------------

export interface SmmInboxViewProps {
  goHome: () => void;
}

export default function SmmInboxView({ goHome }: SmmInboxViewProps) {
  const lang = useSessionStore(s => s.lang);
  const t = React.useCallback((key: string, vars?: Record<string, string | number>) => tUI(lang, key, vars), [lang]);
  const [seg, setSeg] = React.useState<'invites' | 'apps'>('invites');
  const [invites, setInvites] = React.useState<SmmInvitationItem[]>([]);
  const [apps, setApps] = React.useState<SmmApplicationItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [inv, ap] = await Promise.all([api.getSmmInvitations('inbox'), api.getSmmApplications('sent')]);
      setInvites(inv);
      setApps(ap);
    } catch { /* transient */ }
    setLoading(false);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const respondInv = async (id: string, action: 'accept' | 'decline') => {
    setBusy(true);
    try {
      await api.respondSmmInvitation(id, action);
      setInvites(prev => prev.map(i => (i.id === id ? { ...i, status: action === 'accept' ? 'accepted' : 'declined' } : i)));
    } catch { /* transient */ }
    setBusy(false);
  };

  const pendingN = invites.filter(i => i.status === 'pending').length;

  return (
    <div className="min-h-screen bg-background flex flex-col screen-enter">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-2xl lg:max-w-3xl mx-auto px-4 h-14 lg:h-16 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goHome} className="rounded-full shrink-0"><ArrowLeft className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">{t('back')}</span></Button>
          <h1 className="text-lg font-bold truncate flex-1">{t('smmInboxTitle')}</h1>
          {pendingN > 0 && <Badge className="rounded-full bg-amber-500 shrink-0">{pendingN}</Badge>}
        </div>
      </header>

      <main className="max-w-2xl lg:max-w-3xl w-full mx-auto px-4 py-5 pb-32 space-y-4">
        {/* Segment switch — the dock-button style */}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setSeg('invites')} className={`flex items-center justify-center gap-1.5 h-9 rounded-full border-2 text-xs sm:text-sm font-semibold transition-colors ${seg === 'invites' ? 'bg-cta text-white border-cta shadow-md' : 'border-black bg-white hover:bg-muted/50'}`}>
            <Bell className="w-4 h-4 shrink-0" /> {t('smmSegInvites')}
          </button>
          <button type="button" onClick={() => setSeg('apps')} className={`flex items-center justify-center gap-1.5 h-9 rounded-full border-2 text-xs sm:text-sm font-semibold transition-colors ${seg === 'apps' ? 'bg-cta text-white border-cta shadow-md' : 'border-black bg-white hover:bg-muted/50'}`}>
            <Send className="w-4 h-4 shrink-0" /> {t('smmSegMyApps')}
          </button>
        </div>

        {loading && <p className="text-sm text-muted-foreground text-center py-10">{t('loading')}</p>}

        {!loading && seg === 'invites' && (
          <div className="space-y-3">
            {invites.length === 0 && (
              <Card className="rounded-4xl border border-black bg-white">
                <CardContent className="p-8 text-center space-y-3">
                  <div className="mx-auto w-14 h-14 bg-muted rounded-2xl flex items-center justify-center"><Inbox className="w-7 h-7 text-muted-foreground" /></div>
                  <p className="font-bold">{t('smmNoInvitations')}</p>
                  <p className="text-sm text-muted-foreground">{t('smmInboxEmptyHint')}</p>
                </CardContent>
              </Card>
            )}
            {invites.map(i => (
              <Card key={i.id} className="rounded-4xl border border-black bg-white overflow-hidden">
                <CardContent className="p-5 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <span className="w-9 h-9 rounded-xl bg-cta flex items-center justify-center shrink-0"><Megaphone className="w-4 h-4 text-white" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm">{i.event?.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{t('smmRoleN')}: {i.role?.name} · {i.customer?.name}</p>
                    </div>
                    <Badge className={`rounded-full shrink-0 ${i.status === 'accepted' ? 'bg-emerald-500' : i.status === 'declined' ? 'bg-red-500' : 'bg-amber-500'}`}>{t(`smmStatus_${i.status}`)}</Badge>
                  </div>
                  {i.role?.brief && (
                    <div className="rounded-xl bg-muted/50 p-2.5">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">{t('smmRoleBriefTemplate')}</p>
                      <p className="text-xs whitespace-pre-wrap line-clamp-4">{i.message || i.role.brief}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {i.role?.payment && <span className="inline-flex items-center gap-1"><Banknote className="w-3 h-3" />{i.role.payment}</span>}
                    {i.role?.deadline && <span className="inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" />{i.role.deadline}</span>}
                  </div>
                  {i.status === 'pending' && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => respondInv(i.id, 'accept')} disabled={busy} className="flex-1 rounded-full bg-emerald-600 hover:bg-emerald-600/90">
                        <CheckCircle2 className="w-4 h-4 mr-1" /> {t('smmAccept')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => respondInv(i.id, 'decline')} disabled={busy} className="flex-1 rounded-full">
                        <X className="w-4 h-4 mr-1" /> {t('smmDecline')}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && seg === 'apps' && (
          <div className="space-y-3">
            {apps.length === 0 && (
              <Card className="rounded-4xl border border-black bg-white">
                <CardContent className="p-8 text-center space-y-3">
                  <div className="mx-auto w-14 h-14 bg-muted rounded-2xl flex items-center justify-center"><Send className="w-7 h-7 text-muted-foreground" /></div>
                  <p className="font-bold">{t('smmNoMyApps')}</p>
                  <p className="text-sm text-muted-foreground">{t('smmMyAppsEmptyHint')}</p>
                </CardContent>
              </Card>
            )}
            {apps.map(a => (
              <Card key={a.id} className="rounded-4xl border border-black/10 bg-white overflow-hidden">
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-primary" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm">{a.event?.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{t('smmRoleN')}: {a.role?.name}</p>
                    </div>
                    <Badge className={`rounded-full shrink-0 ${a.status === 'accepted' ? 'bg-emerald-500' : a.status === 'declined' ? 'bg-red-500' : 'bg-amber-500'}`}>{t(`smmStatus_${a.status}`)}</Badge>
                  </div>
                  {a.message && <p className="text-xs whitespace-pre-wrap rounded-xl bg-muted/50 p-2.5 line-clamp-3">{a.message}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {busy && <Loader2 className="w-4 h-4 animate-spin mx-auto" />}
      </main>
    </div>
  );
}
