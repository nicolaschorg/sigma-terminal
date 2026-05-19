import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Policy rates fetched live — no hardcoded fallbacks

interface ExchangeRow {
  label:     string;
  price:     number | null;
  change:    number | null;
  changePct: number | null;
}

export interface YahooSnapshot {
  price:     number | null;
  change:    number | null;
  changePct: number | null;
}

const YAHOO_FX = [
  { symbol: 'BRL=X',    label: 'USD/BRL' },
  { symbol: 'EURBRL=X', label: 'EUR/BRL' },
  { symbol: 'GBPBRL=X', label: 'GBP/BRL' },
];

const EU_INDICES = [
  { symbol: '^GDAXI', label: 'DAX'      },
  { symbol: '^FCHI',  label: 'CAC 40'   },
  { symbol: '^FTSE',  label: 'FTSE 100' },
  { symbol: '^IBEX',  label: 'IBEX 35'  },
  { symbol: '^AEX',   label: 'AEX'      },
];

const REIT_INDICES = [
  { symbol: 'VNQ',    label: 'VNQ'    },
  { symbol: 'IPRP.L', label: 'IPRP.L' },
];

function abortAfter(ms: number) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl;
}

// NY Fed public API — effective federal funds rate (last published day)
async function fetchEFFR(): Promise<number | null> {
  try {
    const r = await fetch(
      'https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json',
      { cache: 'no-store', signal: abortAfter(6_000).signal,
        headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!r.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await r.json();
    const rate = data?.refRates?.refRate?.[0]?.percentRate;
    return rate != null ? parseFloat(String(rate)) : null;
  } catch {
    return null;
  }
}

// ECB SDMX-JSON API — deposit facility rate (latest observation)
async function fetchECBRate(): Promise<number | null> {
  try {
    const r = await fetch(
      'https://data.ecb.europa.eu/api/data/FM/B.U2.EUR.4F.KR.DFR.LEV?format=jsondata',
      {
        cache: 'no-store', signal: abortAfter(8_000).signal,
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      }
    );
    if (!r.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await r.json();
    const series = data?.dataSets?.[0]?.series;
    if (!series) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obs = (Object.values(series)[0] as any)?.observations;
    if (!obs) return null;
    const lastKey = String(Math.max(...Object.keys(obs).map(Number)));
    const val = obs[lastKey]?.[0];
    return val != null && isFinite(Number(val)) ? Number(val) : null;
  } catch {
    return null;
  }
}

async function fetchYahooSnapshot(symbol: string): Promise<YahooSnapshot> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2d&interval=1d`,
      {
        cache: 'no-store', signal: abortAfter(6_000).signal,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      }
    );
    if (!r.ok) return { price: null, change: null, changePct: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await r.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return { price: null, change: null, changePct: null };
    return {
      price:     meta.regularMarketPrice     as number,
      change:    meta.regularMarketChange     as number ?? null,
      changePct: meta.regularMarketChangePercent as number ?? null,
    };
  } catch {
    return { price: null, change: null, changePct: null };
  }
}

async function yahooChartFX(symbol: string): Promise<{ price: number | null; change: number | null; changePct: number | null }> {
  try {
    const r = await fetch(
      // range=1d: chartPreviousClose is the actual previous session close (not 5-6 days back)
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=60m`,
      {
        cache: 'no-store', signal: abortAfter(6_000).signal,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      }
    );
    if (!r.ok) return { price: null, change: null, changePct: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await r.json();
    const result0 = data?.chart?.result?.[0];
    const meta = result0?.meta;
    if (!meta?.regularMarketPrice) return { price: null, change: null, changePct: null };

    const price         = meta.regularMarketPrice as number;
    const previousClose = (meta.chartPreviousClose ?? meta.previousClose) as number | undefined;
    if (!previousClose) return { price, change: null, changePct: null };

    const change    = +(price - previousClose).toFixed(4);
    const changePct = +((price / previousClose - 1) * 100).toFixed(2);

    return { price, change, changePct };
  } catch {
    return { price: null, change: null, changePct: null };
  }
}

async function bcb(series: number): Promise<number | null> {
  try {
    const r = await fetch(
      `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${series}/dados/ultimos/1?formato=json`,
      { cache: 'no-store', signal: abortAfter(6_000).signal }
    );
    if (!r.ok) return null;
    const d: { valor: string }[] = await r.json();
    return d[0]?.valor ? parseFloat(d[0].valor.replace(',', '.')) : null;
  } catch {
    return null;
  }
}

// BCB PTAX for USD/BRL — tries last 4 days to handle weekends/holidays
function ptaxDateStr(d: Date): string {
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

async function fetchPtaxPreviousClose(): Promise<number | null> {
  for (let daysBack = 1; daysBack <= 4; daysBack++) {
    try {
      const d = new Date();
      d.setDate(d.getDate() - daysBack);
      const r = await fetch(
        `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/` +
        `CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${ptaxDateStr(d)}'&$format=json`,
        { cache: 'no-store', signal: abortAfter(6_000).signal }
      );
      if (!r.ok) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await r.json();
      const val = json?.value?.[0]?.cotacaoVenda;
      if (val != null) return val as number;
    } catch { /* try previous day */ }
  }
  return null;
}

async function fetchExchangeRates(): Promise<ExchangeRow[]> {
  // Fetch PTAX and all Yahoo FX in parallel
  const [ptaxResult, ...fxSettled] = await Promise.allSettled([
    fetchPtaxPreviousClose(),
    ...YAHOO_FX.map(({ symbol }) => yahooChartFX(symbol)),
  ]);

  const ptax = ptaxResult.status === 'fulfilled' ? ptaxResult.value : null;

  return YAHOO_FX
    .map(({ symbol, label }, i) => {
      const r = fxSettled[i];
      if (r.status !== 'fulfilled' || r.value.price == null) return null;
      let { price, change, changePct } = r.value;
      // Override USD/BRL change with PTAX when available (more accurate than Yahoo close)
      if (symbol === 'BRL=X' && ptax != null) {
        change    = +(price - ptax).toFixed(4);
        changePct = +((price / ptax - 1) * 100).toFixed(2);
      }
      return { label, price, change, changePct } as ExchangeRow;
    })
    .filter(Boolean) as ExchangeRow[];
}

export interface TdBond {
  title:        string;
  maturity:     string;
  rate:         number;
  price:        number;
  isReference?: boolean;
}

// ANBIMA secondary-market indicative rates — public file, no auth required
// Format: Titulo@DataRef@CodigoSELIC@DataEmissao@DataVencimento@TxCompra@TxVenda@TxIndicativa@PU@...
async function fetchANBIMANtnb(): Promise<TdBond[] | null> {
  try {
    const r = await fetch(
      'https://www.anbima.com.br/informacoes/merc-sec/arqs/Msec_txt.txt',
      {
        cache: 'no-store', signal: abortAfter(10_000).signal,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }
    );
    if (!r.ok) return null;
    const text = await r.text();
    const bonds: TdBond[] = text
      .split('\n')
      .filter(l => l.startsWith('NTN-B@'))
      .map(line => {
        const c        = line.split('@');
        const vencRaw  = (c[4] ?? '').trim();
        const maturity = vencRaw.length === 8
          ? `${vencRaw.slice(0, 4)}-${vencRaw.slice(4, 6)}-${vencRaw.slice(6, 8)}`
          : '—';
        const rate  = parseFloat((c[7] ?? '').replace(',', '.'));
        const price = parseFloat((c[8] ?? '').replace(',', '.'));
        return {
          title:    'NTN-B',
          maturity,
          rate:     isNaN(rate)  ? 0 : +rate.toFixed(4),
          price:    isNaN(price) ? 0 : +price.toFixed(6),
        } as TdBond;
      })
      .filter(b => b.maturity !== '—')
      .sort((a, b) => a.maturity.localeCompare(b.maturity));
    return bonds.length ? bonds : null;
  } catch {
    return null;
  }
}

// BCB Focus annual expectations → Map<year, median>
async function fetchFocusAnnual(indicator: string): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  try {
    const r = await fetch(
      `https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais` +
      `?$filter=Indicador%20eq%20'${encodeURIComponent(indicator)}'%20and%20baseCalculo%20eq%200` +
      `&$orderby=Data%20desc&$top=40&$format=json&$select=Data,DataReferencia,Mediana`,
      { cache: 'no-store', signal: abortAfter(8_000).signal }
    );
    if (!r.ok) return map;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await r.json();
    const latest = new Map<number, { data: string; mediana: number }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of (json.value ?? []) as any[]) {
      const year    = Number(item.DataReferencia);
      const mediana = parseFloat(String(item.Mediana ?? '').replace(',', '.'));
      if (isNaN(year) || isNaN(mediana)) continue;
      const prev = latest.get(year);
      if (!prev || String(item.Data) > prev.data) {
        latest.set(year, { data: String(item.Data), mediana });
      }
    }
    latest.forEach(({ mediana }, year) => map.set(year, mediana));
  } catch { /* return empty */ }
  return map;
}

