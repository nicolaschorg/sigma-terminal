import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol.toUpperCase().replace(/\.SA$/i, '');
  const tok    = process.env.BRAPI_TOKEN ?? '';

  try {
    const r = await fetch(
      `https://brapi.dev/api/quote/${symbol}?newsCount=10&token=${tok}`,
      { cache: 'no-store' }
    );
    if (!r.ok) throw new Error(`Brapi ${r.status}`);
    const data = await r.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const news: any[] = data.results?.[0]?.news ?? [];

    if (!news.length) return NextResponse.json([]);

    const mapped = news.map((n) => ({
      uuid:                n.id ?? n.uuid,
      title:               n.title,
      link:                n.url ?? n.link ?? '#',
      publisher:           n.author ?? n.source ?? n.publisher,
      providerPublishTime: n.createdAt
        ? Math.floor(new Date(n.createdAt).getTime() / 1000)
        : undefined,
    }));

    return NextResponse.json(mapped);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
