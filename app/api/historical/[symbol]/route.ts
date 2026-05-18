import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BRAPI_RANGE: Record<string, string> = {
  '1D': '1d', '1W': '5d', '1M': '1mo', '3M': '3mo', '1A': '1y', 'MAX': 'max',
};
const BRAPI_INTERVAL: Record<string, string> = {
  '1D': '5m', '1W': '15m', '1M': '1d', '3M': '1d', '1A': '1wk', 'MAX': '1mo',
};

// Common aliases → Brapi-compatible symbols
const SYMBOL_ALIAS: Record<string, string> = {
  'IBOV': '^BVSP',
  'BVSP': '^BVSP',
  'IBOVESPA': '^BVSP',
};

export async function GET(
  req: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const period   = req.nextUrl.searchParams.get('period') ?? '1M';
  const raw      = params.symbol.toUpperCase().replace(/\.SA$/i, '');
  const symbol   = SYMBOL_ALIAS[raw] ?? raw;
  const range    = BRAPI_RANGE[period]    ?? '1mo';
  const interval = BRAPI_INTERVAL[period] ?? '1d';
  const tok      = process.env.BRAPI_TOKEN ?? '';

  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 10_000);
    const r = await fetch(
      `https://brapi.dev/api/quote/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&token=${tok}`,
      { cache: 'no-store', signal: ctrl.signal }
    );

    if (!r.ok) {
      return NextResponse.json(
        { error: `Brapi error: ${r.status}` },
        { status: 502 }
      );
    }

    const data   = await r.json();
    const result = data.results?.[0];

    if (!result) {
      return NextResponse.json(
        { error: 'Símbolo não encontrado' },
        { status: 404 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hist: any[] = result.historicalDataPrice ?? [];

    const bars = hist
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((q: any) => q.close != null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((q: any) => ({
        date:   new Date(q.date * 1000).toISOString(),
        open:   q.open   ?? q.close,
        high:   q.high   ?? q.close,
        low:    q.low    ?? q.close,
        close:  q.close,
        volume: q.volume ?? 0,
      }));

    if (!bars.length) {
      return NextResponse.json(
        { error: 'Sem dados históricos disponíveis' },
        { status: 404 }
      );
    }

    return NextResponse.json(bars);
  } catch (err) {
    console.error(`[historical] failed for ${symbol}:`, err);
    return NextResponse.json(
      { error: `Dados não disponíveis: ${String(err).slice(0, 120)}` },
      { status: 502 }
    );
  }
}
