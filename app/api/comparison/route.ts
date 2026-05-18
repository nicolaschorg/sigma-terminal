import { NextRequest, NextResponse } from 'next/server';
import { fetchHistorical } from '@/lib/brapi';

export const dynamic = 'force-dynamic';

function toRangeInterval(period: string): { range: string; interval: string } {
  switch (period) {
    case '1W':  return { range: '5d',  interval: '30m' };
    case '1M':  return { range: '1mo', interval: '1d'  };
    case '3M':  return { range: '3mo', interval: '1d'  };
    case '1A':  return { range: '1y',  interval: '1d'  };
    default:    return { range: '1mo', interval: '1d'  };
  }
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get('symbols') ?? '';
  const period       = req.nextUrl.searchParams.get('period')  ?? '1M';

  const symbols = symbolsParam
    .split(',')
    .map((s) => s.trim().toUpperCase().replace(/\.SA$/i, ''))
    .filter(Boolean);

  if (!symbols.length) return NextResponse.json([]);

  const { range, interval } = toRangeInterval(period);

  const series = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const bars = await fetchHistorical(symbol, range, interval);
        if (!bars.length || !bars[0].close) return { symbol, data: [] };

        const base = bars[0].close;
        const data = bars
          .filter((b) => b.close != null)
          .map((b) => ({
            date:  new Date(b.date * 1000).toISOString(),
            value: +(b.close / base * 100).toFixed(3),
          }));

        return { symbol, data };
      } catch {
        return { symbol, data: [] };
      }
    })
  );

  return NextResponse.json(series);
}
