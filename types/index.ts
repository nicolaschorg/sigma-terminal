export type PanelType =
  | 'chart'
  | 'quote'
  | 'news'
  | 'fundamentals'
  | 'console'
  | 'search'
  | 'ytd'
  | 'macro'
  | 'indices'
  | 'comparison'
  | 'mult'
  | 'renda-fixa'
  | 'global-indices'
  | 'heatmap'
  | 'calendar';

export interface Panel {
  id: string;
  type: PanelType;
  func?: string;
  symbol?: string;
  title: string;
  maximized?: boolean;
  data?: unknown;
  fixed?: boolean;   // true = never replaced, close button hidden
}

export interface TickerItem {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  isRate?: boolean; // true for SELIC / interest rates
}
