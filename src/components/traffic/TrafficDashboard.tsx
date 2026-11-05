'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { FeatureNavigation } from '@/components/FeatureNavigation';
import { BarChart, HorizontalBars } from '@/components/traffic/TrafficCharts';
import { TrafficNotAvailableError, trafficService } from '@/services/trafficService';
import type { TrafficSummary, TrafficTotals } from '@/types/traffic';
import { cn } from '@/lib/utils';
import { changeFrom, dayLabel, formatCount, formatShare, timeLabel } from '@/utils/traffic';
import '@/styles/schedule-theme.css';

/**
 * Trafiksidan: vem som använder appen, ur backendens access-logg.
 *
 * Sidan nås bara med direktlänken /features/trafik och står inte i menyn.
 * Det är inget lås: backend svarar bara konton i TRAFFIC_VIEWERS, och alla
 * andra ser att statistiken inte finns. Loggen räcker ungefär två veckor
 * bakåt, så 7 eller 14 dygn kan väljas.
 */

const PERIODS = [7, 14] as const;

type Kpi = {
  label: string;
  note: string;
  value: (t: TrafficTotals) => string;
  /** Talet som jämförs med perioden före, om det går. */
  compare?: (t: TrafficTotals) => number;
  /** Att talet ökar är dåligt. */
  higherIsWorse?: boolean;
  alert?: (t: TrafficTotals) => boolean;
};

const KPIS: Kpi[] = [
  { label: 'Besök på schemalänken', note: 'En enhet, minst 30 min paus före', value: t => formatCount(t.publicVisits), compare: t => t.publicVisits },
  { label: 'Olika enheter', note: 'IP + webbläsare, ungefärligt', value: t => formatCount(t.publicDevices), compare: t => t.publicDevices },
  { label: 'Inloggade anrop', note: 'Schemaplanerare, workspace m.m.', value: t => formatCount(t.appCalls), compare: t => t.appCalls },
  { label: 'Median svarstid', note: 'Schemalänken, millisekunder', value: t => (t.medianPublicMs === null ? '–' : formatCount(t.medianPublicMs)) },
  {
    label: 'Serverfel', note: '500 och 502', value: t => formatCount(t.serverErrors),
    compare: t => t.serverErrors, higherIsWorse: true, alert: t => t.serverErrors > 0,
  },
  {
    label: 'Svar 304', note: 'Oförändrat schema, av alla visningar', value: t => formatShare(t.notModified, t.publicViews),
    alert: t => t.publicViews > 0 && t.notModified === 0,
  },
];

export default function TrafficDashboard() {
  const [days, setDays] = useState<number>(7);
  const [summary, setSummary] = useState<TrafficSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (n: number) => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await trafficService.get(n));
    } catch (e) {
      setSummary(null);
      setError(e instanceof TrafficNotAvailableError || e instanceof Error ? e.message : 'Kunde inte hämta statistiken.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(days); }, [days, load]);

  return (
    <div className="sp-root">
      <div className="relative z-10 space-y-6 pb-20">
        <div className="sp-toolbar flex flex-col items-start gap-4 p-4 lg:flex-row lg:items-center">
          <FeatureNavigation />
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            {PERIODS.map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setDays(n)}
                aria-pressed={days === n}
                className={cn(
                  'h-10 rounded-ui-sm border border-ui-line px-3 text-sm font-semibold',
                  days === n ? 'bg-ui-ink text-ui-paper' : 'bg-ui-paper',
                )}
              >
                {n} dygn
              </button>
            ))}
            <button
              type="button"
              onClick={() => void load(days)}
              disabled={loading}
              className="flex h-10 items-center gap-1.5 rounded-ui-sm border border-ui-line bg-ui-paper px-3 text-sm font-semibold"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Uppdatera
            </button>
          </div>
        </div>

        {error && (
          <div className="sp-card-sm p-6 text-sm">
            <p className="font-semibold">{error}</p>
            {error.startsWith('Loggen') && (
              <p className="mt-1 text-ui-muted">Backend hittar eller får inte läsa access-loggen. Kontrollera TRAFFIC_ACCESS_LOG.</p>
            )}
          </div>
        )}

        {summary && <Summary summary={summary} />}
        {!summary && !error && <p className="px-1 text-sm text-ui-muted">Hämtar statistiken…</p>}
      </div>
    </div>
  );
}

