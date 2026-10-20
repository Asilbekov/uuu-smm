'use client';

import React from 'react';
import { ArrowLeft, Briefcase, Camera, CheckCircle2, FileText, Landmark, Loader2, LogOut, Megaphone, Paperclip, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TEST_BG_PRESETS } from '@/lib/test-bg';
import { useProfileStore } from '@/stores/profile-store';
import { useSessionStore } from '@/stores/session-store';
import { useNavStore } from '@/stores/nav-store';
import { api } from '@/lib/api';
import { uploadSmmFile, sniffType } from '@/lib/smm-client';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { tUI } from '@/lib/i18n';

/**
 * PROFILE PAGE — opened by tapping the account avatar. Hosts everything
 * account-related that used to be scattered over the header: the profile
 * photo, the display name, the test-taking background (affects how the
 * background looks while taking a test), logout and account deletion.
 * The back arrow in the top-left of the top panel returns to the dashboard.
 *
 * The state lives in the zustand domain stores and is consumed here
 * directly — app-root keeps the action handlers (they orchestrate the
 * API calls): avatar upload, name save, background save, logout, deletion.
 */
export interface ProfileViewProps {
  avatarInputRef: React.RefObject<HTMLInputElement | null>;
  handleAvatarFile: (file: File) => void;
  saveProfileName: () => void;
  saveBgStyle: (id: string) => void;
  handleLogout: () => void;
  handleDeleteAccount: () => void;
}