// Standard IPCA+ maturities to synthesize when TD APIs are unavailable
const NTNB_MATURITIES: { title: string; maturity: string }[] = [
  { title: 'Tesouro IPCA+ 2026',          maturity: '2026-08-15' },
  { title: 'Tesouro IPCA+ 2029',          maturity: '2029-05-15' },
  { title: 'Tesouro IPCA+ 2035',          maturity: '2035-05-15' },
  { title: 'Tesouro IPCA+ c/ Juros 2032', maturity: '2032-08-15' },
  { title: 'Tesouro IPCA+ c/ Juros 2040', maturity: '2040-08-15' },
  { title: 'Tesouro IPCA+ c/ Juros 2055', maturity: '2055-05-15' },
];

// Fisher equation: real = ((1 + nominal/100) / (1 + inflation/100) - 1) * 100
function fisherRealYield(nominalPct: number, inflationPct: number): number {
  return +((((1 + nominalPct / 100) / (1 + inflationPct / 100)) - 1) * 100).toFixed(2);
}

function derivedNtnbBonds(
  selicMap: Map<number, number>,
  ipcaMap:  Map<number, number>,
): TdBond[] {
  const maxSelicYear = selicMap.size ? Math.max(...Array.from(selicMap.keys())) : 0;
  const maxIpcaYear  = ipcaMap.size  ? Math.max(...Array.from(ipcaMap.keys()))  : 0;
  if (!maxSelicYear || !maxIpcaYear) return [];

  return NTNB_MATURITIES.map(({ title, maturity }) => {
    const year  = parseInt(maturity.slice(0, 4));
    // Use the closest available Focus year (cap at max available)
    const sy    = Math.min(year - 1, maxSelicYear);
    const iy    = Math.min(year - 1, maxIpcaYear);
    const selic = selicMap.get(sy) ?? selicMap.get(maxSelicYear) ?? 0;
    const ipca  = ipcaMap.get(iy)  ?? ipcaMap.get(maxIpcaYear)  ?? 0;
    return {
      title,
      maturity,
      rate:        fisherRealYield(selic, ipca),
      price:       0,
      isReference: true,
    };
  }).sort((a, b) => a.maturity.localeCompare(b.maturity));
}

