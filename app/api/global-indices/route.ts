import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface IndexEntry {
  label:     string;
  price:     number | null;
  changePct: number | null;
  weekPct:   number | null;
  group:     'brasil' | 'global';
}

export interface YieldEntry {
  label:     string;
  rate:      number | null;
  changeBps: number | null;   // absolute change in basis points (1bp = 0.01pp)
}

interface QuoteResult {
  price:     number | null;
  changePct: number | null;
  weekPct:   number | null;
}

const NULL_Q: QuoteResult = { price: null, changePct: null, weekPct: null };
const BRASIL_ORDER = ['IBOV', 'IFIX', 'IMOB', 'IDIV', 'SMLL', 'EWZ (ETF BR)'];

function abortAfter(ms: number) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl;
}

// Yahoo Finance v8/chart — range=5d gives week data too
async function yahooQuote(symbol: string): Promise<QuoteResult> {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 6_000);
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`,
      {
        cache: 'no-store', signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      }
    );
    if (!r.ok) return NULL_Q;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await r.json();
    const result = data?.chart?.result?.[0];
    const meta   = result?.meta;
    if (!meta?.regularMarketPrice) return NULL_Q;

    const price = meta.regularMarketPrice as number;

    const closes: number[] = (result?.indicators?.quote?.[0]?.close ?? []).filter(
      (v: unknown): v is number => typeof v === 'number' && isFinite(v)
    );

    // Day %: derive from closes array when possible.
    // With range=5d: chartPreviousClose points 6 days back — use closes instead.
    // With 1 close (some B3 indices Yahoo doesn't track historically): chartPreviousClose
    // is the actual previous day close, so use it directly.
    let prevDayClose: number | null = null;
    if (closes.length >= 2) {
      const last = closes[closes.length - 1];
      prevDayClose = Math.abs(last - price) / price < 0.001
        ? closes[closes.length - 2]
        : last;
    } else if (closes.length <= 1 && meta.chartPreviousClose != null) {
      prevDayClose = meta.chartPreviousClose as number;
    }
    const changePct = prevDayClose != null ? ((price - prevDayClose) / prevDayClose) * 100 : null;

    // Week % from first close in the 5-day window
    const weekPct = closes.length >= 2 ? ((price - closes[0]) / closes[0]) * 100 : null;

    return { price, changePct, weekPct };
  } catch {
    return NULL_Q;
  }
}

async function brapiQuote(symbol: string): Promise<QuoteResult> {
  try {
    const tok  = process.env.BRAPI_TOKEN ?? '';
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 6_000);
    const r = await fetch(
      `https://brapi.dev/api/quote/${symbol}?token=${tok}`,
      { cache: 'no-store', signal: ctrl.signal }
    );
    if (!r.ok) return NULL_Q;
    const data = await r.json();
    const q    = data.results?.[0];
    if (!q?.regularMarketPrice) return NULL_Q;
    return {
      price:     q.regularMarketPrice,
      changePct: q.regularMarketChangePercent ?? null,
      weekPct:   null,
    };
  } catch {
    return NULL_Q;
  }
}

async function withFallbacks(sources: Array<() => Promise<QuoteResult>>): Promise<QuoteResult> {
  let priceOnly: QuoteResult = NULL_Q;
  for (const src of sources) {
    try {
      const r = await src();
      if (r.price != null && r.changePct != null) return r;         // full result
      if (r.price != null && priceOnly.price == null) priceOnly = r; // keep as fallback
    } catch {}
  }
  return priceOnly;
}

// Brasil indices — each has ordered fallback sources
const BRASIL_INDICES: Array<{ label: string; sources: Array<() => Promise<QuoteResult>> }> = [
  {
    label: 'IBOV',
    sources: [
      () => yahooQuote('^BVSP'),
      () => brapiQuote('%5EBVSP'),
      () => brapiQuote('BOVA11'),
    ],
  },
  {
    label: 'IFIX',
    sources: [
      () => yahooQuote('IFIX.SA'),
      () => brapiQuote('IFIX'),
    ],
  },
  {
    label: 'IMOB',
    sources: [
      () => yahooQuote('IMOB.SA'),
      () => brapiQuote('IMOB'),
    ],
  },
  {
    label: 'IDIV',
    sources: [
      () => yahooQuote('DIVO11.SA'),
      () => brapiQuote('DIVO11'),
    ],
  },
  {
    label: 'SMLL',
    sources: [
      () => yahooQuote('SMAL11.SA'),
      () => brapiQuote('SMAL11'),
    ],
  },
  {
    label: 'EWZ (ETF BR)',
    sources: [
      () => yahooQuote('EWZ'),
    ],
  },
];

