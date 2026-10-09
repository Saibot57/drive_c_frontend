'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { arbetslagService } from '@/services/arbetslagService';
import { plannerService } from '@/services/plannerService';
import type { LabPlanSummary } from '@/types/lessonLab';
import type { PlannerArchiveSummary } from '@/types/schedule';
import { isOwnPlan, missingArchiveAccess } from '@/utils/labPlans';

/**
 * Dela ett upplägg med kollegor, som "Dela" på ett schema i schemaplaneraren.
 *
 * Upplägget kan bygga på ett arkiv i schemaplaneraren (`archiveId`), och det
 * arkivet delas inte med automatiskt. Den som saknar det ser inga fasta
 * timmar, så rutan säger vilka det gäller och kan dela arkivet med dem också.
 */

type Props = {
  /** Upplägget som delas. `null` betyder att rutan är stängd. */
  plan: LabPlanSummary | null;
  /** Det öppna uppläggets arkiv, så att det inte behöver hämtas. */
  activePlanId: string | null;
  activeArchiveId: string | null;
  /** Ens egna och delade arkiv i schemaplaneraren. `null` medan de hämtas. */
  archives: PlannerArchiveSummary[] | null;
  onArchiveShared: (archive: PlannerArchiveSummary) => void;
  onShare: (planId: string, username: string) => Promise<unknown>;
  onUnshare: (planId: string, username: string) => Promise<void>;
  onClose: () => void;
};

const message = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export function LabShareDialog({
  plan, activePlanId, activeArchiveId, archives, onArchiveShared, onShare, onUnshare, onClose,
}: Props) {
  const [recipient, setRecipient] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Arkivet för ett upplägg som inte är öppet. `undefined` tills det hämtats.
  const [fetchedArchiveId, setFetchedArchiveId] = useState<string | null | undefined>(undefined);

  const planId = plan?.id ?? null;
  const isActive = planId !== null && planId === activePlanId;

  useEffect(() => {
    setRecipient('');
    setError(null);
    setNotice(null);
    setFetchedArchiveId(undefined);
    if (!planId || isActive) return;
    let cancelled = false;
    arbetslagService.getPlan(planId)
      .then(full => { if (!cancelled) setFetchedArchiveId(full.state.archiveId ?? null); })
      .catch(() => { if (!cancelled) setFetchedArchiveId(null); });
    return () => { cancelled = true; };
  }, [planId, isActive]);

  const archiveId = isActive ? activeArchiveId : fetchedArchiveId;
  const archive = archiveId ? archives?.find(a => a.id === archiveId) ?? null : null;
  // Ett arkiv som inte finns i ens lista går inte att dela härifrån.
  const archiveOutOfReach = Boolean(archiveId && archives && !archive);
  const missing = plan && archive ? missingArchiveAccess(plan, archive) ?? [] : [];

  const run = async (action: () => Promise<void>, fallback: string) => {
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setError(message(err, fallback));
    } finally {
      setWorking(false);
    }
  };

  const share = () => run(async () => {
    const name = recipient.trim();
    if (!plan || !name) return;
    await onShare(plan.id, name);
    setRecipient('');
    setNotice(`${name} kan nu arbeta i "${plan.name}".`);
  }, 'Kunde inte dela upplägget.');

  const unshare = (name: string) => run(async () => {
    if (!plan) return;
    await onUnshare(plan.id, name);
    setNotice(`${name} har inte längre tillgång.`);
  }, 'Kunde inte ta bort delningen.');

  /** Delar arkivet med dem som saknar det, en i taget. Det som lyckats behålls. */
  const shareArchive = () => run(async () => {
    if (!archive) return;
    for (const name of missing) {
      onArchiveShared(await plannerService.addArchiveShare(archive.id, name));
    }
    setNotice(`Schemat "${archive.name}" är delat.`);
  }, 'Kunde inte dela schemat.');

  const own = plan ? isOwnPlan(plan) : false;
  const sharedWith = plan?.sharedWith ?? [];

  return (
    <Dialog open={Boolean(plan)} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dela &quot;{plan?.name}&quot;</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <form onSubmit={event => { event.preventDefault(); void share(); }} className="space-y-3">
            <div>
              <Label htmlFor="lab-share-recipient">Användarnamn</Label>
              <Input
                id="lab-share-recipient"
                value={recipient}
                onChange={event => setRecipient(event.target.value)}
                placeholder="t.ex. hanna"
                autoFocus
                autoComplete="off"
              />
            </div>
            <p className="text-xs text-gray-600 kron:text-ui-muted">
              Ni arbetar i <strong>samma</strong> upplägg och ser varandras ändringar nästa gång ni öppnar det.
              Sparar två samtidigt får den som kommer sist välja mellan att ladda om och att spara sina ändringar som en kopia.
            </p>
            <Button type="submit" className="w-full" disabled={working || !recipient.trim()}>
              {working ? 'Delar…' : 'Ge tillgång'}
            </Button>
          </form>

          {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-800 kron:text-ui-danger" role="alert">{error}</p>}
          {notice && <p className="rounded bg-emerald-50 px-3 py-2 text-sm" role="status">{notice}</p>}

          {missing.length > 0 && archive && (
            <div className="space-y-2 rounded bg-amber-50 px-3 py-2 text-sm" role="status">
              <p>
                Upplägget bygger på schemat <strong>{archive.name}</strong> i schemaplaneraren.{' '}
                {missing.join(', ')} når inte det och ser därför inte lärarnas fasta timmar.
              </p>
              <Button type="button" variant="neutral" className="sp-btn h-8" disabled={working} onClick={() => void shareArchive()}>
                Dela schemat med {missing.length === 1 ? missing[0] : 'dem'} också
              </Button>
            </div>
          )}
          {archiveOutOfReach && (
            <p className="rounded bg-amber-50 px-3 py-2 text-sm" role="status">
              Upplägget bygger på ett schema i schemaplaneraren som du själv inte når. De som saknar det ser inte
              lärarnas fasta timmar förrän schemats ägare delar det med dem.
            </p>
          )}

          {plan && (
            <div className="space-y-2 border-t-frame border-ui-line pt-3">
              <Label className="text-xs font-bold uppercase text-ui-muted">Har tillgång</Label>
              <p className="text-sm">
                {plan.ownerUsername ?? 'Du'}
                <span className="text-ui-muted"> — äger upplägget</span>
              </p>
              {sharedWith.length === 0 ? (
                <p className="text-sm italic text-ui-muted">Ingen annan ännu.</p>
              ) : (
                sharedWith.map(name => (
                  <div key={name} className="flex items-center justify-between gap-2">
                    <span className="text-sm">{name}</span>
                    {own && (
                      <Button
                        size="sm"
                        variant="neutral"
                        className="h-7 bg-rose-100 text-rose-800 kron:text-ui-danger hover:bg-rose-200 kron:bg-ui-paper kron:hover:bg-ui-surface-3"
                        disabled={working}
                        onClick={() => void unshare(name)}
                      >
                        Ta bort
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="neutral" onClick={onClose}>Stäng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
