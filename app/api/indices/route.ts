import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COMPONENTS: Record<string, string[]> = {
  ibov: ['PETR4','VALE3','ITUB4','BBDC4','ABEV3','WEGE3','RENT3','SUZB3','GGBR4','RADL3','EQTL3','TOTS3','HAPV3','SBSP3','EMBR3','LREN3','MGLU3','CSNA3','USIM5','CYRE3'],
  ifix: ['MXRF11','HGLG11','KNRI11','XPML11','BCFF11','BRCR11','HGRE11','PVBI11','IRDM11','BRCO11','RBRF11','VGIR11','JSRE11','TGAR11','BTLG11','VILG11','RBVA11','HGBS11','XPLG11','HSML11'],
  idiv: ['TAEE11','CMIG4','TRPL4','EGIE3','CPFE3','ENGI11','SBSP3','VIVT3','BBSE3','CPLE6','ENBR3','KLBN11','CSMG3','SAPR11','AURE3'],
  smll: ['CASH3','DESK3','PRIO3','RECV3','SMFT3','VAMO3','MOVI3','AIOS3','CVCB3','PETZ3','LWSA3','AESB3','TASA4','FRAS3','BMOB3'],
  // Nilus Offshore — international REITs grouped by sector/region
  offshore: [
    // Multifamily US
    'IRT','ELME','NXRT','CLPR','EQR','AVB','MAA',
    // Multifamily EU
    'GYC','GRI.L','VARN.SW','INPR.MC','IVST.L','LEG.DE','TAG.DE',
    // Retail US
    'CBL','SPG','O','NNN',
    // Retail EU
    'URW.AS','LI.PA','CARM.PA','VASTN.AS','WHL.AS','ECMPA.AS','DEQ.DE','HMSO.L','SELER.PA','MFI.DE',
    // Office US
    'DEI','JBGS','ESRT','CTO','BXP',
    // Office EU
    'ICAD.PA','GPE.L','LAND.L','BLND.L',
    // Hotel US
    'DRH','PK','RLJ','SHO','HST',
    // Hotel EU
    'PPH.L','MEL.MC',
    // Industrial EU
    'MONT.BR','VGP.BR','WDP.BR','SEGRO.L','ARGAN.PA',
    // Diversificado EU
    'COL.MC','BRI.MI','KLPI.HE',
    // Farmland US
    'FPI','LAND',
    // Industrial/Infra US
    'PLD','AMT',
  ],
};

// ── Server-side history cache ─────────────────────────────────────────────────
// Persists across requests within the same server instance.
// Each entry fetched once per HIST_TTL (4 h); errors retry after 2 min.

interface HistEntry {
  varWeek:  number | null;
  varMonth: number | null;
  varYTD:   number | null;
  ts:       number;
  ok:       boolean;
}

const histCache = new Map<string, HistEntry>();
const HIST_TTL   = 4 * 60 * 60 * 1_000;
const HIST_RETRY = 2 * 60 * 1_000;

function isCacheFresh(e: HistEntry) {
  return Date.now() - e.ts < (e.ok ? HIST_TTL : HIST_RETRY);
}

function abortAfter(ms: number) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl;
}

function toYahooSym(symbol: string): string {
  return /^[A-Z]{4,6}\d{1,2}$/.test(symbol) ? `${symbol}.SA` : symbol;
}

function calcPerf(prices: number[]) {
  const cur = prices[prices.length - 1];
  const pct = (from: number) => from > 0 ? ((cur - from) / from) * 100 : null;
  return {
    varWeek:  prices.length >= 6  ? pct(prices[prices.length - 6])  : null,
    varMonth: prices.length >= 22 ? pct(prices[prices.length - 22]) : null,
    varYTD:   pct(prices[0]),
  };
}

