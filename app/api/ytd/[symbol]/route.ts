import { NextRequest, NextResponse } from 'next/server';
import { fetchHistorical } from '@/lib/brapi';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol.toUpperCase().replace(/\.SA$/i, '');

  try {
    const bars = await fetchHistorical(symbol, 'ytd', '1d');

    if (!bars || bars.length < 2) {
      return NextResponse.json({ error: 'Dados insuficientes para calcular YTD' }, { status: 404 });
    }

    const startBar     = bars[0];
    const endBar       = bars[bars.length - 1];
    const startPrice   = startBar.close;
    const currentPrice = endBar.close;
    const ytdPct       = ((currentPrice - startPrice) / startPrice) * 100;

    return NextResponse.json({
      symbol:      params.symbol,
      year:        new Date().getFullYear(),
      startDate:   new Date(startBar.date * 1000).toISOString(),
      endDate:     new Date(endBar.date * 1000).toISOString(),
      startPrice,
      currentPrice,
      ytdPct,
      absChange:   currentPrice - startPrice,
      tradingDays: bars.length,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
