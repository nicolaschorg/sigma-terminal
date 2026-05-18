'use client';
import { useState, useEffect, useMemo } from 'react';
import { Panel } from '@/types';
import type { HeatmapStock } from '@/app/api/heatmap/[index]/route';
import { useMarketData, useMarketSymbols, type QuoteSnapshot } from '@/store/useMarketData';

function heatColor(v: number | null): string {
  if (v == null) return '#1a2535';
  const t = Math.max(-3, Math.min(3, v)) / 3;
  if (t >= 0) {
    const r = Math.round(26 * (1 - t));
    const g = Math.round(37 + (140 - 37) * t);
    const b = Math.round(53 * (1 - t * 0.6));
    return `rgb(${r},${g},${b})`;
  }
  const u = -t;
  const r = Math.round(26 + (190 - 26) * u);
  const g = Math.round(37 * (1 - u * 0.7));
  const b = Math.round(53 * (1 - u * 0.7));
  return `rgb(${r},${g},${b})`;
}

function fmtPct(v: number | null) {
  if (v == null) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

type Tier = 0 | 1 | 2 | 3;

function tierOf(weight: number): Tier {
  if (weight > 5)   return 0;
  if (weight >= 2)  return 1;
  if (weight >= 0.5) return 2;
  return 3;
}

const TIER_DIM:  Record<Tier, number> = { 0: 72, 1: 48, 2: 32, 3: 22 };
const TIER_TICK: Record<Tier, number | null> = { 0: 11, 1: 10, 2: null, 3: null };
const TIER_VAR:  Record<Tier, number | null> = { 0: 10,  1: 9,  2: 9,    3: null };

function HeatmapGrid({ stocks, quotes }: {
  stocks: HeatmapStock[];
  quotes: Record<string, QuoteSnapshot>;
}) {
  const sorted = useMemo(
    () => [...stocks].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)),
    [stocks]
  );

  if (!sorted.length) return null;

  const tiers: Tier[] = [0, 1, 2, 3];

  return (
    <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {tiers.map(tier => {
        const group = sorted.filter(s => tierOf(s.weight ?? 0) === tier);
        if (!group.length) return null;
        const dim     = TIER_DIM[tier];
        const tickSz  = TIER_TICK[tier];
        const varSz   = TIER_VAR[tier];
        return (
          <div
            key={tier}
            style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 2 }}
          >
            {group.map(s => {
              const liveVar = quotes[s.symbol]?.changePct ?? s.varDay;
              const bg      = heatColor(liveVar);
              return (
                <div
                  key={s.symbol}
                  title={`${s.symbol}  ${fmtPct(liveVar)}  (${(s.weight ?? 0).toFixed(2)}%)`}
                  style={{
                    width:          dim,
                    height:         dim,
                    background:     bg,
                    borderRadius:   2,
                    border:         '1px solid rgba(0,0,0,0.25)',
                    display:        'flex',
                    flexDirection:  'column',
                    alignItems:     'center',
                    justifyContent: 'center',
                    overflow:       'hidden',
                    flexShrink:     0,
                    cursor:         'default',
                    gap:            1,
                  }}
                >
                  {tickSz != null && (
                    <span style={{
                      fontSize:      tickSz,
                      fontWeight:    700,
                      color:         'rgba(255,255,255,0.92)',
                      letterSpacing: -0.3,
                      userSelect:    'none',
                      lineHeight:    1,
                      whiteSpace:    'nowrap',
                    }}>
                      {s.symbol.slice(0, 5)}
                    </span>
                  )}
                  {varSz != null && (
                    <span style={{
                      fontSize:   varSz,
                      color:      'rgba(255,255,255,0.75)',
                      userSelect: 'none',
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                    }}>
                      {liveVar == null ? '—' : (liveVar >= 0 ? '+' : '') + liveVar.toFixed(1) + '%'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

type Tab = 'IBOV' | 'IFIX';

export default function HeatmapPanel({ panel: _panel }: { panel: Panel }) {
  const [ibov,    setIbov]    = useState<HeatmapStock[]>([]);
  const [ifix,    setIfix]    = useState<HeatmapStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<Tab>('IBOV');

  const allSyms = useMemo(() => [...ibov, ...ifix].map(s => s.symbol), [ibov, ifix]);
  useMarketSymbols(allSyms);
  const quotes = useMarketData(s => s.quotes);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [ibovRes, ifixRes] = await Promise.allSettled([
        fetch('/api/heatmap/IBOV').then(r => r.json()).catch(() => []),
        fetch('/api/heatmap/IFIX').then(r => r.json()).catch(() => []),
      ]);
      if (cancelled) return;
      if (ibovRes.status === 'fulfilled' && Array.isArray(ibovRes.value)) setIbov(ibovRes.value);
      if (ifixRes.status === 'fulfilled' && Array.isArray(ifixRes.value)) setIfix(ifixRes.value);
      setLoading(false);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (loading) return (
    <div style={{ padding: 10, color: '#f7941d', fontSize: 11 }}>
      <span className="blink">● CARREGANDO HEATMAP...</span>
    </div>
  );

  const stocks = tab === 'IBOV' ? ibov : ifix;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tab bar */}
      <div style={{
        display:      'flex',
        gap:          2,
        padding:      '4px 8px 0',
        borderBottom: '1px solid #1a2535',
        flexShrink:   0,
      }}>
        {(['IBOV', 'IFIX'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              fontSize:      9,
              fontWeight:    700,
              letterSpacing: 1,
              padding:       '3px 10px',
              borderRadius:  '3px 3px 0 0',
              border:        'none',
              cursor:        'pointer',
              background:    t === tab ? '#f7941d' : '#0d1b2a',
              color:         t === tab ? '#0d1410' : '#5a7a9a',
              transition:    'background 0.15s',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Heatmap */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <HeatmapGrid stocks={stocks} quotes={quotes} />
      </div>
    </div>
  );
}
