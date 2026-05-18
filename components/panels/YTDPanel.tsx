'use client';
import { useState, useEffect } from 'react';
import { Panel } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface YTDData {
  symbol: string;
  year: number;
  startDate: string;
  endDate: string;
  startPrice: number;
  currentPrice: number;
  ytdPct: number;
  absChange: number;
  tradingDays: number;
}

const n = (v: number, d = 2) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1a2d42', fontSize: 12 }}>
      <span style={{ color: '#7a8fa8' }}>{label}</span>
      <span style={{ color: color ?? '#c8d4e0', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

export default function YTDPanel({ panel }: { panel: Panel }) {
  const [data,    setData]    = useState<YTDData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!panel.symbol) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/ytd/${panel.symbol}`);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json();
        if (d.error) throw new Error(d.error);
        setData(d);
      } catch (e) { setError(String(e)); }
      finally { setLoading(false); }
    };
    load();
  }, [panel.symbol]);

  if (loading) return (
    <div style={{ padding: 12, color: '#f7941d', fontSize: 11 }}>
      <span className="blink">● LOADING YTD...</span>
    </div>
  );
  if (error) return <div style={{ padding: 12, color: '#ff4757', fontSize: 11 }}>{error}</div>;
  if (!data)  return null;

  const pos   = data.ytdPct >= 0;
  const color = pos ? '#00d26a' : '#ff4757';

  // Simple ASCII bar chart
  const barWidth = Math.min(Math.abs(data.ytdPct) * 1.5, 40);
  const bar = '█'.repeat(Math.round(barWidth));

  const fmtDate = (d: string) => {
    try { return format(new Date(d), 'dd/MM/yyyy', { locale: ptBR }); }
    catch { return d; }
  };

  return (
    <div style={{ padding: 14 }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ color: '#f7941d', fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>
          {data.symbol} — YTD {data.year}
        </div>
        <div style={{ fontSize: 42, fontWeight: 700, color, marginTop: 10, letterSpacing: -1 }}>
          {pos ? '+' : ''}{n(data.ytdPct)}%
        </div>
        <div style={{ fontSize: 14, color, marginTop: 4 }}>
          {pos ? '+' : ''}{n(data.absChange)} {pos ? '▲' : '▼'}
        </div>
      </div>

      {/* ASCII bar */}
      <div style={{ marginBottom: 20, padding: '10px 0', borderTop: '1px solid #1a2d42', borderBottom: '1px solid #1a2d42' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
          <span style={{ color: '#4a5f75', minWidth: 28 }}>0%</span>
          <span style={{ color, fontFamily: 'monospace', letterSpacing: -1 }}>{bar}</span>
          <span style={{ color }}>{pos ? '+' : ''}{n(data.ytdPct)}%</span>
        </div>
      </div>

      {/* Detail rows */}
      <Row label="YEAR OPEN"            value={`${fmtDate(data.startDate)}  →  ${n(data.startPrice)}`} />
      <Row label="CURRENT CLOSE"       value={`${fmtDate(data.endDate)}  →  ${n(data.currentPrice)}`} />
      <Row label="ABS. CHANGE"         value={(pos ? '+' : '') + n(data.absChange)} color={color} />
      <Row label="CHANGE %"            value={(pos ? '+' : '') + n(data.ytdPct) + '%'} color={color} />
      <Row label="TRADING DAYS"        value={String(data.tradingDays)} />
      <Row label="YEAR"                value={String(data.year)} />
    </div>
  );
}
