'use client';

import React, { useState } from 'react';
import { KeyRound, Loader2, Lock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MIN_PASSPHRASE_LENGTH } from '@/utils/narvaroCrypto';
import type { NarvaroPhase } from '@/hooks/useNarvaroSync';

type Props = {
  phase: Exclude<NarvaroPhase, 'ready'>;
  error: string | null;
  busy: boolean;
  onSetup: (passphrase: string, remember: boolean) => void;
  onUnlock: (passphrase: string, remember: boolean) => void;
  onReset: () => void;
  onRetry: () => void;
};

/** Välj lösenfras första gången, eller lås upp. Visas innan något elevnamn syns. */
export function NarvaroLock({ phase, error, busy, onSetup, onUnlock, onReset, onRetry }: Props) {
  const [pass, setPass] = useState('');
  const [again, setAgain] = useState('');
  const [remember, setRemember] = useState(true);
  const [armed, setArmed] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (phase === 'loading') {
    return (
      <section className="sp-card flex items-center gap-3 p-6 text-sm">
        <Loader2 className="animate-spin" size={18} /> Hämtar närvaron…
      </section>
    );
  }

  if (phase === 'error') {
    return (
      <section className="sp-card flex flex-col items-start gap-3 p-6">
        <h2 className="text-lg font-bold">Servern svarar inte</h2>
        <p className="text-sm text-ui-muted">{error ?? 'Kunde inte hämta närvaron.'} Inget har ändrats.</p>
        <Button variant="neutral" className="sp-btn" onClick={onRetry}><RefreshCw /> Försök igen</Button>
      </section>
    );
  }

  const isSetup = phase === 'setup';
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (isSetup) {
      if (pass.length < MIN_PASSPHRASE_LENGTH) { setLocalError(`Lösenfrasen behöver minst ${MIN_PASSPHRASE_LENGTH} tecken.`); return; }
      if (pass !== again) { setLocalError('Lösenfraserna är inte likadana.'); return; }
      onSetup(pass, remember);
    } else {
      if (!pass) return;
      onUnlock(pass, remember);
    }
  };
  const shown = localError ?? error;

  return (
    <section className="sp-card flex max-w-xl flex-col gap-4 p-6" aria-label={isSetup ? 'Välj lösenfras' : 'Lås upp'}>
      <div className="flex items-center gap-2">
        {isSetup ? <KeyRound size={20} /> : <Lock size={20} />}
        <h2 className="text-xl font-bold">{isSetup ? 'Välj en lösenfras' : 'Lås upp närvaron'}</h2>
      </div>
      {isSetup ? (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            Närvaron, noteringarna och grupperna krypteras på den här enheten innan de sparas. Servern får bara
            obegriplig text och kan inte läsa några namn. Samma lösenfras låser upp dem på dina andra enheter.
          </p>
          <p className="font-semibold">
            Glömmer du lösenfrasen går det inte att få tillbaka något. Inte heller för den som driver servern.
          </p>
          <p className="text-ui-muted">Några ord i följd är lättare att minnas än krångliga tecken, till exempel &quot;grön cykel under bron&quot;.</p>
          <p className="text-ui-muted">Veckor som är äldre än ett läsår tas bort automatiskt.</p>
        </div>
      ) : (
        <p className="text-sm">Skriv lösenfrasen du valde för närvarorutorna.</p>
      )}

      <form className="flex flex-col gap-3" onSubmit={submit}>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Lösenfras
          <Input
            id="narvaro-pass"
            type="password"
            autoComplete={isSetup ? 'new-password' : 'current-password'}
            value={pass}
            onChange={e => setPass(e.target.value)}
            autoFocus
          />
        </label>
        {isSetup && (
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Samma igen
            <Input id="narvaro-pass-again" type="password" autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} />
          </label>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input id="narvaro-remember" type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
          Kom ihåg på den här enheten
        </label>
        <p className="-mt-2 text-xs text-ui-muted">
          Välj bort det på en dator som andra använder. Lösenfrasen sparas aldrig, bara en nyckel som inte går att läsa ut.
        </p>
        {shown && <p role="alert" className="rounded-ui-sm border border-ui-line bg-ui-mark-pink px-2 py-1 text-sm font-semibold text-ui-mark-fg">{shown}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" className="sp-btn" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} {isSetup ? 'Spara lösenfrasen' : 'Lås upp'}
          </Button>
        </div>
      </form>

      {!isSetup && (
        <div className="border-t border-ui-hair pt-3 text-sm">
          {armed ? (
            <div className="flex flex-col items-start gap-2">
              <p>
                Allt som sparats för närvarorutorna tas bort från servern: tabeller, noteringar, grupper och stämplar.
                Det går inte att ångra. Sedan väljer du en ny lösenfras.
              </p>
              <div className="flex gap-2">
                <Button variant="neutral" size="sm" className="sp-btn" disabled={busy} onClick={onReset}>Ta bort allt och börja om</Button>
                <Button variant="neutral" size="sm" className="sp-btn" onClick={() => setArmed(false)}>Avbryt</Button>
              </div>
            </div>
          ) : (
            <button type="button" className="text-ui-muted underline" onClick={() => setArmed(true)}>Glömt lösenfrasen?</button>
          )}
        </div>
      )}
    </section>
  );
}
