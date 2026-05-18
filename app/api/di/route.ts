import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Focus years 2026-2032 → DI curve labels Jan/26 … Jan/32
const FOCUS_YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032];

export interface DiContract {
  symbol:      string;
  maturity:    string;
  rate:        number | null;
  varDay:      number | null;
  isReference: boolean;
}

function abortAfter(ms: number) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl;
}

// One request per year — avoids $top pagination issues when one year dominates
async function fetchFocusSelic(): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  await Promise.allSettled(
    FOCUS_YEARS.map(async (year) => {
      try {
        const r = await fetch(
          `https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais` +
          `?$filter=Indicador%20eq%20'Selic'%20and%20DataReferencia%20eq%20'${year}'%20and%20baseCalculo%20eq%200` +
          `&$orderby=Data%20desc&$top=1&$format=json&$select=Mediana`,
          { cache: 'no-store', signal: abortAfter(8_000).signal }
        );
        if (!r.ok) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json: any = await r.json();
        const val = json?.value?.[0]?.Mediana;
        if (val != null) map.set(year, parseFloat(String(val).replace(',', '.')));
      } catch { /* ignore */ }
    })
  );
  return map;
}

async function fetchCurrentSelic(): Promise<number | null> {
  try {
    const r = await fetch(
      'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json',
      { cache: 'no-store', signal: abortAfter(6_000).signal }
    );
    if (!r.ok) return null;
    const d: { valor: string }[] = await r.json();
    return d[0]?.valor ? parseFloat(d[0].valor.replace(',', '.')) : null;
  } catch { return null; }
}

export async function GET() {
  const [focusMap, currentSelic] = await Promise.all([
    fetchFocusSelic(),
    fetchCurrentSelic(),
  ]);

  const contracts: DiContract[] = FOCUS_YEARS.map((year) => {
    const sym   = `DI1F${String(year).slice(2)}`;
    const label = `Jan/${String(year).slice(2)}`;
    const rate  = focusMap.get(year) ?? (year === FOCUS_YEARS[0] ? currentSelic : null);
    return {
      symbol:      sym,
      maturity:    label,
      rate:        rate != null ? +rate.toFixed(2) : null,
      varDay:      null,
      isReference: true,
    };
  });

  return NextResponse.json(contracts);
}
