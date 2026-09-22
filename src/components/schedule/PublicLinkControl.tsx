'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { plannerService, PublicLinkChanges } from '@/services/plannerService';
import {
  ColorTriggerRule,
  PlannerArchiveSummary,
  PlannerPublicLink,
  RoomTriggerRule,
} from '@/types/schedule';
import { PlannerNoticeTone } from '@/types/plannerUI';
import { parseExcludeList } from '@/utils/exportExclusions';

type Props = {
  archives: PlannerArchiveSummary[];
  activeArchiveId: string | null;
  activeArchiveName: string | null;
  colorTriggers: ColorTriggerRule[];
  roomTriggers: RoomTriggerRule[];
  /** Från useHiddenSettings. Före det är reglerna tomma för att inget lästs. */
  settingsLoaded: boolean;
  showNotice: (message: string, tone: PlannerNoticeTone) => void;
};

const publicUrlFor = (token: string) =>
  typeof window === 'undefined' ? `/s/${token}` : `${window.location.origin}/s/${token}`;

const rulesSignature = (colorTriggers: ColorTriggerRule[], roomTriggers: RoomTriggerRule[]) =>
  JSON.stringify([colorTriggers, roomTriggers]);

/**
 * Knappen och dialogen för den publika länken: en fast adress deltagarna har
 * som bokmärke, och som läraren pekar om mot veckans schema.
 *
 * Färg- och salsreglerna bor i den här webbläsarens localStorage, så en kopia
 * följer med länken. Den skickas när länken skapas eller pekas om, och när
 * reglerna ändras under sessionen — men *inte* bara för att planeraren
 * laddats. Annars skulle en dator utan reglerna tyst skriva över länkens färger
 * med tomma listor så fort den öppnade planeraren.
 */
