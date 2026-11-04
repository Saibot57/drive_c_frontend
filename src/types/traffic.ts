/** Speglar svaret från backendens `/api/trafik` (camelCase, som Schema). */

export type TrafficTotals = {
  publicViews: number;
  publicVisits: number;
  publicDevices: number;
  appCalls: number;
  serverErrors: number;
  aborted: number;
  notModified: number;
  scannerHits: number;
  medianPublicMs: number | null;
};

export type TrafficDay = {
  date: string;
  publicViews: number;
  publicDevices: number;
  appCalls: number;
  serverErrors: number;
};

export type TrafficHour = { hour: number; publicViews: number; appCalls: number };

export type TrafficError = { time: string; status: number; page: string };

export type TrafficSummary = {
  period: { from: string; to: string; days: number; logStart: string | null };
  totals: TrafficTotals;
  previousTotals: TrafficTotals | null;
  perDay: TrafficDay[];
  perHour: TrafficHour[];
  devices: { device: string; count: number }[];
  features: { feature: string; calls: number }[];
  errors: TrafficError[];
  errorCount: number;
};
