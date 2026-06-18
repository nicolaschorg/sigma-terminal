'use client';
import { create } from 'zustand';
import { useEffect } from 'react';

export interface QuoteSnapshot {
  price:     number;
  change:    number;
  changePct: number;
}

export interface GlobalIndexEntry {
  label:     string;
  price:     number | null;
  changePct: number | null;
  weekPct:   number | null;
  group:     'brasil' | 'global';
}

export interface YieldEntry {
  label:     string;
  rate:      number | null;
  changeBps: number | null;
}

// ── Module-level subscription state (not Zustand state) ───────────────────────
// Using module vars avoids serialisation issues with Sets/timers in Zustand.
const symRefCounts = new Map<string, number>();
let quotesTimer: ReturnType<typeof setInterval> | null = null;
let globalTimer:  ReturnType<typeof setInterval> | null = null;

async function doFetchQuotes() {
  const syms = Array.from(symRefCounts.keys());
  if (!syms.length) return;
  try {
    const r = await fetch(`/api/quotes?symbols=${encodeURIComponent(syms.join(','))}`);
    if (!r.ok) return;
    const data: Record<string, QuoteSnapshot> = await r.json();
    useMarketData.setState(s => ({ quotes: { ...s.quotes, ...data } }));
  } catch { /* keep previous */ }
}

async function doFetchGlobal() {
  try {
    const r = await fetch('/api/global-indices');
    if (!r.ok) return;
    const { brasil = [], global: gbl = [], yields = [], updatedAt = '' } = await r.json();
    useMarketData.setState({ brasil, global: gbl, yields, updatedAt });
  } catch { /* keep previous */ }
}

// ── Zustand store — data only ─────────────────────────────────────────────────
export const useMarketData = create<{
  quotes:    Record<string, QuoteSnapshot>;
  brasil:    GlobalIndexEntry[];
  global:    GlobalIndexEntry[];
  yields:    YieldEntry[];
  updatedAt: string;
}>(() => ({
  quotes:    {},
  brasil:    [],
  global:    [],
  yields:    [],
  updatedAt: '',
}));

// ── Subscription hook ─────────────────────────────────────────────────────────
// Panels call useMarketSymbols(symbols) to register which symbols they need.
// The central loop polls /api/quotes with the union of all registered symbols.
export function useMarketSymbols(syms: string[]) {
  const key = syms.join(',');

  useEffect(() => {
    const snapshot = [...syms];

    // Increment ref-count for each symbol
    snapshot.forEach(s => symRefCounts.set(s, (symRefCounts.get(s) ?? 0) + 1));

    // Start timers on first use; otherwise do an immediate refresh
    if (!quotesTimer) {
      doFetchQuotes();
      quotesTimer = setInterval(doFetchQuotes, 30_000);
    } else if (snapshot.length > 0) {
      doFetchQuotes();
    }
    if (!globalTimer) {
      doFetchGlobal();
      globalTimer = setInterval(doFetchGlobal, 60_000);
    }

    return () => {
      // Decrement ref-counts; remove symbol when count reaches zero
      snapshot.forEach(s => {
        const c = symRefCounts.get(s) ?? 0;
        if (c <= 1) symRefCounts.delete(s);
        else symRefCounts.set(s, c - 1);
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
