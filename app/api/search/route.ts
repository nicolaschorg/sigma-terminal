import { NextRequest, NextResponse } from 'next/server';
import { searchAvailable, fetchQuotes } from '@/lib/brapi';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!q) return NextResponse.json([]);

  try {
    const tickers = await searchAvailable(q);
    if (!tickers.length) return NextResponse.json([]);

    const top    = tickers.slice(0, 8);
    const quotes = await fetchQuotes(top);

    const results = quotes.map((r) => ({
      symbol:    r.symbol,
      shortname: r.shortName,
      longname:  r.longName,
      quoteType: 'EQUITY',
      exchange:  'SAO',
    }));

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