export async function GET() {
  const [
    selicMeta, cdiRate, ipca12m,
    exchange, anbimaBonds, focusSelic, focusIpca,
    effr, ecbRate,
    tbill3m, tbond10y, bund2y, bund10y,
    ...marketSnaps
  ] = await Promise.all([
    bcb(432),
    bcb(4389),
    bcb(13522),
    fetchExchangeRates(),
    fetchANBIMANtnb(),
    fetchFocusAnnual('Selic'),
    fetchFocusAnnual('IPCA'),
    fetchEFFR(),
    fetchECBRate(),
    fetchYahooSnapshot('^IRX'),
    fetchYahooSnapshot('^TNX'),
    fetchYahooSnapshot('^TMBMKDE-02Y'),
    fetchYahooSnapshot('^TMBMKDE-10Y'),
    ...REIT_INDICES.map(({ symbol }) => fetchYahooSnapshot(symbol)),
    ...EU_INDICES.map(({ symbol })   => fetchYahooSnapshot(symbol)),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snapSlice = marketSnaps as any[];
  const reits = REIT_INDICES.map(({ label }, i) => ({ label, ...snapSlice[i] }));
  const euIndices = EU_INDICES.map(({ label }, i) => ({ label, ...snapSlice[REIT_INDICES.length + i] }));

  // ANBIMA indicative rates → Focus-derived Fisher fallback
  const tesouroDireto: TdBond[] =
    anbimaBonds ?? derivedNtnbBonds(focusSelic, focusIpca);

  return NextResponse.json({
    exchange,
    rates: {
      selic:   selicMeta ?? null,
      cdi:     cdiRate   ?? null,
      ipca12m: ipca12m   ?? null,
    },
    tesouroDireto,
    jurosUS: {
      fedFunds: effr,
      tbill3m,
      tbond10y,
    },
    jurosEU: {
      ecb: ecbRate,
      bund2y,
      bund10y,
    },
    reits,
    euIndices,
    updatedAt: new Date().toISOString(),
  });
}
