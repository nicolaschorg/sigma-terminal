import { PanelType } from '@/types';
import type { ParsedCommand } from './parser';

export const COMMAND_DESCRIPTIONS: Record<string, string> = {
  DES:     'Description — Perfil e informações da empresa',
  GP:      'Graph Price — Gráfico de preço',
  FA:      'Financial Analysis — Análise fundamentalista',
  NEWS:    'News — Notícias recentes',
  ALLQ:    'All Quotes — Cotações da watchlist',
  HELP:    'Help — Lista de comandos disponíveis',
  MKTCAP:  'Market Cap — Capitalização de mercado',
  YTD:     'Year to Date — Performance no ano',
  DVD:     'Dividend — Dados de dividendos',
  WL:      'Watchlist — WL ADD <SYM> | WL REMOVE <SYM>',
  SRCH:    'Search — Buscar tickers por nome',
  MACRO:   'Macro — Câmbio, juros e inflação (BRL)',
  COMP:    'Compare — COMP PETR4 VALE3 IBOV (base 100)',
  INDICES: 'Índices — Top constituintes IBOV/IFIX/IDIV/SMLL',
  MULT:    'Múltiplos — P/L, P/VP e EV/EBITDA históricos',
};

export const PANEL_TYPES: Record<string, PanelType> = {
  DES:     'fundamentals',
  GP:      'chart',
  FA:      'fundamentals',
  NEWS:    'news',
  ALLQ:    'quote',
  HELP:    'console',
  MKTCAP:  'quote',
  YTD:     'ytd',
  DVD:     'fundamentals',
  WL:      'console',
  SRCH:    'search',
  MACRO:   'macro',
  COMP:    'comparison',
  INDICES: 'indices',
  MULT:    'mult',
};

export const NO_SYMBOL_FUNCS = ['HELP', 'ALLQ', 'WL', 'SRCH', 'MACRO', 'COMP', 'INDICES', 'NEWS'];

export function getPanelTitle(cmd: ParsedCommand): string {
  const desc  = COMMAND_DESCRIPTIONS[cmd.function] || cmd.function;
  const label = desc.split('—')[0].trim();
  return cmd.symbol ? `${cmd.symbol} | ${label}` : label;
}
