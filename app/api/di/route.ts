import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface DiContract {
  symbol:      string;
  maturity:    string;
  rate:        number | null;
  varBps:      number | null;   // round((rateD1 - rateD2) * 100)
  isReference: boolean;
}

// DI1 contracts to display (Jan of each year)
const TARGET_YEARS = [2027, 2028, 2029, 2030, 2031, 2032];

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
  const url = b3url(path, params);
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8_000);
    const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal, headers: B3_HDR });
    const text = await r.text();
    console.log(`[di/b3] ${path} → HTTP ${r.status} | first 200 chars: ${text.slice(0, 200)}`);
    if (!r.ok) return null;
    try {
      return JSON.parse(text);
    } catch {
      console.log(`[di/b3] JSON parse failed — likely HTML/Cloudflare block`);
      return null;
    }
  } catch (err) {
    console.log(`[di/b3] fetch exception for ${path}:`, String(err));
    return null;
  }
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

// Approximate business days from D-1 date string to Jan of targetYear
function approxDu(fromDateStr: string, targetYear: number): number {
  const from     = new Date(fromDateStr);
  const to       = new Date(targetYear, 0, 5); // ~1st business day of Jan
  const calDays  = (to.getTime() - from.getTime()) / 86_400_000;
  return Math.max(1, Math.round(calDays * 252 / 365));
}

function closestRate(rows: { day252: number; rate: number }[], target: number): number | null {
  if (!rows.length) return null;
  return rows.reduce((a, b) =>
    Math.abs(a.day252 - target) <= Math.abs(b.day252 - target) ? a : b
  ).rate;
}

export async function GET() {
  console.log('[di] GET called');
  const datesData = await b3get('Search/GetDate', { language: 'pt-br', id: 'PRE' });
  console.log('[di] datesData type:', Array.isArray(datesData) ? `array[${datesData.length}]` : typeof datesData);
  if (!Array.isArray(datesData) || !datesData.length) return NextResponse.json([]);

  const d1 = datesData[0].slice(0, 10);
  const d2 = datesData.length > 1 ? datesData[1].slice(0, 10) : null;

  const [curveD1, curveD2] = await Promise.all([
    fetchPreCurve(d1),
    d2 ? fetchPreCurve(d2) : Promise.resolve([]),
  ]);

  const contracts: DiContract[] = TARGET_YEARS.map((year, idx) => {
    const du     = approxDu(d1, year);
    const rateD1 = closestRate(curveD1, du);
    const rateD2 = closestRate(curveD2, du);
    const varBps = rateD1 != null && rateD2 != null
      ? Math.round((rateD1 - rateD2) * 100)
      : null;
    return {
      symbol:      `DI1F${String(year).slice(2)}`,
      maturity:    `Jan/${String(year).slice(2)}`,
      rate:        rateD1 != null ? +rateD1.toFixed(2) : null,
      varBps,
      isReference: idx === 0,
    };
  });

  const result = contracts.filter(c => c.rate != null);
  console.log(`[di] returning ${result.length} contracts, curveD1=${curveD1.length} rows, curveD2=${curveD2.length} rows`);
  return NextResponse.json(result);
}
