import { NextRequest, NextResponse } from 'next/server';
import { getB3Composition } from '@/lib/b3-composition';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { index: string } }
) {
  const idx = params.index.toUpperCase();
  const data = await getB3Composition(idx);
  if (!data.length) {
    return NextResponse.json({ error: `Composition unavailable for ${idx}` }, { status: 503 });
  }
  return NextResponse.json(data);
}
