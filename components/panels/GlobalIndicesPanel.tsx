'use client';
import { Panel } from '@/types';
import { useMarketData, useMarketSymbols, type GlobalIndexEntry } from '@/store/useMarketData';

// ── Value formatter ───────────────────────────────────────────────────────────
function fmtVal(v: number | null): string {
  if (v == null) return '—';
  if (v >= 10_000) return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  if (v >= 100)    return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function fmtPct(v: number | null): string {
  if (v == null) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

function pctStyle(v: number | null): React.CSSProperties {
  if (v == null) return { color: '#5a7a9a' };
  return v >= 0
    ? { color: '#00c076', background: 'rgba(0,192,118,0.09)', borderRadius: 2, padding: '1px 3px' }
    : { color: '#ff3b5c', background: 'rgba(255,59,92,0.09)', borderRadius: 2, padding: '1px 3px' };
}

// ── Shared column layout (both halves identical) ──────────────────────────────
const COLS = '1fr 68px 54px 54px';

function ColLabel({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase' as const,
      color: '#8ba4bc', padding: '4px 0 2px',
    }}>{label}</div>
  );
}

function TableHeader() {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: COLS,
      gap: 4, height: 16, alignItems: 'center',
      fontSize: 7, color: '#8ba4bc', letterSpacing: 0.5,
      borderBottom: '1px solid #1a2535',
    }}>
      <span>NOME</span>
      <span style={{ textAlign: 'right' }}>VALOR</span>
      <span style={{ textAlign: 'right' }}>DIA%</span>
      <span style={{ textAlign: 'right' }}>SEM%</span>
    </div>
  );
}

function IndexRow({ entry }: { entry: GlobalIndexEntry }) {
  return (
    <div className="row" style={{
      display: 'grid', gridTemplateColumns: COLS,
      gap: 4, height: 22, alignItems: 'center',
      borderBottom: '1px solid #1a2535',
    }}>
      <span style={{ color: '#8ba4bc', fontSize: 10, letterSpacing: 0.2 }}>{entry.label}</span>
      <span style={{
        textAlign: 'right', color: '#d4dce8',
        fontVariantNumeric: 'tabular-nums', fontSize: 11, fontWeight: 500,
      }}>
        {fmtVal(entry.price)}
      </span>
      <span style={{
        textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 10,
        ...pctStyle(entry.changePct),
      }}>
        {fmtPct(entry.changePct)}
      </span>
      <span style={{
        textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 10,
        ...pctStyle(entry.weekPct),
      }}>
        {fmtPct(entry.weekPct)}
      </span>
    </div>
  );
}

export default function GlobalIndicesPanel({ panel: _panel }: { panel: Panel }) {
  useMarketSymbols([]); // ensures global polling starts
  const { brasil, global, updatedAt } = useMarketData();
  const loading = brasil.length === 0 && global.length === 0;

  if (loading) return (
    <div style={{ padding: 14, color: '#f7941d', fontSize: 11 }}>
      <span className="blink">● CARREGANDO ÍNDICES...</span>
    </div>
  );

  const ts = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%', overflow: 'hidden' }}>

      {/* ── LEFT: BRASIL ──────────────────────────────────────────── */}
      <div style={{
        borderRight: '1px solid #1a2535',
        overflowY: 'auto',
        padding: '4px 10px 8px 12px',
      }}>
        <ColLabel label="Brasil" />
        <TableHeader />
        {brasil.length === 0
          ? <div style={{ color: '#3a556a', fontSize: 10, padding: '4px 0' }}>—</div>
          : brasil.map(e => <IndexRow key={e.label} entry={e} />)
        }
      </div>

      {/* ── RIGHT: GLOBAL ─────────────────────────────────────────── */}
      <div style={{ overflowY: 'auto', padding: '4px 12px 8px 10px' }}>
        <ColLabel label="Global" />
        <TableHeader />
        {global.length === 0
          ? <div style={{ color: '#3a556a', fontSize: 10, padding: '4px 0' }}>—</div>
          : global.map(e => <IndexRow key={e.label} entry={e} />)
        }

        {ts && (
          <div style={{ marginTop: 8, fontSize: 7, color: '#3a556a' }}>
            Yahoo Finance · Brapi · {ts}
          </div>
        )}
      </div>
    </div>
  );
}
