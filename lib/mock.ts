export function withTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

// ── Quote mock data ────────────────────────────────────────────────────────────

export const MOCK_QUOTES: Record<string, {
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  shortName: string;
  marketCap?: number;
  trailingPE?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  regularMarketVolume?: number;
  averageVolume?: number;
}> = {
  'PETR4.SA': {
    shortName: 'PETROBRAS PN',
    regularMarketPrice: 38.92,
    regularMarketChange: 0.55,
    regularMarketChangePercent: 1.43,
    marketCap: 507_000_000_000,
    trailingPE: 5.2,
    fiftyTwoWeekHigh: 43.18,
    fiftyTwoWeekLow: 30.74,
    regularMarketVolume: 45_200_000,
    averageVolume: 38_000_000,
  },
  'VALE3.SA': {
    shortName: 'VALE ON',
    regularMarketPrice: 67.10,
    regularMarketChange: -0.55,
    regularMarketChangePercent: -0.82,
    marketCap: 295_000_000_000,
    trailingPE: 7.1,
    fiftyTwoWeekHigh: 78.42,
    fiftyTwoWeekLow: 58.30,
    regularMarketVolume: 28_700_000,
    averageVolume: 24_000_000,
  },
  'ITUB4.SA': {
    shortName: 'ITAUUNIBANCO PN',
    regularMarketPrice: 34.55,
    regularMarketChange: 0.18,
    regularMarketChangePercent: 0.52,
    marketCap: 338_000_000_000,
    trailingPE: 9.8,
    fiftyTwoWeekHigh: 37.20,
    fiftyTwoWeekLow: 27.15,
    regularMarketVolume: 32_100_000,
    averageVolume: 28_000_000,
  },
  'BBDC4.SA': {
    shortName: 'BRADESCO PN',
    regularMarketPrice: 14.80,
    regularMarketChange: 0.12,
    regularMarketChangePercent: 0.82,
    marketCap: 155_000_000_000,
    trailingPE: 8.4,
    fiftyTwoWeekHigh: 17.90,
    fiftyTwoWeekLow: 11.42,
    regularMarketVolume: 51_300_000,
    averageVolume: 44_000_000,
  },
  'B3SA3.SA': {
    shortName: 'B3 ON',
    regularMarketPrice: 11.45,
    regularMarketChange: -0.08,
    regularMarketChangePercent: -0.69,
    marketCap: 63_000_000_000,
    trailingPE: 14.3,
    fiftyTwoWeekHigh: 14.20,
    fiftyTwoWeekLow: 9.85,
    regularMarketVolume: 18_400_000,
    averageVolume: 16_000_000,
  },
  '^BVSP': {
    shortName: 'IBOVESPA',
    regularMarketPrice: 128_450,
    regularMarketChange: 540,
    regularMarketChangePercent: 0.42,
  },
  'USDBRL=X': {
    shortName: 'USD/BRL',
    regularMarketPrice: 5.12,
    regularMarketChange: 0.02,
    regularMarketChangePercent: 0.39,
  },
  'EURBRL=X': {
    shortName: 'EUR/BRL',
    regularMarketPrice: 5.58,
    regularMarketChange: 0.01,
    regularMarketChangePercent: 0.18,
  },
  'BTC-USD': {
    shortName: 'BTC/USD',
    regularMarketPrice: 62_500,
    regularMarketChange: 1200,
    regularMarketChangePercent: 1.96,
  },
  'BTC-BRL': {
    shortName: 'BTC/BRL',
    regularMarketPrice: 320_000,
    regularMarketChange: 6200,
    regularMarketChangePercent: 1.97,
  },
};

export function getMockQuote(symbol: string) {
  const q = MOCK_QUOTES[symbol];
  if (q) return q;
  // Generic fallback for unknown symbols
  return {
    shortName: symbol,
    regularMarketPrice: 100,
    regularMarketChange: 0,
    regularMarketChangePercent: 0,
  };
}

// ── Ticker mock ───────────────────────────────────────────────────────────────

export const MOCK_TICKER = [
  { symbol: 'IBOV',    price: 128_450, change: 540,   changePercent: 0.42,  isRate: false },
  { symbol: 'USD/BRL', price: 5.12,   change: 0.02,  changePercent: 0.39,  isRate: false },
  { symbol: 'BTC',     price: 62_500, change: 1200,  changePercent: 1.96,  isRate: false },
  { symbol: 'PETR4',   price: 38.92,  change: 0.55,  changePercent: 1.43,  isRate: false },
  { symbol: 'VALE3',   price: 67.10,  change: -0.55, changePercent: -0.82, isRate: false },
  { symbol: 'SELIC',   price: 10.50,  change: 0,     changePercent: 0,     isRate: true  },
];

