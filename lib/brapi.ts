const BASE = 'https://brapi.dev/api';

function tok() {
  return process.env.BRAPI_TOKEN ?? '';
}

async function get(url: string) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10_000);
  try {
    const r = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(`Brapi ${r.status} — ${url}`);
    return r.json();
  } finally {
    clearTimeout(id);
  }
}

// ── Quote ─────────────────────────────────────────────────────────────────────

export interface BrapiQuote {
  symbol:                     string;
  shortName?:                 string;
  longName?:                  string;
  currency?:                  string;
  regularMarketPrice:         number;
  regularMarketChange:        number;
  regularMarketChangePercent: number;
  regularMarketOpen?:         number;
  regularMarketDayHigh?:      number;
  regularMarketDayLow?:       number;
  regularMarketVolume?:       number;
  regularMarketPreviousClose?:number;
  fiftyTwoWeekHigh?:          number;
  fiftyTwoWeekLow?:           number;
  averageDailyVolume3Month?:  number;
  marketCap?:                 number;
  priceEarnings?:             number;
  earningsPerShare?:          number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]:              any;
}

export async function fetchQuotes(symbols: string[]): Promise<BrapiQuote[]> {
  const data = await get(`${BASE}/quote/${symbols.join(',')}?token=${tok()}`);
  return data.results ?? [];
}

export async function fetchQuote(symbol: string): Promise<BrapiQuote> {
  // Try bare ticker first, then .SA suffix (needed for some FIIs)
  for (const sym of [symbol, `${symbol}.SA`]) {
    try {
      const data = await get(`${BASE}/quote/${sym}?token=${tok()}`);
      const result = data.results?.[0];
      if (result?.regularMarketPrice != null) return result;
    } catch { /* try next */ }
  }
  throw new Error(`Brapi: sem dados para ${symbol}`);
}

export async function fetchQuoteWithModules(symbol: string, modules: string): Promise<BrapiQuote> {
  const data = await get(`${BASE}/quote/${symbol}?modules=${modules}&token=${tok()}`);
  const result = data.results?.[0];
  if (!result) throw new Error(`Brapi: sem dados para ${symbol}`);
  return result;
}

// ── Historical ────────────────────────────────────────────────────────────────

export interface BrapiBar {
  date:   number; // Unix timestamp em SEGUNDOS
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export async function fetchHistorical(
  symbol: string,
  range: string,
  interval: string
): Promise<BrapiBar[]> {
  const data = await get(
    `${BASE}/quote/${symbol}?range=${range}&interval=${interval}&token=${tok()}`
  );
  return data.results?.[0]?.historicalDataPrice ?? [];
}

// ── Currency ──────────────────────────────────────────────────────────────────

export interface BrapiCurrencyItem {
  fromCurrency: string;
  toCurrency:   string;
  name:         string;
  high?:        number;
  low?:         number;
  bidPrice:     number;
  askPrice?:    number;
  pctChange?:   number;
  change?:      number;
}

export async function fetchCurrency(pairs: string[]): Promise<BrapiCurrencyItem[]> {
  const data = await get(
    `${BASE}/v2/currency?currency=${pairs.join(',')}&token=${tok()}`
  );
  return data.currency ?? [];
}

// ── Available / Search ────────────────────────────────────────────────────────

export async function searchAvailable(query: string): Promise<string[]> {
  const data = await get(
    `${BASE}/available?search=${encodeURIComponent(query)}&token=${tok()}`
  );
  return data.stocks ?? [];
}