export default function ProfileView({
  avatarInputRef,
  handleAvatarFile,
  saveProfileName,
  saveBgStyle,
  handleLogout,
  handleDeleteAccount,
}: ProfileViewProps) {
  // ── State: read straight from the zustand domain stores ──────────────────
  const sessionUser = useSessionStore(s => s.user);
  const hydratedUser = useSessionStore(s => s.hydratedUser);
  const lang = useSessionStore(s => s.lang);
  const setPage = useNavStore(s => s.setPage);
  const myAvatar = useProfileStore(s => s.myAvatar);
  const myBgStyle = useProfileStore(s => s.myBgStyle);
  const avatarBusy = useProfileStore(s => s.avatarBusy);
  const profileName = useProfileStore(s => s.profileName);
  const setProfileName = useProfileStore(s => s.setProfileName);
  const profileSaving = useProfileStore(s => s.profileSaving);
  const accBusy = useProfileStore(s => s.accBusy);
  const deleteAccOpen = useProfileStore(s => s.deleteAccOpen);
  const setDeleteAccOpen = useProfileStore(s => s.setDeleteAccOpen);
  const effectiveUser = sessionUser || hydratedUser;
  const t = React.useCallback((key: string, vars?: Record<string, string | number>) => tUI(lang, key, vars), [lang]);
  const { toast } = useToast();

  // ─── SMM: the account kind + the specialist's анкета ────────────────────
  const [smmRole, setSmmRole] = React.useState<string>('customer');
  const [anketa, setAnketa] = React.useState({ smmHeadline: '', smmResume: '', smmVideoUrl: '', smmCity: '', smmRate: '', smmReady: true });
  const [smmFiles, setSmmFiles] = React.useState<any[]>([]);
  const [smmBusy, setSmmBusy] = React.useState(false);
  const smmFileRef = React.useRef<HTMLInputElement>(null);
  const videoFileRef = React.useRef<HTMLInputElement>(null);
  const smmLoadedRef = React.useRef(false);
  React.useEffect(() => {
    if (smmLoadedRef.current || !effectiveUser?.id) return;
    smmLoadedRef.current = true;
    api.getSmmProfile().then((p: any) => {
      setSmmRole(p.smmRole || 'customer');
      setAnketa({
        smmHeadline: p.smmHeadline || '', smmResume: p.smmResume || '',
        smmVideoUrl: p.smmVideoUrl || '', smmCity: p.smmCity || '',
        smmRate: p.smmRate || '', smmReady: p.smmReady !== false,
      });
    }).catch(() => {});
    api.getSmmFiles('user', effectiveUser.id).then(setSmmFiles).catch(() => {});
  }, [effectiveUser?.id]);

  const patchSessionRole = (role: string) => {
    const st = useSessionStore.getState();
    if (st.user) st.setUser({ ...st.user, smmRole: role as any });
    if (st.hydratedUser) st.setHydratedUser({ ...st.hydratedUser, smmRole: role as any });
  };

  const changeSmmRole = async (role: 'customer' | 'specialist') => {
    setSmmRole(role);
    patchSessionRole(role);
    try { await api.updateSmmProfile({ smmRole: role }); toast({ title: t('smmProfileSaved') }); } catch (e: any) {
      toast({ title: t('error'), description: e?.message, variant: 'destructive' });
    }
  };

  const saveAnketa = async () => {
    setSmmBusy(true);
    try {
      await api.updateSmmProfile(anketa);
      toast({ title: t('smmProfileSaved') });
    } catch (e: any) {
      toast({ title: t('error'), description: e?.message, variant: 'destructive' });
    }
    setSmmBusy(false);
  };

  const addSmmFile = async (f: File) => {
    if (!effectiveUser?.id) return;
    setSmmBusy(true);
    try {
      const up = await uploadSmmFile(f);
      await api.addSmmFile({ ownerType: 'user', ownerId: effectiveUser.id, title: f.name, type: sniffType(f), url: up.url, size: up.size ?? null, tgMessageId: up.tgMessageId ?? null });
      setSmmFiles(await api.getSmmFiles('user', effectiveUser.id));
      toast({ title: t('smmFileAdded') });
    } catch (e: any) {
      toast({ title: t('error'), description: e?.message, variant: 'destructive' });
    }
    setSmmBusy(false);
  };

  const removeSmmFile = async (id: string) => {
    setSmmBusy(true);
    try { await api.deleteSmmFile(id); setSmmFiles(prev => prev.filter(f => f.id !== id)); } catch (e: any) {
      toast({ title: t('error'), description: e?.message, variant: 'destructive' });
    }
    setSmmBusy(false);
  };

  const uploadVideo = async (f: File) => {
    setSmmBusy(true);
    try {
      const up = await uploadSmmFile(f);
      const next = { ...anketa, smmVideoUrl: up.url };
      setAnketa(next);
      await api.updateSmmProfile({ smmVideoUrl: up.url });
      toast({ title: t('smmVideoSaved') });
    } catch (e: any) {
      toast({ title: t('error'), description: e?.message, variant: 'destructive' });
    }
    setSmmBusy(false);
  };
  // Round avatar initials (same rule as app-root / dashboard-view)
  const userInitials = (() => {
    const userName = effectiveUser?.name || effectiveUser?.email || '';
    const parts = userName.trim().split(/\s+/).filter(Boolean);
    const s = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : userName.slice(0, 2);
    return (s || '?').toUpperCase();
  })();

  return (
    <div className="min-h-screen bg-background flex flex-col screen-enter">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        {/* FIXED h-14 — the uniform 56px top-panel contract (every page, every viewport). */}
        <div className="max-w-2xl lg:max-w-3xl mx-auto px-4 h-14 lg:h-16 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage('dashboard')}
            className="rounded-full h-8 w-8 p-0 sm:w-auto sm:px-3 shrink-0"
            title={t('back')}
            aria-label={t('back')}
          >
            <ArrowLeft className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">{t('back')}</span>
          </Button>
          <h1 className="text-lg font-bold truncate">{t('profileTitle')}</h1>
        </div>
      </header>

      <main className="max-w-2xl lg:max-w-3xl w-full mx-auto px-4 py-6 sm:py-8 pb-32 space-y-5">
        {/* Photo + identity */}
        <Card className="rounded-4xl border border-black bg-white">
          <CardContent className="p-6 flex flex-col items-center text-center">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarBusy || !effectiveUser}
              className="relative group rounded-full active:scale-95 transition-transform disabled:opacity-60"
              title={t('avatarUpload')}
              aria-label={t('avatarUpload')}
            >
              {myAvatar ? (
                <img src={myAvatar} alt="" className="w-24 h-24 rounded-full object-cover ring-2 ring-black/10" />
              ) : (
                <span className="w-24 h-24 rounded-full bg-cta text-white flex items-center justify-center text-2xl font-extrabold ring-2 ring-black/10">
                  {userInitials}
                </span>
              )}
              <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white border border-black/15 shadow-sm flex items-center justify-center">
                {avatarBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleAvatarFile(f); }}
            />
            <p className="mt-3 text-base font-semibold">{effectiveUser?.name}</p>
            <p className="text-sm text-muted-foreground">{effectiveUser?.email}</p>
            <p className="mt-2 text-xs text-muted-foreground">{t('avatarUpload')}</p>
          </CardContent>
        </Card>

        {/* Name */}
        <Card className="rounded-4xl border border-black bg-white">
          <CardContent className="p-5 sm:p-6 space-y-3">
            <Label htmlFor="profile-name" className="text-sm font-semibold">{t('profileNameLabel')}</Label>
            <div className="flex gap-2">
              <Input
                id="profile-name"
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveProfileName(); }}
                maxLength={60}
                className="flex-1 rounded-full border-black/20 bg-white"
                placeholder={t('profileNameLabel')}
              />
              <Button
                onClick={saveProfileName}
                disabled={profileSaving || !profileName.trim() || profileName.trim() === effectiveUser?.name}
                className="rounded-full shrink-0 h-9 px-4"
              >
                {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('save')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* SMM account kind — «Заказчик» | «SMM-специалист»: the same fixed
        2-slot grid the start screen's mode buttons use */}
        <Card className="rounded-4xl border border-black bg-white">
          <CardContent className="p-5 sm:p-6 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">{t('smmWhoAreYou')}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t('smmRoleHint')}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => changeSmmRole('customer')}
                className={`p-2.5 sm:p-3 rounded-xl border-2 transition-all text-left ${smmRole === 'customer' ? 'border-cta bg-[#FFF0D9] shadow-md' : 'border-transparent bg-muted/50 hover:bg-muted'}`}
              >
                <div className="min-w-0 flex items-center gap-2">
                  {smmRole === 'customer' ? <Briefcase className="w-4 h-4 text-cta shrink-0" /> : <Landmark className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <span className="font-semibold text-sm min-w-0">{t('smmRoleCustomer')}</span>
                  {smmRole === 'customer' && <CheckCircle2 className="w-4 h-4 text-cta ml-auto shrink-0" />}
                </div>
              </button>
              <button
                type="button"
                onClick={() => changeSmmRole('specialist')}
                className={`p-2.5 sm:p-3 rounded-xl border-2 transition-all text-left ${smmRole === 'specialist' ? 'border-primary bg-[#FFE8DE] shadow-md' : 'border-transparent bg-muted/50 hover:bg-muted'}`}
              >
                <div className="min-w-0 flex items-center gap-2">
                  <Megaphone className={`w-4 h-4 shrink-0 ${smmRole === 'specialist' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="font-semibold text-sm min-w-0">{t('smmRoleSpecialist')}</span>
                  {smmRole === 'specialist' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto shrink-0" />}
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* The specialist's анкета — headline, resume, video, city/rate and
        the portfolio files; the customer's card feed is built from it */}
        {smmRole === 'specialist' && (
          <Card className="rounded-4xl border border-black bg-white">
            <CardContent className="p-5 sm:p-6 space-y-3">
              <h3 className="text-sm font-semibold">{t('smmAnketaTitle')}</h3>
              <div className="space-y-1.5">
                <Label htmlFor="smm-headline" className="text-xs text-muted-foreground">{t('smmHeadline')}</Label>
                <Input id="smm-headline" value={anketa.smmHeadline} onChange={e => setAnketa(a => ({ ...a, smmHeadline: e.target.value }))} maxLength={120} className="rounded-full border-black/20 bg-white" placeholder={t('smmHeadlineHint')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smm-resume" className="text-xs text-muted-foreground">{t('smmResume')}</Label>
                <Textarea id="smm-resume" value={anketa.smmResume} onChange={e => setAnketa(a => ({ ...a, smmResume: e.target.value }))} rows={5} maxLength={8000} className="rounded-2xl border-black/15 bg-white" placeholder={t('smmResumeHint')} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="smm-city" className="text-xs text-muted-foreground">{t('smmCity')}</Label>
                  <Input id="smm-city" value={anketa.smmCity} onChange={e => setAnketa(a => ({ ...a, smmCity: e.target.value }))} maxLength={60} className="rounded-full border-black/20 bg-white" placeholder="Ташкент" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smm-rate" className="text-xs text-muted-foreground">{t('smmRate')}</Label>
                  <Input id="smm-rate" value={anketa.smmRate} onChange={e => setAnketa(a => ({ ...a, smmRate: e.target.value }))} maxLength={120} className="rounded-full border-black/20 bg-white" placeholder={t('smmRateHint')} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('smmVideo')}</Label>
                <div className="flex gap-2">
                  <Input value={anketa.smmVideoUrl.startsWith('data:') || anketa.smmVideoUrl.startsWith('tg:') ? (anketa.smmVideoUrl.startsWith('tg:') ? t('smmVideoUploaded') : t('smmVideoUploaded')) : anketa.smmVideoUrl}
                    onChange={e => setAnketa(a => ({ ...a, smmVideoUrl: e.target.value }))}
                    className="flex-1 min-w-0 rounded-full border-black/20 bg-white text-xs" placeholder="https://…" />
                  <input ref={videoFileRef} type="file" accept="video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadVideo(f); }} />
                  <Button variant="outline" size="sm" onClick={() => videoFileRef.current?.click()} disabled={smmBusy} className="rounded-full shrink-0">
                    <Upload className="w-3.5 h-3.5 mr-1" /> {t('smmUploadFile')}
                  </Button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAnketa(a => ({ ...a, smmReady: !a.smmReady }))}
                className={`w-full p-2.5 rounded-xl border-2 text-left transition-all flex items-center gap-2 ${anketa.smmReady ? 'border-emerald-500 bg-emerald-50' : 'border-transparent bg-muted/50'}`}
              >
                {anketa.smmReady ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <X className="w-4 h-4 text-muted-foreground shrink-0" />}
                <span className="font-semibold text-sm">{t('smmReadyToggle')}</span>
              </button>
              <Button onClick={saveAnketa} disabled={smmBusy} className="w-full rounded-full">
                {smmBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : t('save')}
              </Button>

              {/* Portfolio files */}
              <div className="space-y-2 pt-1">
                <Label className="text-xs text-muted-foreground">{t('attachedFiles', { n: smmFiles.length })}</Label>
                {smmFiles.map(f => (
                  <div key={f.id} className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2">
                    <Paperclip className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-sm min-w-0 flex-1 truncate">{f.title}</span>
                    <button type="button" onClick={() => removeSmmFile(f.id)} className="text-destructive shrink-0" aria-label={t('delete')}><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <input ref={smmFileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void addSmmFile(f); }} />
                <Button variant="outline" size="sm" onClick={() => smmFileRef.current?.click()} disabled={smmBusy} className="rounded-full">
                  <Upload className="w-3.5 h-3.5 mr-1" /> {t('smmUploadFile')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test-taking background */}
        <Card className="rounded-4xl border border-black bg-white">
          <CardContent className="p-5 sm:p-6 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">{t('profileBgTitle')}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t('profileBgDesc')}</p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
              {/* Standard option — resets to the plain app background */}
              <button
                type="button"
                onClick={() => saveBgStyle('')}
                className={`relative h-16 rounded-2xl border-2 flex items-center justify-center text-[11px] font-medium transition-all active:scale-95 ${myBgStyle === '' ? 'border-cta ring-2 ring-cta/30' : 'border-black/15 hover:border-black/40'}`}
                style={{ background: 'repeating-linear-gradient(45deg,#fafafa,#fafafa 8px,#f0f0f0 8px,#f0f0f0 16px)' }}
                title={t('profileBgStandard')}
              >
                <span className="bg-white/85 rounded-full px-2 py-0.5">{t('profileBgStandard')}</span>
              </button>
              {TEST_BG_PRESETS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => saveBgStyle(p.id)}
                  className={`relative h-16 rounded-2xl border-2 transition-all active:scale-95 ${myBgStyle === p.id ? 'border-cta ring-2 ring-cta/30' : 'border-black/15 hover:border-black/40'}`}
                  style={{ background: p.css }}
                  title={p.id}
                  aria-label={p.id}
                >
                  {myBgStyle === p.id && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-cta drop-shadow" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Account actions */}
        <Card className="rounded-4xl border border-black bg-white">
          <CardContent className="p-5 sm:p-6 space-y-3">
            <Button
              variant="outline"
              onClick={handleLogout}
              disabled={accBusy}
              className="w-full rounded-2xl border-black h-11 justify-start gap-2"
            >
              <LogOut className="w-4 h-4" /> {t('logoutBtn')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeleteAccOpen(true)}
              disabled={accBusy}
              className="w-full rounded-2xl border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive h-11 justify-start gap-2"
            >
              <Trash2 className="w-4 h-4" /> {t('deleteAccountBtn')}
            </Button>
          </CardContent>
        </Card>
      </main>

      {/* Account deletion confirmation */}
      <AlertDialog open={deleteAccOpen} onOpenChange={setDeleteAccOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteAccountQ')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteAccountWarning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {accBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : t('deleteAccountBtn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
