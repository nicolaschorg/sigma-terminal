import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Brapi às vezes retorna { raw: number, fmt: string } em vez de number direto
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function n(x: any): number | undefined {
  if (x == null) return undefined;
  if (typeof x === 'number') return x;
  if (typeof x === 'object' && 'raw' in x) return x.raw;
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function s(x: any): string | undefined {
  if (x == null) return undefined;
  if (typeof x === 'string') return x;
  if (typeof x === 'object' && 'raw' in x) return String(x.raw);
  return undefined;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol.toUpperCase().replace(/\.SA$/i, '');
  const tok    = process.env.BRAPI_TOKEN ?? '';

  try {
    const url = `https://brapi.dev/api/quote/${symbol}?modules=summaryProfile,defaultKeyStatistics,financialData&token=${tok}`;
    const r   = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`Brapi ${r.status}`);

    const data   = await r.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = data.results?.[0];
    if (!result) throw new Error('Sem dados do Brapi');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sp:  any = result.summaryProfile       ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dks: any = result.defaultKeyStatistics ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd:  any = result.financialData        ?? {};

    return NextResponse.json({
      summaryDetail: {
        trailingPE:           n(result.priceEarnings)      ?? n(dks.trailingPE),
        forwardPE:            n(dks.forwardPE),
        marketCap:            n(result.marketCap),
        fiftyTwoWeekHigh:     n(result.fiftyTwoWeekHigh),
        fiftyTwoWeekLow:      n(result.fiftyTwoWeekLow),
        beta:                 n(dks.beta)                  ?? n(sp.beta),
        dividendYield:        n(sp.dividendYield)          ?? n(dks.dividendYield),
        dividendRate:         n(sp.dividendRate),
        fiftyDayAverage:      n(sp.fiftyDayAverage)        ?? n(result.fiftyDayAverage),
        twoHundredDayAverage: n(sp.twoHundredDayAverage)   ?? n(result.twoHundredDayAverage),
      },
      defaultKeyStatistics: {
        trailingEps:         n(dks.trailingEps),
        forwardEps:          n(dks.forwardEps),
        priceToBook:         n(dks.priceToBook),
        bookValue:           n(dks.bookValue),
        enterpriseToEbitda:  n(dks.enterpriseToEbitda),
        enterpriseToRevenue: n(dks.enterpriseToRevenue),
        grossMargins:        n(fd.grossMargins)    ?? n(dks.grossMargins),
        operatingMargins:    n(fd.operatingMargins)?? n(dks.operatingMargins),
        profitMargins:       n(fd.profitMargins)   ?? n(dks.profitMargins),
        returnOnAssets:      n(fd.returnOnAssets)  ?? n(dks.returnOnAssets),
        returnOnEquity:      n(fd.returnOnEquity)  ?? n(dks.returnOnEquity),
        debtToEquity:        n(fd.debtToEquity)    ?? n(dks.debtToEquity),
      },
      financialData: {
        totalRevenue:      n(fd.totalRevenue),
        totalCash:         n(fd.totalCash),
        totalDebt:         n(fd.totalDebt),
        freeCashflow:      n(fd.freeCashflow),
        operatingCashflow: n(fd.operatingCashflow),
        currentRatio:      n(fd.currentRatio),
        quickRatio:        n(fd.quickRatio),
        grossMargins:      n(fd.grossMargins),
        operatingMargins:  n(fd.operatingMargins),
        profitMargins:     n(fd.profitMargins),
        returnOnAssets:    n(fd.returnOnAssets),
        returnOnEquity:    n(fd.returnOnEquity),
        debtToEquity:      n(fd.debtToEquity),
        revenueGrowth:     n(fd.revenueGrowth),
        earningsGrowth:    n(fd.earningsGrowth),
      },
      assetProfile: {
        longBusinessSummary: s(sp.longBusinessSummary),
        sector:              s(sp.sector),
        industry:            s(sp.industry),
        country:             s(sp.country),
        fullTimeEmployees:   n(sp.fullTimeEmployees),
        website:             s(sp.website),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
