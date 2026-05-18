import { NextRequest, NextResponse } from 'next/server';
import { fetchQuote } from '@/lib/brapi';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol.toUpperCase().replace(/\.SA$/i, '');
  try {
    const q = await fetchQuote(symbol);
    return NextResponse.json({
      symbol:                     q.symbol,
      shortName:                  q.shortName,
      currency:                   q.currency ?? 'BRL',
      regularMarketPrice:         q.regularMarketPrice,
      regularMarketChange:        q.regularMarketChange,
      regularMarketChangePercent: q.regularMarketChangePercent,
      regularMarketOpen:          q.regularMarketOpen,
      regularMarketDayHigh:       q.regularMarketDayHigh,
      regularMarketDayLow:        q.regularMarketDayLow,
      regularMarketVolume:        q.regularMarketVolume,
      regularMarketPreviousClose: q.regularMarketPreviousClose,
      fiftyTwoWeekHigh:           q.fiftyTwoWeekHigh,
      fiftyTwoWeekLow:            q.fiftyTwoWeekLow,
      averageVolume:              q.averageDailyVolume3Month,
      marketCap:                  q.marketCap,
      trailingPE:                 q.priceEarnings,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
