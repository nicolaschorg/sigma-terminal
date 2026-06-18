import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface DiContract {
  symbol:      string;
  maturity:    string;
  rate:        number | null;
  varBps:      number | null;
  isReference: boolean;
}

const TARGET_YEARS = [2027, 2028, 2029, 2030, 2031, 2032];

// ── B3 referenceRatesProxy ─────────────────────────────────────────────────────
const B3_BASE = 'https://sistemaswebb3-derivativos.b3.com.br/referenceRatesProxy/';
const B3_HDR  = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Referer':    'https://www.b3.com.br',
  'Accept':     'application/json',
};

function b3url(path: string, params: object): string {
  return B3_BASE + path + '/' + Buffer.from(JSON.stringify(params)).toString('base64');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function b3get(path: string, params: object): Promise<any> {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8_000);
    const r = await fetch(b3url(path, params), { cache: 'no-store', signal: ctrl.signal, headers: B3_HDR });
    if (!r.ok) return null;
    const text = await r.text();
    try {
      let parsed = JSON.parse(text);
      // B3 double-encodes some responses (outer JSON string wrapping inner JSON)
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      return parsed;
    } catch { return null; }
  } catch { return null; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRows(results: any[]): { day252: number; rate: number }[] {
  return (results ?? [])
    .map(r => ({ day252: r.day252 as number, rate: parseFloat((r.rate as string).replace(',', '.')) }))
    .filter(r => isFinite(r.rate));
}

async function fetchPreCurve(date: string): Promise<{ day252: number; rate: number }[]> {
  const first = await b3get('Search/GetList', { language: 'pt-br', id: 'PRE', pageNumber: 1, pageSize: 30, date });
  if (!first?.results?.length) return [];
  const totalPages: number = first.page?.totalPages ?? 1;
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      b3get('Search/GetList', { language: 'pt-br', id: 'PRE', pageNumber: i + 2, pageSize: 30, date })
    )
  );
  return [...parseRows(first.results), ...rest.flatMap(p => parseRows(p?.results))];
}

function approxDu(fromDateStr: string, targetYear: number): number {
  const calDays = (new Date(targetYear, 0, 5).getTime() - new Date(fromDateStr).getTime()) / 86_400_000;
  return Math.max(1, Math.round(calDays * 252 / 365));
}

function closestRate(rows: { day252: number; rate: number }[], target: number): number | null {
  if (!rows.length) return null;
  return rows.reduce((a, b) => Math.abs(a.day252 - target) <= Math.abs(b.day252 - target) ? a : b).rate;
}

async function fetchFromB3(): Promise<DiContract[] | null> {
  const datesData = await b3get('Search/GetDate', { language: 'pt-br', id: 'PRE' });
  if (!Array.isArray(datesData) || !datesData.length) return null;

  const d1 = datesData[0].slice(0, 10);
  const d2 = datesData.length > 1 ? datesData[1].slice(0, 10) : null;

  const [curveD1, curveD2] = await Promise.all([
    fetchPreCurve(d1),
    d2 ? fetchPreCurve(d2) : Promise.resolve([]),
  ]);

  if (!curveD1.length) return null;

  return TARGET_YEARS.map((year, idx) => {
    const du     = approxDu(d1, year);
    const rateD1 = closestRate(curveD1, du);
    const rateD2 = closestRate(curveD2, du);
    return {
      symbol:      `DI1F${String(year).slice(2)}`,
      maturity:    `Jan/${String(year).slice(2)}`,
      rate:        rateD1 != null ? +rateD1.toFixed(2) : null,
      varBps:      rateD1 != null && rateD2 != null ? Math.round((rateD1 - rateD2) * 100) : null,
      isReference: idx === 0,
    };
  }).filter(c => c.rate != null);
}

// ── ANBIMA flat file fallback ──────────────────────────────────────────────────
async function fetchAnbimaRates(isoDate: string): Promise<Map<string, number>> {
  const [yyyy, mm, dd] = isoDate.split('-');
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8_000);
    const r = await fetch(
      `https://www.anbima.com.br/informacoes/merc-sec/arqs/ms${yyyy.slice(2)}${mm}${dd}.txt`,
      { cache: 'no-store', signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!r.ok) return new Map();
    const map = new Map<string, number>();
    for (const line of (await r.text()).split('\n')) {
      const f = line.split('@');
      if (f.length < 8) continue;
      const titulo = f[0].trim();
      if (titulo !== 'LTN' && titulo !== 'NTN-F') continue;
      const rate = parseFloat(f[7].trim().replace(',', '.'));
      if (f[4].trim().length === 8 && isFinite(rate)) map.set(f[4].trim(), rate);
    }
    return map;
  } catch { return new Map(); }
}

async function findRecentAnbima(beforeIso: string | null): Promise<{ date: string; rates: Map<string, number> } | null> {
  const ref = beforeIso ? new Date(beforeIso) : new Date();
  for (let i = 1; i <= 5; i++) {
    const d = new Date(ref);
    d.setUTCDate(d.getUTCDate() - i);
    const iso   = d.toISOString().slice(0, 10);
    const rates = await fetchAnbimaRates(iso);
    if (rates.size > 0) return { date: iso, rates };
  }
  return null;
}

async function fetchFromAnbima(): Promise<DiContract[]> {
  const d1 = await findRecentAnbima(null);
  if (!d1) return [];
  const d2 = await findRecentAnbima(d1.date);
  return TARGET_YEARS.map((year, idx) => {
    const key    = `${year}0101`;
    const rateD1 = d1.rates.get(key) ?? null;
    const rateD2 = d2?.rates.get(key) ?? null;
    return {
      symbol:      `DI1F${String(year).slice(2)}`,
      maturity:    `Jan/${String(year).slice(2)}`,
      rate:        rateD1 != null ? +rateD1.toFixed(2) : null,
      varBps:      rateD1 != null && rateD2 != null ? Math.round((rateD1 - rateD2) * 100) : null,
      isReference: idx === 0,
    };
  }).filter(c => c.rate != null);
}

// ── Handler ────────────────────────────────────────────────────────────────────
export async function GET() {
  const b3result = await fetchFromB3();
  if (b3result && b3result.length > 0) return NextResponse.json(b3result);
  return NextResponse.json(await fetchFromAnbima());
}
