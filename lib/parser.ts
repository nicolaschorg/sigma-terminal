export const FUNCTIONS = [
  'DES', 'GP', 'FA', 'NEWS', 'ALLQ', 'HELP', 'MKTCAP', 'YTD', 'DVD',
  'WL', 'SRCH', 'MACRO', 'COMP', 'INDICES', 'MULT',
] as const;
export type TerminalFunction = typeof FUNCTIONS[number];

export interface ParsedCommand {
  symbol?: string;
  function: string;
  args?: string[];
}

export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts  = trimmed.split(/\s+/);
  const upper  = parts.map((p) => p.toUpperCase());

  if (upper.length === 1) {
    if ((FUNCTIONS as readonly string[]).includes(upper[0])) return { function: upper[0] };
    return { symbol: upper[0], function: 'GP' };
  }

  const [first, second, ...rest] = upper;

  // WL ADD/REMOVE <SYMBOL>
  if (first === 'WL') return { function: 'WL', args: [second, ...rest] };

  // SRCH <query> — preserve original casing
  if (first === 'SRCH') return { function: 'SRCH', args: parts.slice(1) };

  // COMP <sym1> <sym2> ... — all args are symbols
  if (first === 'COMP') return { function: 'COMP', args: [second, ...rest] };

  if ((FUNCTIONS as readonly string[]).includes(second)) {
    return { symbol: first, function: second, args: rest };
  }
  if ((FUNCTIONS as readonly string[]).includes(first)) {
    return { function: first, args: [second, ...rest] };
  }

  return { symbol: first, function: 'GP' };
}

export function getSuggestions(input: string): string[] {
  const trimmed = input.trim().toUpperCase();
  if (!trimmed) return [];

  const parts = trimmed.split(/\s+/);

  if (parts[0] === 'WL') {
    if (parts.length === 1) return ['WL ADD', 'WL REMOVE'];
    if (parts.length === 2 && parts[1])
      return ['ADD', 'REMOVE'].filter((s) => s.startsWith(parts[1])).map((s) => `WL ${s}`);
    return [];
  }

  if (parts[0] === 'SRCH' || parts[0] === 'COMP') return [];

  if (parts.length === 2 && parts[1]) {
    return (FUNCTIONS as readonly string[])
      .filter((f) => f.startsWith(parts[1]) && f !== 'WL' && f !== 'SRCH' && f !== 'COMP')
      .map((f) => `${parts[0]} ${f}`);
  }

  if (parts.length === 1) {
    return (FUNCTIONS as readonly string[]).filter((f) => f.startsWith(parts[0]));
  }

  return [];
}