async function fetchHistEntry(symbol: string, tok: string): Promise<HistEntry> {
  // ── Try Brapi first ──────────────────────────────────────────────────────────
  try {
    const r = await fetch(
      `https://brapi.dev/api/quote/${symbol}?range=ytd&interval=1d&token=${tok}`,
      { cache: 'no-store', signal: abortAfter(8_000).signal }
    );
    if (r.ok) {
      const data = await r.json();
      const s    = data.results?.[0];
      if (s) {
        const hist: { close: number }[] = s.historicalDataPrice ?? [];
        const cur = s.regularMarketPrice as number | null;
        const prices = hist.map(h => h.close).filter(v => v != null && isFinite(v));
        if (prices.length >= 5 && cur) {
          const pct = (from: number) => from > 0 ? ((cur - from) / from) * 100 : null;
          return {
            varWeek:  prices.length >= 6  ? pct(prices[prices.length - 6])  : null,
            varMonth: prices.length >= 22 ? pct(prices[prices.length - 22]) : null,
            varYTD:   pct(prices[0]),
            ts: Date.now(), ok: true,
          };
        }
      }
    }
  } catch { /* fall through */ }

  // ── Yahoo Finance v8/chart fallback ──────────────────────────────────────────
  try {
    const ySym = toYahooSym(symbol);
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?range=ytd&interval=1d`,
      {
        cache: 'no-store',
        signal: abortAfter(10_000).signal,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      }
    );
    if (r.ok) {
      const data   = await r.json();
      const result = data?.chart?.result?.[0];
      if (result) {
        const raw: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
        const prices = raw.filter((v): v is number => v != null && isFinite(v));
        if (prices.length >= 5) {
          return { ...calcPerf(prices), ts: Date.now(), ok: true };
        }
      }
    }
  } catch { /* fall through */ }

  return { varWeek: null, varMonth: null, varYTD: null, ts: Date.now(), ok: false };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const tab         = (req.nextUrl.searchParams.get('tab') ?? 'ibov').toLowerCase();
  const symbolsParam = req.nextUrl.searchParams.get('symbols');
  const syms = symbolsParam
    ? symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 40)
    : (COMPONENTS[tab] ?? COMPONENTS.ibov);
  const tok  = process.env.BRAPI_TOKEN ?? '';

  // ── 1. Current prices ────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceMap: Record<string, { price: number | null; varDay: number | null }> = {};

  if (tab !== 'offshore') {
    // Brapi segment list — one call covers ~2000 B3 stocks
    try {
      const r = await fetch(
        `https://brapi.dev/api/quote/list?segment=ibovespa&token=${tok}`,
        { cache: 'no-store', signal: abortAfter(10_000).signal }
      );
      if (r.ok) {
        const data = await r.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const s of (data.stocks ?? []) as any[]) {
          priceMap[s.stock] = { price: s.close ?? null, varDay: s.change ?? null };
        }
      }
    } catch { /* show N/A for prices */ }
  } else {
    // Yahoo Finance — fetch each offshore ticker in parallel
    await Promise.allSettled(syms.map(async (sym) => {
      try {
        const r = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=2d&interval=1d`,
          {
            cache: 'no-store',
            signal: abortAfter(8_000).signal,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
          }
        );
        if (!r.ok) return;
        const data = await r.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta?.regularMarketPrice) return;
        priceMap[sym] = {
          price:  meta.regularMarketPrice as number,
          varDay: (meta.regularMarketChangePercent as number) ?? null,
        };
      } catch { /* skip */ }
    }));
  }

  // ── 2. Backfill history cache — all uncached symbols in parallel ────────────
  const uncached = syms.filter(s => {
    const e = histCache.get(s);
    return !e || !isCacheFresh(e);
  });

  await Promise.allSettled(
    uncached.map(async (sym) => {
      const entry = await fetchHistEntry(sym, tok);
      histCache.set(sym, entry);
    })
  );

  // ── 3. Build response ─────────────────────────────────────────────────────
  const stocks = syms.map(sym => {
    const p = priceMap[sym] ?? { price: null, varDay: null };
    const h = histCache.get(sym);
    return {
      symbol:   sym,
      price:    p.price,
      varDay:   p.varDay,
      varWeek:  h?.varWeek  ?? null,
      varMonth: h?.varMonth ?? null,
      varYTD:   h?.varYTD   ?? null,
    };
  });

  return NextResponse.json(stocks);
}