// ── Macro mock ────────────────────────────────────────────────────────────────

export const MOCK_MACRO = {
  exchange: [
    { label: 'USD/BRL', price: 5.12,     change: 0.02,  changePct: 0.39 },
    { label: 'EUR/BRL', price: 5.58,     change: 0.01,  changePct: 0.18 },
    { label: 'BTC/BRL', price: 320_000,  change: 6200,  changePct: 1.97 },
  ],
  rates: {
    selic:   10.50,
    cdi:     10.40,
    ipca12m: 4.62,
  },
  updatedAt: new Date().toISOString(),
};

// ── News mock ─────────────────────────────────────────────────────────────────

export function getMockNews(symbol: string) {
  const sym = symbol.replace('.SA', '').toUpperCase();
  return [
    {
      title: `${sym}: Resultado do 1T25 supera expectativas do mercado`,
      link: '#',
      providerPublishTime: Math.floor(Date.now() / 1000) - 3600,
      publisher: 'Valor Econômico',
      type: 'STORY',
    },
    {
      title: `Análise: Perspectivas para ${sym} após divulgação de balanço`,
      link: '#',
      providerPublishTime: Math.floor(Date.now() / 1000) - 7200,
      publisher: 'InfoMoney',
      type: 'STORY',
    },
    {
      title: `${sym} anuncia programa de recompra de ações no valor de R$ 2 bilhões`,
      link: '#',
      providerPublishTime: Math.floor(Date.now() / 1000) - 14400,
      publisher: 'Bloomberg Línea',
      type: 'STORY',
    },
    {
      title: `Ibovespa fecha em alta puxado por ${sym} e commodities`,
      link: '#',
      providerPublishTime: Math.floor(Date.now() / 1000) - 28800,
      publisher: 'Estadão',
      type: 'STORY',
    },
    {
      title: `BTG eleva recomendação de ${sym} para compra com preço-alvo de R$45`,
      link: '#',
      providerPublishTime: Math.floor(Date.now() / 1000) - 43200,
      publisher: 'BTG Pactual Research',
      type: 'STORY',
    },
    {
      title: `Setor ressente tensões geopolíticas; ${sym} recua no pré-mercado`,
      link: '#',
      providerPublishTime: Math.floor(Date.now() / 1000) - 86400,
      publisher: 'Reuters Brasil',
      type: 'STORY',
    },
  ];
}

// ── Historical / Chart mock ───────────────────────────────────────────────────

function seed(sym: string): number {
  return sym.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 100;
}

export function getMockHistorical(symbol: string, days = 30) {
  const base = getMockQuote(symbol).regularMarketPrice;
  const s = seed(symbol);
  const bars = [];
  const now = Date.now();
  for (let i = days; i >= 0; i--) {
    const t = new Date(now - i * 86_400_000);
    // skip weekends
    if (t.getDay() === 0 || t.getDay() === 6) continue;
    const drift = ((s + i) % 7 - 3) * 0.003;
    const noise = ((s * i) % 11 - 5) * 0.004;
    const close = +(base * (1 + drift + noise)).toFixed(2);
    const open  = +(close * (1 + ((i * s) % 5 - 2) * 0.002)).toFixed(2);
    const high  = +(Math.max(open, close) * (1 + 0.005)).toFixed(2);
    const low   = +(Math.min(open, close) * (1 - 0.005)).toFixed(2);
    bars.push({ date: t.toISOString(), open, high, low, close, volume: 20_000_000 + (s * i * 100000) % 30_000_000 });
  }
  return bars;
}

// ── YTD mock ──────────────────────────────────────────────────────────────────

export function getMockYTD(symbol: string) {
  const q = getMockQuote(symbol);
  const currentPrice = q.regularMarketPrice;
  const startPrice = +(currentPrice * 0.88).toFixed(2);
  const ytdPct = +((currentPrice - startPrice) / startPrice * 100).toFixed(2);
  const year = new Date().getFullYear();
  return {
    symbol,
    year,
    startDate:    `${year}-01-02T00:00:00.000Z`,
    endDate:      new Date().toISOString(),
    startPrice,
    currentPrice,
    ytdPct,
    absChange:    +(currentPrice - startPrice).toFixed(2),
    tradingDays:  92,
  };
}

