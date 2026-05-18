'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, UTCTimestamp } from 'lightweight-charts';
import { Panel } from '@/types';

const PERIODS = ['1W', '1M', '3M', '1A'] as const;
type Period = typeof PERIODS[number];

const COLORS = ['#f7941d', '#00d26a', '#7ab8e8', '#ff4757', '#b27cff'];

interface Point      { date: string; value: number; }
interface SeriesData { symbol: string; data: Point[]; }

export default function ComparisonPanel({ panel }: { panel: Panel }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef     = useRef<ReturnType<typeof createChart> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRefs   = useRef<any[]>([]);

  const [period,  setPeriod]  = useState<Period>('1M');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [legend,  setLegend]  = useState<{ symbol: string; color: string }[]>([]);

  // Init chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { color: '#0f1928' },
        textColor:  '#c8d4e0',
        fontFamily: 'Courier New, monospace',
        fontSize:   11,
      },
      grid:            { vertLines: { color: '#1a2d42' }, horzLines: { color: '#1a2d42' } },
      crosshair:       { mode: 1 },
      rightPriceScale: { borderColor: '#1a2d42' },
      timeScale:       { borderColor: '#1a2d42', timeVisible: true, secondsVisible: false },
      handleScroll: true,
      handleScale:  true,
    });
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current)
        chartRef.current.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; seriesRefs.current = []; };
  }, []);

  const loadData = useCallback(async () => {
    const syms = Array.isArray(panel.data) ? (panel.data as string[]) : [];
    if (!syms.length || !chartRef.current) return;

    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/comparison?symbols=${syms.join(',')}&period=${period}`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const all: SeriesData[] = await r.json();

      // Remove old series
      for (const s of seriesRefs.current) {
        try { chartRef.current!.removeSeries(s); } catch { /* ignore */ }
      }
      seriesRefs.current = [];

      const newLegend: { symbol: string; color: string }[] = [];

      all.forEach(({ symbol, data }, i) => {
        if (!data.length) return;
        const color = COLORS[i % COLORS.length];

        const s = chartRef.current!.addLineSeries({
          color,
          lineWidth: 2,
          title: symbol,
          priceLineVisible: false,
          lastValueVisible: true,
        });

        s.setData(
          data
            .map((d) => ({
              time:  Math.floor(new Date(d.date).getTime() / 1000) as UTCTimestamp,
              value: d.value,
            }))
            .filter((d) => !isNaN(d.time) && !isNaN(d.value))
            .sort((a, b) => a.time - b.time)
            .filter((d, idx, arr) => idx === 0 || arr[idx - 1].time !== d.time)
        );

        seriesRefs.current.push(s);
        newLegend.push({ symbol, color });
      });

      setLegend(newLegend);
      chartRef.current!.timeScale().fitContent();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [panel.data, period]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Controls + legend */}
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap',
        gap: 6, padding: '5px 8px',
        borderBottom: '1px solid #1a2d42', flexShrink: 0,
      }}>
        {PERIODS.map((p) => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding: '2px 9px',
            background: period === p ? '#f7941d' : '#1a2d42',
            color:      period === p ? '#0a0f1a' : '#c8d4e0',
            border: 'none', cursor: 'pointer', fontSize: 11,
            fontFamily: 'inherit', borderRadius: 2,
            fontWeight: period === p ? 700 : 400,
          }}>{p}</button>
        ))}

        <div style={{ width: 1, height: 14, background: '#1a2d42', flexShrink: 0 }} />

        {legend.map(({ symbol, color }) => (
          <div key={symbol} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
            <div style={{ width: 14, height: 3, background: color, borderRadius: 1 }} />
            <span style={{ color: '#c8d4e0' }}>{symbol}</span>
          </div>
        ))}

        {loading && (
          <span className="blink" style={{ color: '#f7941d', fontSize: 11 }}>● CARREGANDO</span>
        )}
        {error && (
          <span style={{ color: '#ff4757', fontSize: 11 }}>{error}</span>
        )}
      </div>

      <div style={{ padding: '2px 8px', fontSize: 9, color: '#4a5f75', flexShrink: 0 }}>
        Base 100 · performance relativa normalizada
      </div>

      <div ref={containerRef} style={{ flex: 1 }} />
    </div>
  );
}
