import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface DiContract {
  symbol:      string;
  maturity:    string;
  rate:        number | null;
  varBps:      number | null;
  isReference: boolean;
}

// DI1 contracts — match LTN/NTN-F maturities at Jan 1 of each year
const TARGET_YEARS = [2027, 2028, 2029, 2030, 2031, 2032];

// Fetch ANBIMA daily flat file: ms{YYMMDD}.txt
// Returns Map<"YYYYMMDD" maturity, TxIndicativas rate>
async function fetchAnbimaRates(isoDate: string): Promise<Map<string, number>> {
  const [yyyy, mm, dd] = isoDate.split('-');
  const url = `https://www.anbima.com.br/informacoes/merc-sec/arqs/ms${yyyy.slice(2)}${mm}${dd}.txt`;
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8_000);
    const r = await fetch(url, {
      cache:   'no-store',
      signal:  ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!r.ok) return new Map();
    const text = await r.text();
    const map  = new Map<string, number>();
    for (const line of text.split('\n')) {
      const f = line.split('@');
      if (f.length < 8) continue;
      const titulo = f[0].trim();
      // LTN (zero-coupon) and NTN-F (semi-annual coupon) are prefixed — closest to DI curve
      if (titulo !== 'LTN' && titulo !== 'NTN-F') continue;
      const maturity = f[4].trim();                          // DataVencimento "20280101"
      const rate     = parseFloat(f[7].trim().replace(',', '.')); // TxIndicativas
      if (maturity.length === 8 && isFinite(rate)) map.set(maturity, rate);
    }
    return map;
  } catch { return new Map(); }
}

// Try up to 5 trading days back until a valid file is found
async function findRecentAnbima(beforeIso: string | null, maxBack = 5): Promise<{ date: string; rates: Map<string, number> } | null> {
  const ref = beforeIso ? new Date(beforeIso) : new Date();
  for (let i = 1; i <= maxBack; i++) {
    const d   = new Date(ref);
    d.setUTCDate(d.getUTCDate() - i);
    const iso   = d.toISOString().slice(0, 10);
    const rates = await fetchAnbimaRates(iso);
    if (rates.size > 0) return { date: iso, rates };
  }
  return null;
}

export async function GET() {
  // Fetch D-1 then D-2 sequentially (need to know D-1 date before searching D-2)
  const d1 = await findRecentAnbima(null);
  if (!d1) return NextResponse.json([]);

  const d2 = await findRecentAnbima(d1.date);

  const contracts: DiContract[] = TARGET_YEARS.map((year, idx) => {
    const key    = `${year}0101`;
    const rateD1 = d1.rates.get(key) ?? null;
    const rateD2 = d2?.rates.get(key) ?? null;
    const varBps = rateD1 != null && rateD2 != null
      ? Math.round((rateD1 - rateD2) * 100)
      : null;
    return {
      symbol:      `DI1F${String(year).slice(2)}`,
      maturity:    `Jan/${String(year).slice(2)}`,
      rate:        rateD1 != null ? +rateD1.toFixed(2) : null,
      varBps,
      isReference: idx === 0,
    };
  });

  return NextResponse.json(contracts.filter(c => c.rate != null));
}
