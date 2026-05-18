'use client';
import { useState, useEffect } from 'react';
import { Panel } from '@/types';

interface ExchangeRow {
  label:     string;
  price:     number | null;
  change:    number | null;
  changePct: number | null;
}

interface MacroData {
  exchange:  ExchangeRow[];
  rates:     { selic: number | null; cdi: number | null; ipca12m: number | null };
  updatedAt: string;
}

const fmtPrice = (v: number | null, dec = 2) =>
  v == null ? 'N/A' : v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const fmtRate  = (v: number | null) => v == null ? 'N/A' : `${v.toFixed(2)}% a.a.`;
const fmtIpca  = (v: number | null) => v == null ? 'N/A' : `${v.toFixed(2)}% (12m)`;

function SectionTitle({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 9, letterSpacing: 1.8, textTransform: 'uppercase' as const,
      color: '#8ba4bc', padding: '8px 0 4px',
      borderBottom: '1px solid #1a2535', marginBottom: 3,
    }}>{label}</div>
  );
}

function ExchangeLine({ row }: { row: ExchangeRow }) {
  const pos   = (row.changePct ?? 0) >= 0;
  const color = pos ? '#00c076' : '#ff3b5c';
  const pctBg = pos ? 'rgba(0,192,118,0.09)' : 'rgba(255,59,92,0.09)';

  return (
    <div className="row" style={{
      display: 'grid', gridTemplateColumns: '76px 1fr auto auto',
      gap: 8, padding: '5px 0', borderBottom: '1px solid #1a2535',
      alignItems: 'center', fontSize: 12,
    }}>
      <span style={{ color: '#5a7a9a', fontSize: 11 }}>{row.label}</span>
      <span style={{ color: '#d4dce8', fontVariantNumeric: 'tabular-nums' }}>
        {fmtPrice(row.price)}
      </span>
      <span style={{ color, fontVariantNumeric: 'tabular-nums', fontSize: 10 }}>
        {row.change == null ? '' : (pos ? '+' : '') + fmtPrice(row.change)}
      </span>
      <span style={{
        color, fontWeight: 600, fontSize: 10,
        minWidth: 56, textAlign: 'right',
        background: pctBg, borderRadius: 2, padding: '1px 4px',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {row.changePct == null ? '' : `${pos ? '▲' : '▼'} ${Math.abs(row.changePct).toFixed(2)}%`}
      </span>
    </div>
  );
}

function RateLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="row" style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '5px 0', borderBottom: '1px solid #1a2535', fontSize: 12,
    }}>
      <span style={{ color: '#5a7a9a', fontSize: 11 }}>{label}</span>
      <span style={{
        color: '#f7941d', fontVariantNumeric: 'tabular-nums', fontWeight: 600,
      }}>{value}</span>
    </div>
  );
}

export default function MacroPanel({ panel }: { panel: Panel }) {
  const [data,    setData]    = useState<MacroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch('/api/macro');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      setData(await r.json());
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return (
    <div style={{ padding: 14, color: '#f7941d', fontSize: 11 }}>
      <span className="blink">● CARREGANDO MACRO...</span>
    </div>
  );
  if (error) return <div style={{ padding: 14, color: '#ff3b5c', fontSize: 11 }}>{error}</div>;
  if (!data)  return null;

  const ts = data.updatedAt
    ? new Date(data.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div style={{ padding: '6px 14px', overflowY: 'auto', height: '100%' }}>
      <SectionTitle label="Câmbio" />
      {data.exchange.map((row) => (
        <ExchangeLine key={row.label} row={row} />
      ))}

      <SectionTitle label="Juros & Inflação" />
      <RateLine label="SELIC META" value={fmtRate(data.rates.selic)} />
      <RateLine label="CDI"        value={fmtRate(data.rates.cdi)} />
      <RateLine label="IPCA"       value={fmtIpca(data.rates.ipca12m)} />

      <div style={{ marginTop: 12, fontSize: 8, color: '#3a556a', letterSpacing: 0.3 }}>
        Yahoo Finance · BCB{ts && ` · ${ts}`}
      </div>
    </div>
  );
}

void ((_p: Panel) => {})({} as Panel);
