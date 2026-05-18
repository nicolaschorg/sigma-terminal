import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function abortAfter(ms: number) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl;
}

function toYahooSym(symbol: string): string {
  return /^[A-Z]{4,6}\d{1,2}$/.test(symbol) ? `${symbol}.SA` : symbol;
}

function calcPerf(prices: number[]) {
  const cur = prices[prices.length - 1];
  const pct = (from: number) => from > 0 ? ((cur - from) / from) * 100 : null;
  return {
    varWeek:  prices.length >= 6  ? pct(prices[prices.length - 6])  : null,
    varMonth: prices.length >= 22 ? pct(prices[prices.length - 22]) : null,
    varYTD:   pct(prices[0]),
  };
}

async function yahooChartPerf(symbol: string) {
  const ySym = toYahooSym(symbol);
  const r = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?range=ytd&interval=1d`,
    {
      cache: 'no-store',
      signal: abortAfter(10_000).signal,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    }
  );
  if (!r.ok) return null;
  const data = await r.json();
  const result = data?.chart?.result?.[0];
  if (!result) return null;
  const raw: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
  const prices = raw.filter((v): v is number => v != null && isFinite(v));
  if (prices.length < 5) return null;
  return calcPerf(prices);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol.toUpperCase().replace(/\.SA$/i, '');
  const tok    = process.env.BRAPI_TOKEN ?? '';

  // ── 1. Brapi (faster, covers Brazilian equities well) ────────────────────────
  try {
    const r = await fetch(
      `https://brapi.dev/api/quote/${symbol}?range=ytd&interval=1d&token=${tok}`,
      { cache: 'no-store', signal: abortAfter(8_000).signal }
    );
    if (r.ok) {
      const data = await r.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hist: any[] = data.results?.[0]?.historicalDataPrice ?? [];
      if (hist.length >= 5) {
        const prices = hist.map((h: { close: number }) => h.close).filter(Number.isFinite);
        if (prices.length >= 5) return NextResponse.json(calcPerf(prices));
      }
    }
  } catch { /* fall through */ }

  // ── 2. Yahoo Finance v8/chart (range=ytd, no crumb needed) ───────────────────
  try {
    const perf = await yahooChartPerf(symbol);
    if (perf) return NextResponse.json(perf);
  } catch { /* fall through */ }

  return NextResponse.json({ varWeek: null, varMonth: null, varYTD: null });
}
