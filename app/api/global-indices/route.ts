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
  changePct: number | null;
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

// Sovereign yields — Yahoo Finance + ECB API
const YIELD_INSTRUMENTS = [
  { symbol: '^TNX', label: 'US 10Y' },
  { symbol: '^IRX', label: 'US 2Y'  },
];

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
  const [brasilResults, globalResults, yieldResults, ecbRate] = await Promise.all([
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
    Promise.all(
      YIELD_INSTRUMENTS.map(async ({ symbol, label }) => {
        const q = await yahooQuote(symbol);
        return { label, rate: q.price, changePct: q.changePct } as YieldEntry;
      })
    ),
    fetchEcbRate(),
  ]);

  const brasil = (brasilResults as IndexEntry[])
    .sort((a, b) => BRASIL_ORDER.indexOf(a.label) - BRASIL_ORDER.indexOf(b.label));

  const yields: YieldEntry[] = [
    ...yieldResults,
    { label: 'BCE', rate: ecbRate, changePct: null },
  ];

  return NextResponse.json({
    brasil,
    global: globalResults as IndexEntry[],
    yields,
    updatedAt: new Date().toISOString(),
  });
}
