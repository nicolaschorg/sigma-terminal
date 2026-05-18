'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, UTCTimestamp } from 'lightweight-charts';
import { Panel } from '@/types';

const PERIODS = ['1D', '1W', '1M', '3M', '1A', 'MAX'] as const;
type Period    = typeof PERIODS[number];
type ChartType = 'line' | 'bar' | 'candle';

interface BarData {
  date:   string | number;
  open:   number | null;
  high:   number | null;
  low:    number | null;
  close:  number | null;
  volume?: number;
}

function toOHLC(raw: BarData[]) {
  return raw
    .filter((b) => b.open != null && b.close != null && b.high != null && b.low != null)
    .map((b) => ({
      time:  Math.floor(new Date(b.date).getTime() / 1000) as UTCTimestamp,
      open:  Number(b.open),
      high:  Number(b.high),
      low:   Number(b.low),
      close: Number(b.close),
    }))
    .filter((b) => !isNaN(b.time) && !isNaN(b.open))
    .sort((a, b) => a.time - b.time)
    .filter((b, i, arr) => i === 0 || arr[i - 1].time !== b.time);
}

function toLine(raw: BarData[]) {
  return raw
    .filter((b) => b.close != null)
    .map((b) => ({
      time:  Math.floor(new Date(b.date).getTime() / 1000) as UTCTimestamp,
      value: Number(b.close),
    }))
    .filter((b) => !isNaN(b.time) && !isNaN(b.value))
    .sort((a, b) => a.time - b.time)
    .filter((b, i, arr) => i === 0 || arr[i - 1].time !== b.time);
}

export default function ChartPanel({ panel }: { panel: Panel }) {
  const containerRef  = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef      = useRef<ReturnType<typeof createChart> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef     = useRef<any>(null);
  const rawRef        = useRef<BarData[]>([]);
  const chartTypeRef  = useRef<ChartType>('line');

  const [period,    setPeriod]    = useState<Period>('1M');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // ── Build / rebuild the series for a given type & dataset ──────────────────
  const applySeries = useCallback((type: ChartType, raw: BarData[]) => {
    const chart = chartRef.current;
    if (!chart) return;

    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    if (type === 'line') {
      const s = chart.addAreaSeries({
        lineColor:   '#f7941d',
        topColor:    'rgba(247,148,29,0.22)',
        bottomColor: 'rgba(247,148,29,0.02)',
        lineWidth:   2,
      });
      s.setData(toLine(raw));
      seriesRef.current = s;
    } else if (type === 'bar') {
      const s = chart.addBarSeries({ upColor: '#00d26a', downColor: '#ff4757' });
      s.setData(toOHLC(raw));
      seriesRef.current = s;
    } else {
      const s = chart.addCandlestickSeries({
        upColor:         '#00d26a',
        downColor:       '#ff4757',
        borderUpColor:   '#00d26a',
        borderDownColor: '#ff4757',
        wickUpColor:     '#00d26a',
        wickDownColor:   '#ff4757',
      });
      s.setData(toOHLC(raw));
      seriesRef.current = s;
    }

    chart.timeScale().fitContent();
  }, []);

  // ── Init chart once ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background:  { color: '#0f1928' },
        textColor:   '#c8d4e0',
        fontFamily:  'Courier New, monospace',
        fontSize:    11,
      },
      grid:           { vertLines: { color: '#1a2d42' }, horzLines: { color: '#1a2d42' } },
      crosshair:      { mode: 1 },
      rightPriceScale:{ borderColor: '#1a2d42' },
      timeScale:      { borderColor: '#1a2d42', timeVisible: true, secondsVisible: false },
      handleScroll:   true,
      handleScale:    true,
    });

    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // ── Fetch data when symbol or period changes ───────────────────────────────
  const loadData = useCallback(async () => {
    if (!panel.symbol || !chartRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/historical/${panel.symbol}?period=${period}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const raw: BarData[] = await res.json();

      if (!Array.isArray(raw) || raw.length === 0) {
        setError('Sem dados disponíveis');
        return;
      }

      rawRef.current = raw;
      applySeries(chartTypeRef.current, raw);
    } catch (e) {
      setError(`Erro: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [panel.symbol, period, applySeries]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Switch chart type without re-fetching ─────────────────────────────────
  const handleTypeChange = useCallback((type: ChartType) => {
    chartTypeRef.current = type;
    setChartType(type);
    if (rawRef.current.length > 0) applySeries(type, rawRef.current);
  }, [applySeries]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '5px 8px', borderBottom: '1px solid #1a2d42', flexShrink: 0,
      }}>
        {/* Period selector */}
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

        <div style={{ width: 1, height: 14, background: '#1a2d42', margin: '0 4px', flexShrink: 0 }} />

        {/* Chart type selector */}
        {(['line', 'bar', 'candle'] as ChartType[]).map((t) => {
          const label = t === 'line' ? 'LINHA' : t === 'bar' ? 'BARRA' : 'CANDLE';
          const active = chartType === t;
          return (
            <button key={t} onClick={() => handleTypeChange(t)} style={{
              padding: '2px 9px',
              background: active ? '#1a3a5c' : 'transparent',
              color:      active ? '#7ab8e8' : '#4a5f75',
              border:     active ? '1px solid #1e4a7a' : '1px solid transparent',
              cursor: 'pointer', fontSize: 10, fontFamily: 'inherit',
              borderRadius: 2, fontWeight: active ? 700 : 400,
            }}>{label}</button>
          );
        })}

        {loading && (
          <span className="blink" style={{ color: '#f7941d', fontSize: 11, marginLeft: 8 }}>
            ● CARREGANDO
</span>
        )}
        {error && (
          <span style={{ color: '#ff4757', fontSize: 11, marginLeft: 8 }}>{error}</span>
        )}
      </div>

      <div ref={containerRef} style={{ flex: 1 }} />
    </div>
  );
}
