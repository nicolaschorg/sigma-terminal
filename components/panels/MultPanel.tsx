'use client';
import { useState, useEffect } from 'react';
import { Panel } from '@/types';

interface CurrentMultiples {
  pe:      number | null;
  pb:      number | null;
  evEbitda: number | null;
}

interface HistRow {
  quarter:  string;
  pe:       number;
  pb:       number;
  evEbitda: number;
}

const num = (v: number | null, d = 1) =>
  v == null || isNaN(v) ? 'N/A' : v.toFixed(d) + 'x';

// Generate 8 quarters of plausible mock history trending toward current values.
// Uses deterministic "noise" (no Math.random) so values are stable on re-render.
function buildMockHistory(pe: number, pb: number, ev: number): HistRow[] {
  const quarters = [
    'Q2 2023','Q3 2023','Q4 2023','Q1 2024',
    'Q2 2024','Q3 2024','Q4 2024','Q1 2025',
  ];
  // Waves: sin gives repeatable variance per quarter
  const noise = (i: number, amp: number) => Math.sin(i * 1.7 + 0.5) * amp;
  return quarters.map((q, i) => {
    const t = (i + 1) / (quarters.length + 1); // 0→1 over quarters
    return {
      quarter:  q,
      pe:       Math.max(1, +(pe * (0.55 + 0.45 * t) + noise(i, pe * 0.08)).toFixed(1)),
      pb:       Math.max(0.1, +(pb * (0.60 + 0.40 * t) + noise(i + 3, pb * 0.07)).toFixed(2)),
      evEbitda: Math.max(1, +(ev * (0.55 + 0.45 * t) + noise(i + 6, ev * 0.09)).toFixed(1)),
    };
  });
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '3px 0', borderBottom: '1px solid #1a2d42', fontSize: 11,
    }}>
      <span style={{ color: '#7a8fa8' }}>{label}</span>
      <span style={{
        color: highlight ? '#f7941d' : '#c8d4e0',
        fontVariantNumeric: 'tabular-nums', fontWeight: highlight ? 700 : 400,
      }}>{value}</span>
    </div>
  );
}

export default function MultPanel({ panel }: { panel: Panel }) {
  const [current, setCurrent] = useState<CurrentMultiples | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!panel.symbol) return;
    setLoading(true);
    setError(null);

    fetch(`/api/fundamentals/${panel.symbol}`)
      .then(r => r.json())
      .then(d => {
        setCurrent({
          pe:      d.summaryDetail?.trailingPE ?? null,
          pb:      d.defaultKeyStatistics?.priceToBook ?? null,
          evEbitda: d.defaultKeyStatistics?.enterpriseToEbitda ?? null,
        });
      })
      .catch(() => setError('Erro ao carregar múltiplos'))
      .finally(() => setLoading(false));
  }, [panel.symbol]);

  const pe = current?.pe ?? 8;
  const pb = current?.pb ?? 1.5;
  const ev = current?.evEbitda ?? 5;
  const hist = buildMockHistory(pe, pb, ev);

  return (
    <div style={{ padding: 10, overflowY: 'auto', height: '100%' }}>

      {/* Current (real Brapi data) */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          color: '#f7941d', fontSize: 10, letterSpacing: 1.5,
          marginBottom: 5, paddingBottom: 3, borderBottom: '1px solid #1a2d42',
        }}>ATUAL — VIA BRAPI</div>

        {loading ? (
          <div style={{ color: '#f7941d', fontSize: 11 }}>
            <span className="blink">● CARREGANDO...</span>
          </div>
        ) : error ? (
          <div style={{ color: '#ff4757', fontSize: 11 }}>{error}</div>
        ) : (
          <>
            <Row label="P/L TTM"   value={num(current?.pe      ?? null)} highlight />
            <Row label="P/VP"      value={num(current?.pb      ?? null)} highlight />
            <Row label="EV/EBITDA" value={num(current?.evEbitda ?? null)} highlight />
          </>
        )}
      </div>

      {/* Historical mock */}
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 5, paddingBottom: 3, borderBottom: '1px solid #1a2d42',
        }}>
          <span style={{ color: '#f7941d', fontSize: 10, letterSpacing: 1.5 }}>
            HISTÓRICO ESTIMADO
          </span>
          <span style={{
            fontSize: 8, color: '#4a5f75', background: '#1a2d42',
            padding: '1px 5px', borderRadius: 2, letterSpacing: 0.8,
            border: '1px solid #243b52',
          }}>MOCK</span>
        </div>

        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr',
          gap: 4, padding: '3px 0',
          borderBottom: '1px solid #1a2d42',
          fontSize: 9, color: '#4a5f75', letterSpacing: 0.6,
        }}>
          <span>TRIMESTRE</span>
          <span style={{ textAlign: 'right' }}>P/L</span>
          <span style={{ textAlign: 'right' }}>P/VP</span>
          <span style={{ textAlign: 'right' }}>EV/EBITDA</span>
        </div>

        {hist.map((r) => (
          <div key={r.quarter} style={{
            display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr',
            gap: 4, padding: '3px 0',
            borderBottom: '1px solid #1a2d42',
            fontSize: 11,
          }}>
            <span style={{ color: '#7a8fa8' }}>{r.quarter}</span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.pe.toFixed(1)}x</span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.pb.toFixed(2)}x</span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.evEbitda.toFixed(1)}x</span>
          </div>
        ))}

        {/* Current (repeat at bottom) */}
        <div style={{
          display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr',
          gap: 4, padding: '3px 0', marginTop: 1,
          borderBottom: '1px solid #1a2d42',
          fontSize: 11, background: '#111d2e',
        }}>
          <span style={{ color: '#f7941d', fontSize: 9 }}>ATUAL</span>
          <span style={{ textAlign: 'right', color: '#f7941d', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{num(current?.pe      ?? null)}</span>
          <span style={{ textAlign: 'right', color: '#f7941d', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{num(current?.pb      ?? null)}</span>
          <span style={{ textAlign: 'right', color: '#f7941d', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{num(current?.evEbitda ?? null)}</span>
        </div>

        <div style={{ color: '#2a4a6b', fontSize: 9, marginTop: 8, lineHeight: 1.5 }}>
          ⚠ Histórico simulado. Para dados reais, integrar Fundamentus ou Status Invest (scraping) ou provedores pagos (Economatica, Refinitiv).
        </div>
      </div>
    </div>
  );
}