// ── Fundamentals mock ─────────────────────────────────────────────────────────

export function getMockFundamentals(symbol: string) {
  const q = getMockQuote(symbol);
  return {
    summaryDetail: {
      trailingPE:           q.trailingPE ?? 10,
      forwardPE:            (q.trailingPE ?? 10) * 0.9,
      dividendYield:        0.068,
      payoutRatio:          0.42,
      fiftyTwoWeekHigh:     q.fiftyTwoWeekHigh ?? q.regularMarketPrice * 1.15,
      fiftyTwoWeekLow:      q.fiftyTwoWeekLow  ?? q.regularMarketPrice * 0.85,
      averageVolume:        q.averageVolume     ?? 20_000_000,
      regularMarketVolume:  q.regularMarketVolume ?? 25_000_000,
      marketCap:            q.marketCap         ?? 50_000_000_000,
      beta:                 1.15,
    },
    defaultKeyStatistics: {
      enterpriseValue:      (q.marketCap ?? 50_000_000_000) * 1.2,
      priceToBook:          2.1,
      returnOnEquity:       0.18,
      earningsQuarterlyGrowth: 0.12,
      trailingEps:          q.regularMarketPrice / (q.trailingPE ?? 10),
    },
    financialData: {
      totalRevenue:         (q.marketCap ?? 50_000_000_000) * 0.3,
      grossProfits:         (q.marketCap ?? 50_000_000_000) * 0.12,
      freeCashflow:         (q.marketCap ?? 50_000_000_000) * 0.08,
      returnOnAssets:       0.09,
      debtToEquity:         85,
      currentRatio:         1.4,
      revenuePerShare:      q.regularMarketPrice * 3.2,
      revenueGrowth:        0.08,
      grossMargins:         0.38,
      operatingMargins:     0.22,
    },
    assetProfile: {
      longBusinessSummary: `${q.shortName} é uma empresa listada na B3 (Bolsa de Valores do Brasil), atuando em seu setor com posição de destaque no mercado brasileiro. A companhia apresenta sólidos fundamentos e consistente geração de valor para seus acionistas.`,
      sector:   'Financeiro / Energia / Mineração',
      industry: 'Brasil',
      country:  'Brazil',
    },
  };
}

// ── Search mock ───────────────────────────────────────────────────────────────

export function getMockSearch(query: string) {
  const q = query.toUpperCase();
  const all = [
    { symbol: 'PETR4.SA', shortname: 'PETROBRAS PN',      quoteType: 'EQUITY', exchange: 'SAO' },
    { symbol: 'PETR3.SA', shortname: 'PETROBRAS ON',      quoteType: 'EQUITY', exchange: 'SAO' },
    { symbol: 'VALE3.SA', shortname: 'VALE ON',            quoteType: 'EQUITY', exchange: 'SAO' },
    { symbol: 'ITUB4.SA', shortname: 'ITAUUNIBANCO PN',   quoteType: 'EQUITY', exchange: 'SAO' },
    { symbol: 'BBDC4.SA', shortname: 'BRADESCO PN',       quoteType: 'EQUITY', exchange: 'SAO' },
    { symbol: 'B3SA3.SA', shortname: 'B3 ON',             quoteType: 'EQUITY', exchange: 'SAO' },
    { symbol: 'WEGE3.SA', shortname: 'WEG ON',            quoteType: 'EQUITY', exchange: 'SAO' },
    { symbol: 'ABEV3.SA', shortname: 'AMBEV ON',          quoteType: 'EQUITY', exchange: 'SAO' },
    { symbol: 'MGLU3.SA', shortname: 'MAGALU ON',         quoteType: 'EQUITY', exchange: 'SAO' },
    { symbol: 'RENT3.SA', shortname: 'LOCALIZA ON',       quoteType: 'EQUITY', exchange: 'SAO' },
    { symbol: 'PRIO3.SA', shortname: 'PRIO ON',           quoteType: 'EQUITY', exchange: 'SAO' },
    { symbol: 'LREN3.SA', shortname: 'LOJAS RENNER ON',   quoteType: 'EQUITY', exchange: 'SAO' },
  ];
  return all.filter(
    (r) => r.symbol.includes(q) || r.shortname.toUpperCase().includes(q)
  ).slice(0, 10);
}