export default function PublicLinkControl({
  archives,
  activeArchiveId,
  activeArchiveName,
  colorTriggers,
  roomTriggers,
  settingsLoaded,
  showNotice,
}: Props) {
  const [links, setLinks] = useState<PlannerPublicLink[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [hiddenDraft, setHiddenDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);

  // Gränssnittet visar en länk. Backenden bär flera, så en per klass kan läggas
  // till senare utan att datamodellen ändras.
  const link = links?.[0] ?? null;

  useEffect(() => {
    let cancelled = false;
    plannerService.listPublicLinks()
      .then(result => { if (!cancelled) setLinks(result); })
      .catch(() => { if (!cancelled) setLinks([]); });
    return () => { cancelled = true; };
  }, []);

  const resetDrafts = useCallback((next: PlannerPublicLink | null) => {
    setLabelDraft(next?.label ?? '');
    setHiddenDraft(next?.displayConfig.hiddenTitles.join('; ') ?? '');
  }, []);

  const replaceLink = useCallback((next: PlannerPublicLink) => {
    setLinks(current => {
      const rest = (current ?? []).filter(item => item.id !== next.id);
      return [next, ...rest];
    });
  }, []);

  const displayConfigWith = useCallback(
    (hiddenTitles: string[]) => ({ hiddenTitles, colorTriggers, roomTriggers }),
    [colorTriggers, roomTriggers]
  );

  const run = useCallback(async (action: () => Promise<void>) => {
    setIsBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel.');
    } finally {
      setIsBusy(false);
    }
  }, []);

  const update = useCallback(
    (changes: PublicLinkChanges) => run(async () => {
      if (!link) return;
      replaceLink(await plannerService.updatePublicLink(link.id, changes));
    }),
    [link, replaceLink, run]
  );

  // --- Regelspegling ---

  const signature = rulesSignature(colorTriggers, roomTriggers);
  const baselineRef = useRef<string | null>(null);

  useEffect(() => {
    if (!settingsLoaded) return;
    if (baselineRef.current === null) {
      baselineRef.current = signature;
      return;
    }
    if (signature === baselineRef.current || !links || links.length === 0) return;

    const timer = window.setTimeout(() => {
      baselineRef.current = signature;
      void Promise.all(links.map(item =>
        plannerService.updatePublicLink(item.id, {
          displayConfig: {
            hiddenTitles: item.displayConfig.hiddenTitles,
            colorTriggers,
            roomTriggers,
          },
        })
      ))
        .then(updated => setLinks(updated))
        .catch(() => showNotice('Kunde inte föra över färg- och salsreglerna till den publika länken.', 'warning'));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [signature, settingsLoaded, links, colorTriggers, roomTriggers, showNotice]);

  // --- Handlingar ---

  const handleOpen = () => {
    resetDrafts(link);
    setError(null);
    setConfirmRotate(false);
    setIsOpen(true);
  };

  const handleCreate = () => run(async () => {
    const created = await plannerService.createPublicLink({
      archiveId: activeArchiveId,
      displayConfig: displayConfigWith([]),
    });
    replaceLink(created);
    resetDrafts(created);
  });

  const handlePoint = (archiveId: string | null) => update({
    archiveId,
    // Veckobytet är det man gör varje vecka, så reglerna följer med här — då
    // hinner de aldrig bli mer än en vecka inaktuella.
    displayConfig: displayConfigWith(link?.displayConfig.hiddenTitles ?? []),
  });

  const handleSaveDetails = () => update({
    label: labelDraft.trim() || null,
    displayConfig: displayConfigWith(parseExcludeList(hiddenDraft)),
  });

  const handleRotate = () => run(async () => {
    if (!link) return;
    replaceLink(await plannerService.rotatePublicLink(link.id));
    setConfirmRotate(false);
    showNotice('Länken är utbytt. Den gamla fungerar inte längre.', 'success');
  });

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(publicUrlFor(link.token));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Kunde inte kopiera. Markera adressen och kopiera den själv.');
    }
  };

  const isPublishingActive = Boolean(
    link?.enabled && activeArchiveId && link.archiveId === activeArchiveId
  );
  const detailsDirty = useMemo(() => {
    if (!link) return false;
    const savedHidden = link.displayConfig.hiddenTitles.join('\n');
    return (labelDraft.trim() || null) !== (link.label || null)
      || parseExcludeList(hiddenDraft).join('\n') !== savedHidden;
  }, [link, labelDraft, hiddenDraft]);

  return (
    <>
      <Button
        variant="neutral"
        onClick={handleOpen}
        className={`sp-btn ${isPublishingActive ? 'bg-emerald-200 hover:bg-emerald-300' : ''}`}
        title={isPublishingActive
          ? 'Det här schemat visas på den publika länken just nu.'
          : 'Dela schemat med deltagarna via en länk som alltid visar senaste versionen.'}
      >
        <Globe size={16} className="mr-2" />
        {isPublishingActive ? 'Publikt' : 'Publik länk'}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Publik länk</DialogTitle>
          </DialogHeader>

          {links === null ? (
            <p className="text-sm text-gray-500">Hämtar…</p>
          ) : !link ? (
            <div className="space-y-3 text-sm text-gray-700">
              <p>
                En fast länk som deltagarna kan spara som bokmärke. Den visar alltid den senast
                sparade versionen av det schema du väljer, utan inloggning.
              </p>
              <p>
                Den som har länken ser schemat — samma sak som den som har PDF:en. Du kan byta ut
                eller stänga av länken när som helst.
              </p>
              <Button onClick={handleCreate} disabled={isBusy}>
                Skapa länk{activeArchiveName ? ` till ${activeArchiveName}` : ''}
              </Button>
            </div>
          ) : (
            <div className="space-y-5 text-sm">
              <section className="space-y-2">
                <Label>Adress</Label>
                <div className="flex gap-2">
                  <Input readOnly value={publicUrlFor(link.token)} onFocus={e => e.target.select()} />
                  <Button variant="neutral" onClick={handleCopy} title="Kopiera">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </Button>
                  <Button variant="neutral" asChild title="Öppna i ny flik">
                    <a href={`/s/${link.token}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={16} />
                    </a>
                  </Button>
                </div>
                {!link.enabled && (
                  <p className="font-bold text-rose-700">Avstängd — deltagarna ser &quot;Länken fungerar inte längre&quot;.</p>
                )}
              </section>

              <section className="space-y-2">
                <Label htmlFor="public-link-archive">Visar</Label>
                <select
                  id="public-link-archive"
                  className="w-full rounded border-2 border-black bg-white px-2 py-1.5"
                  value={link.archiveId ?? ''}
                  disabled={isBusy}
                  onChange={e => handlePoint(e.target.value || null)}
                >
                  <option value="">Inget schema just nu</option>
                  {archives.map(archive => (
                    <option key={archive.id} value={archive.id}>{archive.name}</option>
                  ))}
                </select>
                {activeArchiveId && link.archiveId !== activeArchiveId && (
                  <Button variant="neutral" size="sm" disabled={isBusy} onClick={() => handlePoint(activeArchiveId)}>
                    Visa {activeArchiveName ?? 'det aktiva schemat'} i stället
                  </Button>
                )}
              </section>

              <section className="space-y-2">
                <Label htmlFor="public-link-label">Rubrik på sidan</Label>
                <Input
                  id="public-link-label"
                  value={labelDraft}
                  onChange={e => setLabelDraft(e.target.value)}
                  placeholder="t.ex. Allmän kurs A"
                  maxLength={150}
                />
                <Label htmlFor="public-link-hidden" className="block pt-2">Dölj för deltagarna</Label>
                <Textarea
                  id="public-link-hidden"
                  value={hiddenDraft}
                  onChange={e => setHiddenDraft(e.target.value)}
                  placeholder="APT; AK-möte; Planering*"
                  rows={2}
                />
                <p className="text-xs text-gray-500">
                  Hela titeln, semikolon mellan. <code>*</code> är jokertecken: &quot;AK*&quot; döljer
                  även &quot;AK-möte&quot;. Egen lista, skild från exportundantagen.
                </p>
                <Button size="sm" onClick={handleSaveDetails} disabled={isBusy || !detailsDirty}>
                  Spara
                </Button>
              </section>

              <section className="space-y-2 border-t-2 border-dashed border-gray-200 pt-4">
                <p className="text-xs text-gray-500">
                  Färg- och salsregler följer med från den här datorn när du byter schema, sparar
                  eller ändrar reglerna.
                </p>
                <div className="flex flex-wrap gap-2">
                  {confirmRotate ? (
                    <>
                      <Button size="sm" className="bg-rose-200 hover:bg-rose-300" disabled={isBusy} onClick={handleRotate}>
                        Ja, byt länk
                      </Button>
                      <Button size="sm" variant="neutral" onClick={() => setConfirmRotate(false)}>Avbryt</Button>
                      <span className="self-center text-xs text-gray-600">
                        Den gamla slutar fungera direkt. Du behöver dela den nya.
                      </span>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="neutral" disabled={isBusy} onClick={() => setConfirmRotate(true)}>
                        Byt länk
                      </Button>
                      <Button
                        size="sm"
                        variant="neutral"
                        disabled={isBusy}
                        onClick={() => update({ enabled: !link.enabled })}
                      >
                        {link.enabled ? 'Stäng av' : 'Slå på igen'}
                      </Button>
                    </>
                  )}
                </div>
              </section>
            </div>
          )}

          {error && <p className="text-sm font-bold text-rose-700" role="alert">{error}</p>}

          <DialogFooter>
            <Button variant="neutral" onClick={() => setIsOpen(false)}>Stäng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
