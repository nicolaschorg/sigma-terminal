'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Panel, PanelType } from '@/types';
import { parseCommand } from '@/lib/parser';
import { PANEL_TYPES, NO_SYMBOL_FUNCS, getPanelTitle } from '@/lib/commands';

export interface WatchlistGroup {
  id: string;
  label: string;
  symbols: string[];
}

interface TerminalStore {
  panels:         Panel[];
  floatingPanels: Panel[];
  activeSymbol:   string;
  commandHistory: string[];
  historyIndex:   number;
  watchlist:      string[];
  groups:         WatchlistGroup[];
  openPanel:           (panel: Omit<Panel, 'id'>) => void;
  closePanel:          (id: string) => void;
  maximizePanel:       (id: string) => void;
  setActiveSymbol:     (symbol: string) => void;
  runCommand:          (input: string) => { success: boolean; message?: string };
  navigateHistory:     (direction: 'up' | 'down') => string;
  addToWatchlist:      (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  addGroup:            (label: string) => string;
  removeGroup:         (id: string) => void;
  addToGroup:          (symbol: string, groupId: string) => void;
  removeFromGroup:     (symbol: string, groupId: string) => void;
  reorderGroups:       (ids: string[]) => void;
  reorderGroupSymbols: (groupId: string, symbols: string[]) => void;
}

const FIXED_FUNCS = new Set(['ALLQ', 'INDICES', 'NEWS', 'RF', 'GIDX', 'HM', 'CAL']);

const FIXED_PANELS: Panel[] = [
  { id: 'fixed-watchlist', type: 'quote',          func: 'ALLQ',    title: 'WATCHLIST',       fixed: true },
  { id: 'fixed-indices',   type: 'indices',        func: 'INDICES', title: 'ÍNDICES | B3',    fixed: true },
  { id: 'fixed-news',      type: 'news',           func: 'NEWS',    title: 'NOTÍCIAS',        fixed: true },
  { id: 'fixed-gidx',      type: 'global-indices', func: 'GIDX',    title: 'ÍNDICES GLOBAIS', fixed: true },
  { id: 'fixed-rf',        type: 'renda-fixa',     func: 'RF',      title: 'RENDA FIXA',      fixed: true },
  { id: 'fixed-heatmap',   type: 'heatmap',        func: 'HM',      title: 'HEATMAP B3',      fixed: true },
  { id: 'fixed-calendar',  type: 'calendar',       func: 'CAL',     title: 'CALENDÁRIO',      fixed: true },
];

const DEFAULT_GROUPS: WatchlistGroup[] = [
  { id: 'hb-media-alta',  label: 'HB MÉDIA/ALTA',  symbols: ['CYRE3','EZTC3','EVEN3','TRIS3','LAVV3','JHSF3','MTRE3','MELK3','MDNE3','GFSA3'] },
  { id: 'hb-baixa-renda', label: 'HB BAIXA RENDA', symbols: ['MRVE3','DIRR3','PLPL3','CURY3','TEND3'] },
  { id: 'shoppings',      label: 'SHOPPINGS',       symbols: ['MULT3','IGTI11','ALOS3'] },
];

export const useTerminal = create<TerminalStore>()(
  persist(
    (set, get) => ({
      panels:         FIXED_PANELS,
      floatingPanels: [],
      activeSymbol:   'PETR4',
      commandHistory: [],
      historyIndex:   -1,
      watchlist:      ['CYRE3','EZTC3','EVEN3','TRIS3','LAVV3','JHSF3','MTRE3','MELK3','MDNE3','GFSA3','MRVE3','DIRR3','PLPL3','CURY3','TEND3','MULT3','IGTI11','ALOS3'],
      groups:         DEFAULT_GROUPS,

      openPanel: (panel) => {
        if (FIXED_FUNCS.has(panel.func ?? '')) return;
        const id = `fp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((state) => {
          const next = [...state.floatingPanels, { ...panel, id }];
          return { floatingPanels: next.length > 2 ? next.slice(-2) : next };
        });
      },

      closePanel: (id) =>
        set((state) => ({ floatingPanels: state.floatingPanels.filter((p) => p.id !== id) })),

      maximizePanel: (id) =>
        set((state) => ({
          floatingPanels: state.floatingPanels.map((p) => ({
            ...p,
            maximized: p.id === id ? !p.maximized : false,
          })),
        })),

      setActiveSymbol: (symbol) => set({ activeSymbol: symbol }),

      runCommand: (input) => {
        const trimmed = input.trim();
        if (!trimmed) return { success: false };
        set((state) => ({ commandHistory: [trimmed, ...state.commandHistory.slice(0, 49)], historyIndex: -1 }));
        const parsed = parseCommand(trimmed);
        if (!parsed) return { success: false, message: 'Comando inválido' };

        if (parsed.function === 'WL') {
          const action = parsed.args?.[0]?.toUpperCase();
          const sym    = parsed.args?.[1]?.toUpperCase();
          let msg = '';
          if (action === 'ADD' && sym) {
            get().addToWatchlist(sym);
            msg = `✓ ${sym} adicionado à watchlist`;
          } else if (action === 'REMOVE' && sym) {
            get().removeFromWatchlist(sym);
            msg = `✓ ${sym} removido da watchlist`;
          } else {
            msg = 'Uso:  WL ADD <SÍMBOLO>  |  WL REMOVE <SÍMBOLO>';
          }
          get().openPanel({ type: 'console', func: 'WL', title: 'WL | Watchlist', data: msg });
          return { success: true };
        }

        if (parsed.function === 'COMP') {
          const syms = (parsed.args ?? []).filter(Boolean).map((s) => s.toUpperCase());
          if (syms.length < 2) return { success: false, message: 'COMP requer pelo menos 2 símbolos.' };
          get().openPanel({ type: 'comparison', func: 'COMP', title: `COMP | ${syms.join(' · ')}`, data: syms });
          return { success: true };
        }

        if (parsed.function === 'SRCH') {
          const query = parsed.args?.join(' ')?.trim() ?? '';
          if (!query) return { success: false, message: 'Uso: SRCH <TERMO>' };
          get().openPanel({ type: 'search', func: 'SRCH', title: `SRCH | ${query.toUpperCase()}`, data: query });
          return { success: true };
        }

        const panelType = PANEL_TYPES[parsed.function];
        if (!panelType) return { success: false, message: `Função desconhecida: ${parsed.function}` };

        const symbol = NO_SYMBOL_FUNCS.includes(parsed.function)
          ? undefined
          : parsed.symbol || get().activeSymbol;
        if (symbol) set({ activeSymbol: symbol });

        get().openPanel({ type: panelType as PanelType, func: parsed.function, symbol, title: getPanelTitle(parsed) });
        return { success: true };
      },

      navigateHistory: (direction) => {
        const { commandHistory, historyIndex } = get();
        const newIndex = direction === 'up'
          ? Math.min(historyIndex + 1, commandHistory.length - 1)
          : Math.max(historyIndex - 1, -1);
        set({ historyIndex: newIndex });
        return newIndex >= 0 ? commandHistory[newIndex] : '';
      },

      addToWatchlist: (symbol) =>
        set((state) => ({
          watchlist: state.watchlist.includes(symbol) ? state.watchlist : [...state.watchlist, symbol],
        })),

      removeFromWatchlist: (symbol) =>
        set((state) => ({ watchlist: state.watchlist.filter((s) => s !== symbol) })),

      addGroup: (label) => {
        const id = `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((state) => ({ groups: [...state.groups, { id, label, symbols: [] }] }));
        return id;
      },

      removeGroup: (id) =>
        set((state) => ({ groups: state.groups.filter(g => g.id !== id) })),

      addToGroup: (symbol, groupId) =>
        set((state) => ({
          groups: state.groups.map(g =>
            g.id === groupId && !g.symbols.includes(symbol)
              ? { ...g, symbols: [...g.symbols, symbol] }
              : g
          ),
        })),

      removeFromGroup: (symbol, groupId) =>
        set((state) => ({
          groups: state.groups.map(g =>
            g.id === groupId ? { ...g, symbols: g.symbols.filter(s => s !== symbol) } : g
          ),
        })),

      reorderGroups: (ids) =>
        set((state) => ({
          groups: ids
            .map(id => state.groups.find(g => g.id === id))
            .filter((g): g is WatchlistGroup => g != null),
        })),

      reorderGroupSymbols: (groupId, symbols) =>
        set((state) => ({
          groups: state.groups.map(g => g.id === groupId ? { ...g, symbols } : g),
        })),
    }),
    {
      name: 'sigma-storage',
      partialize: (state) =>
        ({ watchlist: state.watchlist, commandHistory: state.commandHistory, groups: state.groups }) as Partial<TerminalStore>,
    }
  )
);