// ── Sovereign yield helpers ────────────────────────────────────────────────────

// Yahoo yield: uses close-to-close absolute change → basis points
async function yahooYield(symbol: string, label: string): Promise<YieldEntry> {
  const q = await yahooQuote(symbol);
  let changeBps: number | null = null;
  // changePct = (price - prev) / prev * 100  =>  prev = price*100/(100+changePct)
  // changeBps = (price - prev) * 100
  if (q.price != null && q.changePct != null) {
    const prev  = q.price * 100 / (100 + q.changePct);
    changeBps   = Math.round((q.price - prev) * 100 * 10) / 10;
  }
  return { label, rate: q.price, changeBps };
}

// B3 yield: PRE curve (DI x Pré), ~10Y maturity (≈2520 business days), D-1 close
async function fetchB3Yield(): Promise<YieldEntry> {
  const label    = 'BR 10Y (DI)';
  const TARGET   = 2520;
  const B3_BASE  = 'https://sistemaswebb3-derivativos.b3.com.br/referenceRatesProxy/';
  const B3_HDR   = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Referer':    'https://www.b3.com.br',
    'Accept':     'application/json',
  };

  function b3url(path: string, params: object): string {
    return B3_BASE + path + '/' + Buffer.from(JSON.stringify(params)).toString('base64');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function b3get(path: string, params: object): Promise<any> {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8_000);
    const r = await fetch(b3url(path, params), { cache: 'no-store', signal: ctrl.signal, headers: B3_HDR });
    if (!r.ok) return null;
    return r.json();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function parseRows(results: any[]): { day252: number; rate: number }[] {
    return (results ?? [])
      .map(r => ({ day252: r.day252 as number, rate: parseFloat((r.rate as string).replace(',', '.')) }))
      .filter(r => isFinite(r.rate));
  }

  async function fetchCurve(date: string): Promise<{ day252: number; rate: number }[]> {
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

  function closestRate(rows: { day252: number; rate: number }[]): number | null {
    if (!rows.length) return null;
    return rows.reduce((a, b) => Math.abs(a.day252 - TARGET) <= Math.abs(b.day252 - TARGET) ? a : b).rate;
  }

  try {
    const datesData = await b3get('Search/GetDate', { language: 'pt-br', id: 'PRE' });
    if (!Array.isArray(datesData) || !datesData.length) return { label, rate: null, changeBps: null };
    const d1 = datesData[0].slice(0, 10);
    const d2 = datesData.length > 1 ? datesData[1].slice(0, 10) : null;

    const [curveD1, curveD2] = await Promise.all([
      fetchCurve(d1),
      d2 ? fetchCurve(d2) : Promise.resolve([]),
    ]);

    const rateD1 = closestRate(curveD1);
    const rateD2 = closestRate(curveD2);
    const changeBps = rateD1 != null && rateD2 != null
      ? Math.round((rateD1 - rateD2) * 100 * 10) / 10
      : null;

    return { label, rate: rateD1, changeBps };
  } catch { return { label, rate: null, changeBps: null }; }
}

const YIELD_INSTRUMENTS = [
  { symbol: '^TNX', label: 'US 10Y' },
  { symbol: '^IRX', label: 'US 2Y'  },
];

async function fetchEcbYield(): Promise<YieldEntry> {
  const label = 'EUR 10Y (AAA)';
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 6_000);
    const r = await fetch(
      'https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y?format=jsondata&lastNObservations=2',
      { cache: 'no-store', signal: ctrl.signal }
    );
    if (!r.ok) return { label, rate: null, changeBps: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = await r.json();
    const series = d?.dataSets?.[0]?.series;
    const key    = series ? Object.keys(series)[0] : null;
    if (!key) return { label, rate: null, changeBps: null };
    const obs    = series[key]?.observations ?? {};
    const sorted = Object.keys(obs).sort((a, b) => +a - +b);
    const latest = sorted.length > 0 ? (obs[sorted[sorted.length - 1]]?.[0] as number) : null;
    const prev   = sorted.length > 1 ? (obs[sorted[sorted.length - 2]]?.[0] as number) : null;
    const changeBps = latest != null && prev != null
      ? Math.round((latest - prev) * 100 * 10) / 10 : null;
    return { label, rate: typeof latest === 'number' ? latest : null, changeBps };
  } catch { return { label, rate: null, changeBps: null }; }
}

