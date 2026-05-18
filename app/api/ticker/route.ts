import { NextResponse } from 'next/server';
import { TickerItem } from '@/types';

export const dynamic = 'force-dynamic';

const SYMBOLS: { label: string; yahoo: string }[] = [
  { label: 'IBOV',    yahoo: '^BVSP'    },
  { label: 'IFIX',    yahoo: 'IFIX.SA'  },
  { label: 'PETR4',   yahoo: 'PETR4.SA' },
  { label: 'VALE3',   yahoo: 'VALE3.SA' },
  { label: 'ITUB4',   yahoo: 'ITUB4.SA' },
  { label: 'USD/BRL', yahoo: 'BRL=X'    },
  { label: 'EUR/BRL', yahoo: 'EURBRL=X' },
  { label: 'SPX',     yahoo: '^GSPC'    },
  { label: 'NASDAQ',  yahoo: '^IXIC'    },
];

function abortAfter(ms: number) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl;
}

async function yahooQuote(yahoo: string): Promise<{ price: number; changePercent: number } | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?range=2d&interval=1d`,
      {
        cache:   'no-store',
        signal:  abortAfter(6_000).signal,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      }
    );
    if (!r.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await r.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const price   = meta.regularMarketPrice as number;
    const result  = data?.chart?.result?.[0];
    const closes: number[] = (result?.indicators?.quote?.[0]?.close ?? []).filter(
      (v: unknown): v is number => typeof v === 'number' && isFinite(v)
    );
    let prevClose: number | null = null;
    if (closes.length >= 2) {
      const last = closes[closes.length - 1];
      prevClose = Math.abs(last - price) / price < 0.001 ? closes[closes.length - 2] : last;
    } else if (closes.length === 1) {
      prevClose = closes[0];
    }
    const changePct = prevClose != null ? ((price - prevClose) / prevClose) * 100 : 0;
    return { price, changePercent: changePct };
  } catch {
    return null;
  }
}

export async function GET() {
  const results = await Promise.allSettled(
    SYMBOLS.map(async (s) => {
      const q = await yahooQuote(s.yahoo);
      if (!q) return null;
      return {
        symbol:        s.label,
        price:         q.price,
        change:        0,
        changePercent: q.changePercent,
        isRate:        false,
      } as TickerItem;
    })
  );

  const items = results
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter((x): x is TickerItem => x != null);

  return NextResponse.json(items);
}
