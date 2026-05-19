'use client';
import { useState, useEffect } from 'react';
import { Panel } from '@/types';

interface ExchangeRow {
  label:     string;
  price:     number | null;
  change:    number | null;
  changePct: number | null;
}

interface Snapshot {
  price:     number | null;
  change:    number | null;
  changePct: number | null;
}

interface MacroData {
  exchange:  ExchangeRow[];
  rates:     { selic: number | null; cdi: number | null; ipca12m: number | null };
  jurosUS?:  { fedFunds: number | null; tbill3m: Snapshot; tbond10y: Snapshot };
  jurosEU?:  { ecb: number | null; bund2y: Snapshot; bund10y: Snapshot };
  reits?:    Array<{ label: string } & Snapshot>;
  euIndices?: Array<{ label: string } & Snapshot>;
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

// Bond yield line: label | yield% | ±bps change
function YieldLine({ label, snap, isPolicy }: { label: string; snap?: Snapshot; isPolicy?: boolean }) {
  const rate = snap?.price;
  // Yahoo bond yields: change is in points (e.g. -0.03 = -3bps), bps = change * 100
  const bps  = snap?.change != null ? Math.round(snap.change * 100) : null;
  const pos  = (bps ?? 0) >= 0;
  const color = isPolicy ? '#f7941d' : (bps == null ? '#5a7a9a' : pos ? '#00c076' : '#ff3b5c');

  return (
    <div className="row" style={{
      display: 'grid', gridTemplateColumns: '100px 1fr auto',
      gap: 8, padding: '4px 0', borderBottom: '1px solid #1a2535',
      alignItems: 'center', fontSize: 11,
    }}>
      <span style={{ color: '#5a7a9a', fontSize: 10 }}>{label}</span>
      <span style={{ color: isPolicy ? '#f7941d' : '#d4dce8', fontVariantNumeric: 'tabular-nums', fontWeight: isPolicy ? 600 : 400 }}>
        {rate == null ? 'N/A' : `${rate.toFixed(2)}%`}
      </span>
      <span style={{
        color, fontSize: 9, fontVariantNumeric: 'tabular-nums',
        minWidth: 44, textAlign: 'right',
      }}>
        {bps == null ? '' : `${bps >= 0 ? '+' : ''}${bps}bps`}
      </span>
    </div>
  );
}

// Index/price line: label | price | changePct%
function IndexLine({ label, snap }: { label: string; snap?: Snapshot }) {
  const pos   = (snap?.changePct ?? 0) >= 0;
  const color = snap?.changePct == null ? '#5a7a9a' : pos ? '#00c076' : '#ff3b5c';
  const pctBg = snap?.changePct == null ? 'transparent' : pos ? 'rgba(0,192,118,0.09)' : 'rgba(255,59,92,0.09)';

  return (
    <div className="row" style={{
      display: 'grid', gridTemplateColumns: '72px 1fr auto',
      gap: 8, padding: '4px 0', borderBottom: '1px solid #1a2535',
      alignItems: 'center', fontSize: 11,
    }}>
      <span style={{ color: '#5a7a9a', fontSize: 10 }}>{label}</span>
      <span style={{ color: '#d4dce8', fontVariantNumeric: 'tabular-nums' }}>
        {snap?.price == null ? 'N/A' : fmtPrice(snap.price, 0)}
      </span>
      <span style={{
        color, fontSize: 10, fontWeight: 600,
        background: pctBg, borderRadius: 2, padding: '1px 4px',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {snap?.changePct == null ? '' : `${pos ? '+' : ''}${snap.changePct.toFixed(2)}%`}
      </span>
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

      <SectionTitle label="Juros Brasil" />
      <RateLine label="SELIC META" value={fmtRate(data.rates.selic)} />
      <RateLine label="CDI"        value={fmtRate(data.rates.cdi)} />
      <RateLine label="IPCA"       value={fmtIpca(data.rates.ipca12m)} />

      {data.jurosUS && (
        <>
          <SectionTitle label="Juros EUA" />
          <YieldLine label="Fed Funds"  snap={{ price: data.jurosUS.fedFunds, change: null, changePct: null }} isPolicy />
          <YieldLine label="T-Bill 3M"  snap={data.jurosUS.tbill3m} />
          <YieldLine label="T-Bond 10Y" snap={data.jurosUS.tbond10y} />
        </>
      )}

      {data.jurosEU && (
        <>
          <SectionTitle label="Juros Europa" />
          <YieldLine label="BCE"        snap={{ price: data.jurosEU.ecb, change: null, changePct: null }} isPolicy />
          <YieldLine label="Bund 2Y"    snap={data.jurosEU.bund2y} />
          <YieldLine label="Bund 10Y"   snap={data.jurosEU.bund10y} />
        </>
      )}

      {data.reits && data.reits.length > 0 && (
        <>
          <SectionTitle label="REITs" />
          {data.reits.map((r) => (
            <IndexLine key={r.label} label={r.label} snap={r} />
          ))}
        </>
      )}

      {data.euIndices && data.euIndices.length > 0 && (
        <>
          <SectionTitle label="Índices Europa" />
          {data.euIndices.map((r) => (
            <IndexLine key={r.label} label={r.label} snap={r} />
          ))}
        </>
      )}

      <div style={{ marginTop: 12, fontSize: 8, color: '#3a556a', letterSpacing: 0.3 }}>
        Yahoo Finance · BCB{ts && ` · ${ts}`}
      </div>
    </div>
  );
}

void ((_p: Panel) => {})({} as Panel);
