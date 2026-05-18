'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Panel, PanelType } from '@/types';
import { parseCommand } from '@/lib/parser';
import { PANEL_TYPES, NO_SYMBOL_FUNCS, getPanelTitle } from '@/lib/commands';

interface TerminalStore {
  panels:         Panel[];       // Always the 5 fixed panels — never mutated
  floatingPanels: Panel[];       // Dynamic overlay panels from commands
  activeSymbol:   string;
  commandHistory: string[];
  historyIndex:   number;
  watchlist:      string[];
  openPanel:          (panel: Omit<Panel, 'id'>) => void;
  closePanel:         (id: string) => void;
  maximizePanel:      (id: string) => void;
  setActiveSymbol:    (symbol: string) => void;
  runCommand:         (input: string) => { success: boolean; message?: string };
  navigateHistory:    (direction: 'up' | 'down') => string;
  addToWatchlist:     (symbol: string) => void;
  removeFromWatchlist:(symbol: string) => void;
}

// These functions are always visible as fixed panels — opening them does nothing
const FIXED_FUNCS = new Set(['ALLQ', 'INDICES', 'NEWS', 'RF', 'GIDX', 'HM', 'CAL']);

// Order matters: PanelGrid destructures [watchlist, indices, news, gidx, rendaFixa, heatmap, calendar]
const FIXED_PANELS: Panel[] = [
  { id: 'fixed-watchlist', type: 'quote',          func: 'ALLQ',    title: 'WATCHLIST',       fixed: true },
  { id: 'fixed-indices',   type: 'indices',        func: 'INDICES', title: 'ÍNDICES | B3',    fixed: true },
  { id: 'fixed-news',      type: 'news',           func: 'NEWS',    title: 'NOTÍCIAS',        fixed: true },
  { id: 'fixed-gidx',      type: 'global-indices', func: 'GIDX',    title: 'ÍNDICES GLOBAIS', fixed: true },
  { id: 'fixed-rf',        type: 'renda-fixa',     func: 'RF',      title: 'RENDA FIXA',      fixed: true },
  { id: 'fixed-heatmap',   type: 'heatmap',        func: 'HM',      title: 'HEATMAP B3',      fixed: true },
  { id: 'fixed-calendar',  type: 'calendar',       func: 'CAL',     title: 'CALENDÁRIO',      fixed: true },
];

export const useTerminal = create<TerminalStore>()(
  persist(
    (set, get) => ({
      panels:         FIXED_PANELS,
      floatingPanels: [],
      activeSymbol:   'PETR4',
      commandHistory: [],
      historyIndex:   -1,
      watchlist:      ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'B3SA3'],

      openPanel: (panel) => {
        // Commands for permanently-visible panels are silently ignored
        if (FIXED_FUNCS.has(panel.func ?? '')) return;

        const id = `fp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((state) => {
          const next = [...state.floatingPanels, { ...panel, id }];
          // FIFO: keep at most 2 floating panels
          return { floatingPanels: next.length > 2 ? next.slice(-2) : next };
        });
      },

      closePanel: (id) =>
        set((state) => ({
          floatingPanels: state.floatingPanels.filter((p) => p.id !== id),
        })),

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

        set((state) => ({
          commandHistory: [trimmed, ...state.commandHistory.slice(0, 49)],
          historyIndex: -1,
        }));

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
          if (syms.length < 2) return { success: false, message: 'COMP requer pelo menos 2 símbolos. Ex: COMP PETR4 VALE3 IBOV' };
          get().openPanel({
            type:  'comparison',
            func:  'COMP',
            title: `COMP | ${syms.join(' · ')}`,
            data:  syms,
          });
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

        get().openPanel({
          type:   panelType as PanelType,
          func:   parsed.function,
          symbol,
          title:  getPanelTitle(parsed),
        });

        return { success: true };
      },

      navigateHistory: (direction) => {
        const { commandHistory, historyIndex } = get();
        const newIndex =
          direction === 'up'
            ? Math.min(historyIndex + 1, commandHistory.length - 1)
            : Math.max(historyIndex - 1, -1);
        set({ historyIndex: newIndex });
        return newIndex >= 0 ? commandHistory[newIndex] : '';
      },

      addToWatchlist: (symbol) =>
        set((state) => ({
          watchlist: state.watchlist.includes(symbol)
            ? state.watchlist
            : [...state.watchlist, symbol],
        })),

      removeFromWatchlist: (symbol) =>
        set((state) => ({
          watchlist: state.watchlist.filter((s) => s !== symbol),
        })),
    }),
    {
      name: 'sigma-storage',
      partialize: (state) =>
        ({ watchlist: state.watchlist, commandHistory: state.commandHistory }) as Partial<TerminalStore>,
    }
  )
);