async function fetchBoeGilt(): Promise<YieldEntry> {
  const label = 'UK 10Y (Gilt)';
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8_000);
    const r = await fetch(
      'https://www.bankofengland.co.uk/boeapps/database/_iadb-FromShowColumns.asp?csv.x=yes&Datefrom=01/Mar/2026&Dateto=now&SeriesCodes=IUDMNZC&CSVF=TN&UsingCodes=Y',
      { cache: 'no-store', signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!r.ok) return { label, rate: null, changeBps: null };
    const text  = await r.text();
    const lines = text.trim().split('\n').filter(l => /^\d/.test(l.trim()));
    if (!lines.length) return { label, rate: null, changeBps: null };
    const latest = parseFloat(lines[lines.length - 1].split(',')[1]);
    const prev   = lines.length > 1 ? parseFloat(lines[lines.length - 2].split(',')[1]) : NaN;
    const changeBps = isFinite(latest) && isFinite(prev)
      ? Math.round((latest - prev) * 100 * 10) / 10 : null;
    return { label, rate: isFinite(latest) ? latest : null, changeBps };
  } catch { return { label, rate: null, changeBps: null }; }
}

async function fetchEcbRate(): Promise<number | null> {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 6_000);
    const r = await fetch(
      'https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.4F.KR.MRR_FR.LEV?format=jsondata&lastNObservations=1',
      { cache: 'no-store', signal: ctrl.signal }
    );
    if (!r.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = await r.json();
    const series = d?.dataSets?.[0]?.series;
    const key    = series ? Object.keys(series)[0] : null;
    if (!key) return null;
    const obs    = series[key]?.observations ?? {};
    const last   = Object.keys(obs).sort((a, b) => +a - +b).pop();
    const val    = last != null ? obs[last]?.[0] : null;
    return typeof val === 'number' ? val : null;
  } catch { return null; }
}

// Global indices — Yahoo Finance only
const GLOBAL_INDICES = [
  { symbol: '^GSPC',  label: 'S&P 500'  },
  { symbol: '^IXIC',  label: 'NASDAQ'   },
  { symbol: '^DJI',   label: 'DOW'      },
  { symbol: '^GDAXI', label: 'DAX'      },
  { symbol: '^FTSE',  label: 'FTSE 100' },
  { symbol: '^N225',  label: 'NIKKEI'   },
];

export async function GET() {
  const [brasilResults, globalResults, usYields, ecbYield, boeGilt, brYield, ecbRate] = await Promise.all([
    Promise.all(
      BRASIL_INDICES.map(async (idx) => {
        const q = await withFallbacks(idx.sources);
        return { label: idx.label, ...q, group: 'brasil' as const };
      })
    ),
    Promise.all(
      GLOBAL_INDICES.map(async (idx) => {
        const q = await yahooQuote(idx.symbol);
        return { label: idx.label, ...q, group: 'global' as const };
      })
    ),
    Promise.all(YIELD_INSTRUMENTS.map(({ symbol, label }) => yahooYield(symbol, label))),
    fetchEcbYield(),
    fetchBoeGilt(),
    fetchB3Yield(),
    fetchEcbRate(),
  ]);

  const brasil = (brasilResults as IndexEntry[])
    .sort((a, b) => BRASIL_ORDER.indexOf(a.label) - BRASIL_ORDER.indexOf(b.label));

  const yields: YieldEntry[] = [
    ...usYields,                                        // US 10Y, US 2Y
    ecbYield,                                           // EUR 10Y (AAA)
    boeGilt,                                            // UK 10Y (Gilt)
    brYield,                                            // BR 10Y (DI)
    { label: 'BCE', rate: ecbRate, changeBps: null },
  ];

  return NextResponse.json({
    brasil,
    global: globalResults as IndexEntry[],
    yields,
    updatedAt: new Date().toISOString(),
  });
}
