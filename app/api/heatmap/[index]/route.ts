import { NextRequest, NextResponse } from 'next/server';
import { getB3Composition } from '@/lib/b3-composition';

export const dynamic = 'force-dynamic';

// Brapi segment for each index
const SEGMENT: Record<string, string> = {
  IBOV: 'ibovespa',
  IDIV: 'ibovespa',
  SMLL: 'ibovespa',
  IFIX: 'fundos-imobiliarios',
};

export interface HeatmapStock {
  symbol: string;
  weight: number;
  varDay: number | null;
}

function abortAfter(ms: number) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl;
}

async function getPriceMap(idx: string, tok: string): Promise<Map<string, number | null>> {
  const seg = SEGMENT[idx] ?? 'ibovespa';
  const map = new Map<string, number | null>();
  try {
    const r = await fetch(
      `https://brapi.dev/api/quote/list?segment=${seg}&token=${tok}`,
      { cache: 'no-store', signal: abortAfter(10_000).signal }
    );
    if (!r.ok) return map;
    const data = await r.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of (data.stocks ?? []) as any[]) {
      map.set(String(s.stock), s.change ?? null);
    }
  } catch { /* return empty — heatmap renders neutral cells */ }
  return map;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { index: string } }
) {
  const idx = params.index.toUpperCase();
  const tok = process.env.BRAPI_TOKEN ?? '';

  const [composition, priceMap] = await Promise.all([
    getB3Composition(idx),
    getPriceMap(idx, tok),
  ]);

  if (!composition.length) {
    return NextResponse.json({ error: 'Composition unavailable' }, { status: 503 });
  }

  const stocks: HeatmapStock[] = composition.map(c => ({
    symbol: c.code,
    weight: c.part,
    varDay: priceMap.get(c.code) ?? null,
  }));

  return NextResponse.json(stocks);
}
