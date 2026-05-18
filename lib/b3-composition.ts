// Shared B3 index composition fetcher — used by /api/index-composition and /api/heatmap

export const B3_PARAMS: Record<string, string> = {
  IBOV: 'eyJsYW5ndWFnZSI6InB0LWJyIiwicGFnZU51bWJlciI6MSwicGFnZVNpemUiOjEyMCwiaW5kZXgiOiJJQk9WIiwic2VnbWVudCI6IjEifQ==',
  IFIX: 'eyJsYW5ndWFnZSI6InB0LWJyIiwicGFnZU51bWJlciI6MSwicGFnZVNpemUiOjEyMCwiaW5kZXgiOiJJRklYIiwic2VnbWVudCI6IjEifQ==',
  IDIV: 'eyJsYW5ndWFnZSI6InB0LWJyIiwicGFnZU51bWJlciI6MSwicGFnZVNpemUiOjEyMCwiaW5kZXgiOiJJRElWIiwic2VnbWVudCI6IjEifQ==',
  SMLL: 'eyJsYW5ndWFnZSI6InB0LWJyIiwicGFnZU51bWJlciI6MSwicGFnZVNpemUiOjEyMCwiaW5kZXgiOiJTTUxMIiwic2VnbWVudCI6IjEifQ==',
};

export interface CompStock { code: string; part: number }

const cache = new Map<string, { data: CompStock[]; ts: number }>();
const TTL   = 6 * 60 * 60 * 1_000; // 6 h — composition changes quarterly

export async function getB3Composition(idx: string): Promise<CompStock[]> {
  const cached = cache.get(idx);
  if (cached && Date.now() - cached.ts < TTL) return cached.data;

  const param = B3_PARAMS[idx];
  if (!param) return [];

  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 10_000);
    const r = await fetch(
      `https://sistemaswebb3-listados.b3.com.br/indexProxy/indexCall/GetPortfolioDay/${param}`,
      {
        cache:   'no-store',
        signal:  ctrl.signal,
        headers: { 'Referer': 'https://www.b3.com.br', 'User-Agent': 'Mozilla/5.0' },
      }
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const results: CompStock[] = (data.results ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((s: any) => ({
        code: String(s.cod ?? '').trim(),
        // B3 returns Brazilian decimal format: "0,561" → parse with comma → dot
        part: parseFloat(String(s.part ?? '').replace(',', '.')) || 0,
      }))
      .filter((s: CompStock) => s.code && s.part > 0)
      .sort((a: CompStock, b: CompStock) => b.part - a.part);
    cache.set(idx, { data: results, ts: Date.now() });
    return results;
  } catch {
    return cached?.data ?? [];
  }
}
