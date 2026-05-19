import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface YahooQuoteResult {
  price:         number | null;
  change:        number | null;
  changePercent: number | null;
}

function abortAfter(ms: number) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('tickers') ?? req.nextUrl.searchParams.get('ticker') ?? '';
  const tickers = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 80);

  if (!tickers.length) return NextResponse.json({});

  const result: Record<string, YahooQuoteResult> = {};

  await Promise.allSettled(tickers.map(async (ticker) => {
    try {
      const r = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=2d&interval=1d`,
        {
          cache: 'no-store',
          signal: abortAfter(8_000).signal,
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        }
      );
      if (!r.ok) return;

      const data = await r.json();
      const result0 = data?.chart?.result?.[0];
      const meta    = result0?.meta;
      if (!meta?.regularMarketPrice) return;

      const price = meta.regularMarketPrice as number;
      let change: number | null        = meta.regularMarketChange        as number ?? null;
      let changePercent: number | null = meta.regularMarketChangePercent as number ?? null;

      if (changePercent == null) {
        // Fallback: compute from previous close (closes[0] with range=2d is yesterday)
        const raw: (number | null)[] = result0?.indicators?.quote?.[0]?.close ?? [];
        const closes = raw.filter((v): v is number => typeof v === 'number' && isFinite(v));
        if (closes.length >= 1 && closes[0] > 0) {
          change        = price - closes[0];
          changePercent = (change / closes[0]) * 100;
        }
      }

      result[ticker] = { price, change, changePercent };
    } catch { /* skip */ }
  }));

  return NextResponse.json(result);
}
