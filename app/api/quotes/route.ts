import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface QuoteSnapshot {
  price:     number;
  change:    number;
  changePct: number;
}

function abortAfter(ms: number) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl;
}

function isB3(sym: string) {
  return /^[A-Z]{4,6}\d{1,2}$/.test(sym);
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get('symbols') ?? '';
  const symbols = symbolsParam
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 60);

  if (!symbols.length) return NextResponse.json({});

  const tok    = process.env.BRAPI_TOKEN ?? '';
  const result: Record<string, QuoteSnapshot> = {};

  const b3Syms    = symbols.filter(isB3);
  const nonB3Syms = symbols.filter(s => !isB3(s));

  // FIIs end in exactly 2 digits (XPML11, MXRF11…) and require .SA for Brapi
  const isFII = (s: string) => /\d{2}$/.test(s);

  // ── Brapi batch for B3 stocks ─────────────────────────────────────────────
  if (b3Syms.length) {
    try {
      const b3Req = b3Syms.map(s => isFII(s) ? `${s}.SA` : s);
      const r = await fetch(
        `https://brapi.dev/api/quote/${b3Req.join(',')}?token=${tok}`,
        { cache: 'no-store', signal: abortAfter(8_000).signal }
      );
      if (r.ok) {
        const data = await r.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const q of (data.results ?? []) as any[]) {
          if (q.regularMarketPrice == null) continue;
          // strip .SA so key always matches the bare ticker (e.g. XPML11)
          const sym = String(q.symbol ?? '').replace(/\.SA$/i, '');
          result[sym] = {
            price:     q.regularMarketPrice,
            change:    q.regularMarketChange        ?? 0,
            changePct: q.regularMarketChangePercent ?? 0,
          };
        }
      }
    } catch { /* fall through */ }
  }

  // ── Yahoo Finance v8/chart for non-B3 + missing B3 ────────────────────────
  const missing = [...nonB3Syms, ...b3Syms.filter(s => !result[s])];
  if (missing.length) {
    await Promise.allSettled(missing.map(async (sym) => {
      try {
        const ySym = isB3(sym) ? `${sym}.SA` : sym;
        const r = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?range=2d&interval=1d`,
          {
            cache: 'no-store',
            signal: abortAfter(6_000).signal,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
          }
        );
        if (!r.ok) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await r.json();
        const result0 = data?.chart?.result?.[0];
        const meta = result0?.meta;
        if (!meta?.regularMarketPrice) return;
        const price = meta.regularMarketPrice as number;

        // Prefer regularMarketChangePercent (pre-computed by Yahoo, always vs prev close).
        // Fallback: with range=2d, closes[0] is always yesterday's final close.
        // Never use chartPreviousClose — with range=2d it points 2 trading days back.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const closes: number[] = (result0?.indicators?.quote?.[0]?.close ?? []).filter(
          (v: unknown): v is number => typeof v === 'number' && isFinite(v)
        );
        let changePct: number;
        let change: number;
        if (meta.regularMarketChangePercent != null) {
          changePct = meta.regularMarketChangePercent as number;
          change    = meta.regularMarketChange     as number ?? (price * changePct / 100);
        } else if (closes.length >= 1) {
          const prevClose = closes[0]; // range=2d: closes[0] is always yesterday
          changePct = ((price - prevClose) / prevClose) * 100;
          change    = price - prevClose;
        } else {
          changePct = 0;
          change    = 0;
        }
        result[sym] = { price, change, changePct };
      } catch { /* ignore */ }
    }));
  }

  return NextResponse.json(result);
}
