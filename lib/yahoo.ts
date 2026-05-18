import YahooFinanceClass from 'yahoo-finance2';

// yahoo-finance2 ESM exports the constructor — must instantiate to get prototype methods
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yahooFinance: any = new (YahooFinanceClass as any)();

try { yahooFinance.suppressNotices(['yahooSurvey']); } catch {}

export function toYahooSymbol(symbol: string): string {
  const cleaned = symbol.toUpperCase().replace(/\.SA$/i, '');
  // Brazilian equities: 4 uppercase letters + 1-2 digits (PETR4, VALE3, B3SA3, BBDC4, etc.)
  if (/^[A-Z]{4,5}\d{1,2}$/.test(cleaned)) {
    return `${cleaned}.SA`;
  }
  return cleaned;
}

export default yahooFinance;