function Summary({ summary }: { summary: TrafficSummary }) {
  const { totals, previousTotals, period } = summary;
  const iphones = summary.devices.find(d => d.device === 'iPhone')?.count ?? 0;
  const deviceTotal = summary.devices.reduce((n, d) => n + d.count, 0);

  return (
    <>
      <header className="px-1">
        <h1 className="text-2xl font-bold">Trafik senaste {period.days} dygnen</h1>
        <p className="mt-1 max-w-3xl text-sm text-ui-muted">
          {timeLabel(period.from)} – {timeLabel(period.to)}.{' '}
          Schemalänken hämtades {formatCount(totals.publicViews)} gånger, {formatShare(iphones, deviceTotal)} av enheterna
          är iPhone. {previousTotals ? 'Jämfört med perioden före.' : 'Loggen räcker inte till en jämförelse med perioden före.'}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" aria-label="Nyckeltal">
        {KPIS.map(kpi => {
          const change = kpi.compare && previousTotals ? changeFrom(kpi.compare(totals), kpi.compare(previousTotals)) : null;
          const bad = change && change.direction !== 'same' && ((change.direction === 'up') === Boolean(kpi.higherIsWorse));
          return (
            <div key={kpi.label} className="sp-card-sm p-4">
              <div className="text-xs font-semibold text-ui-muted">{kpi.label}</div>
              <div className={cn('mt-1 text-3xl font-bold tabular-nums', kpi.alert?.(totals) && 'text-ui-danger')}>
                {kpi.value(totals)}
              </div>
              <div className="mt-1 text-xs text-ui-muted">
                {change && <span className={cn('mr-1 font-semibold', bad && 'text-ui-danger')}>{change.text}</span>}
                {kpi.note}
              </div>
            </div>
          );
        })}
      </section>

      <section className="sp-card p-4">
        <h2 className="font-semibold">Trafik per dag</h2>
        <p className="mb-2 text-xs text-ui-muted">Röd prick: dag med serverfel. Håll muspekaren över en dag för siffrorna.</p>
        <Legend />
        <BarChart
          rows={summary.perDay}
          series={[
            { key: 'publicViews', name: 'Schemalänken', color: 'var(--ui-accent)' },
            { key: 'appCalls', name: 'Inloggad app', color: 'var(--ui-muted)' },
          ]}
          label={r => dayLabel(r.date)}
          title={r => `${dayLabel(r.date)} · ${formatCount(r.publicDevices)} enheter${r.serverErrors ? ` · ${r.serverErrors} serverfel` : ''}`}
          marker={r => r.serverErrors > 0}
          labelWidth={64}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="sp-card p-4">
          <h2 className="font-semibold">När på dygnet</h2>
          <p className="mb-2 text-xs text-ui-muted">Svensk tid, hela perioden sammanlagd.</p>
          <Legend />
          <BarChart
            rows={summary.perHour}
            series={[
              { key: 'publicViews', name: 'Schemalänken', color: 'var(--ui-accent)' },
              { key: 'appCalls', name: 'Inloggad app', color: 'var(--ui-muted)' },
            ]}
            label={r => String(r.hour).padStart(2, '0')}
            title={r => `kl. ${String(r.hour).padStart(2, '0')}–${String((r.hour + 1) % 24).padStart(2, '0')}`}
            labelWidth={26}
          />
        </section>
        <div className="grid grid-cols-1 gap-6">
          <section className="sp-card p-4">
            <h2 className="mb-3 font-semibold">Enheter på schemalänken</h2>
            <HorizontalBars rows={summary.devices.map(d => ({ label: d.device, value: d.count }))} />
          </section>
          <section className="sp-card p-4">
            <h2 className="mb-3 font-semibold">Inloggad app per funktion</h2>
            <HorizontalBars rows={summary.features.map(f => ({ label: f.feature, value: f.calls }))} />
          </section>
        </div>
      </div>

      <section className="sp-card p-4">
        <h2 className="font-semibold">Fel och avbrutna anrop</h2>
        <p className="mb-3 text-xs text-ui-muted">
          500 och 502 är serverfel. 499 betyder att besökaren gav upp innan svaret kom.
          {summary.errorCount > summary.errors.length && ` Visar de ${summary.errors.length} senaste av ${summary.errorCount}.`}
        </p>
        {summary.errors.length === 0 ? (
          <p className="text-sm text-ui-muted">Inga fel under perioden.</p>
        ) : (
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ui-muted">
                  <th className="sticky top-0 bg-ui-paper py-1 pr-4 font-semibold">Tid</th>
                  <th className="sticky top-0 bg-ui-paper py-1 pr-4 font-semibold">Status</th>
                  <th className="sticky top-0 bg-ui-paper py-1 font-semibold">Sida</th>
                </tr>
              </thead>
              <tbody>
                {summary.errors.map((e, i) => (
                  <tr key={`${e.time}-${i}`} className="border-t border-ui-hair">
                    <td className="whitespace-nowrap py-1 pr-4 tabular-nums">{timeLabel(e.time)}</td>
                    <td className={cn('py-1 pr-4 font-semibold tabular-nums', e.status >= 500 && 'text-ui-danger')}>{e.status}</td>
                    <td className="break-all py-1">{e.page}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="px-1 text-xs text-ui-muted">
        Källa: backendens access-logg på PythonAnywhere, uppdateras högst var tionde minut.
        CORS-förfrågningar är borträknade, och {formatCount(totals.scannerHits)} anrop från skannrar utanför API:t räknas inte som trafik.
        Sidvisningar på Vercel syns inte här.
      </p>
    </>
  );
}

function Legend() {
  return (
    <div className="mb-1 flex flex-wrap gap-4 text-xs text-ui-muted">
      <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--ui-accent)' }} />Schemalänken</span>
      <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--ui-muted)' }} />Inloggad app</span>
    </div>
  );
}
