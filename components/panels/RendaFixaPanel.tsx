'use client';
import { useState, useEffect } from 'react';
import { Panel } from '@/types';
import type { DiContract } from '@/app/api/di/route';
import type { TdBond } from '@/app/api/macro/route';

interface ExchangeRow {
  label:     string;
  price:     number | null;
  change:    number | null;
  changePct: number | null;
}
interface MacroData {
  exchange:      ExchangeRow[];
  rates:         { selic: number | null; cdi: number | null; ipca12m: number | null };
  tesouroDireto: TdBond[];
  updatedAt:     string;
}
interface FocusNext {
  selic: number | null;
  ipca:  number | null;
  pib:   number | null;
}

const pctCol = (v: number | null) =>
  v == null ? '#3a556a' : v >= 0 ? '#00c076' : '#ff3b5c';

function SubLabel({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 8, letterSpacing: 1.2, textTransform: 'uppercase' as const,
      color: '#5a7a9a', padding: '5px 0 2px',
    }}>{text}</div>
  );
}

function HRule() {
  return <div style={{ height: 1, background: '#1a2535', margin: '3px 0' }} />;
}

function FxRow({ row }: { row: ExchangeRow }) {
  const pos = (row.changePct ?? 0) >= 0;
  return (
    <div className="row" style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      height: 22, borderBottom: '1px solid #1a2535',
    }}>
      <span style={{ color: '#5a7a9a', fontSize: 10 }}>{row.label}</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'baseline' }}>
        <span style={{
          color: '#d4dce8', fontSize: 13, fontWeight: 500,
          fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3,
        }}>
          {row.price == null ? '—' : row.price.toFixed(2)}
        </span>
        <span style={{
          fontSize: 9, color: pctCol(row.changePct),
          fontVariantNumeric: 'tabular-nums',
        }}>
          {row.changePct == null
            ? ''
            : `${pos ? '▲' : '▼'}${Math.abs(row.changePct).toFixed(2)}%`}
        </span>
      </div>
    </div>
  );
}

function JurosRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="row" style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      height: 22, borderBottom: '1px solid #1a2535',
    }}>
      <span style={{ color: '#5a7a9a', fontSize: 10 }}>{label}</span>
      <span style={{ color: '#f7941d', fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
}

const NTNB_COLS = '1fr 32px 52px 36px';

function NtnbRow({ b }: { b: TdBond }) {
  const isJuros = b.title.toLowerCase().includes('juros');
  const year    = b.maturity.length >= 4 ? b.maturity.slice(0, 4) : b.maturity;
  return (
    <div className="row" style={{
      display: 'grid', gridTemplateColumns: NTNB_COLS,
      gap: 3, height: 22, alignItems: 'center',
      borderBottom: '1px solid #1a2535',
    }}>
      <span style={{
        color: b.isReference ? '#5a7a9a' : '#d4dce8', fontSize: 10,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {isJuros ? 'IPCA+J' : 'IPCA+'} {year}
      </span>
      <span style={{ textAlign: 'right', color: '#3a556a', fontSize: 9 }}>{year}</span>
      <span style={{
        textAlign: 'right', fontWeight: 600, fontSize: 10,
        fontVariantNumeric: 'tabular-nums',
        color: b.isReference ? '#8ba4bc' : '#f7941d',
      }}>
        {b.rate > 0 ? `${b.rate.toFixed(2)}%` : '—'}
      </span>
      <span style={{ textAlign: 'right', color: '#3a556a', fontSize: 9 }}>—</span>
    </div>
  );
}

const DI_COLS = '40px 54px 46px 1fr';

function DiRow({ c, maxRate }: { c: DiContract; maxRate: number }) {
  const barW   = maxRate > 0 && c.rate != null ? (c.rate / maxRate) * 100 : 0;
  const dayCol = pctCol(c.varDay);
  return (
    <div className="row" style={{
      display: 'grid', gridTemplateColumns: DI_COLS,
      gap: 4, height: 22, alignItems: 'center',
      borderBottom: '1px solid #1a2535',
    }}>
      <span style={{ color: '#5a7a9a', fontSize: 10 }}>
        {c.maturity}
        {c.isReference && (
          <span style={{ fontSize: 6, color: '#3a556a', marginLeft: 3 }}>●</span>
        )}
      </span>
      <span style={{
        textAlign: 'right', color: '#f7941d', fontWeight: 600,
        fontVariantNumeric: 'tabular-nums', fontSize: 10,
      }}>
        {c.rate != null ? `${c.rate.toFixed(2)}%` : '—'}
      </span>
      <span style={{
        textAlign: 'right', color: dayCol,
        fontVariantNumeric: 'tabular-nums', fontSize: 9,
      }}>
        {c.varDay == null ? '—' : `${c.varDay >= 0 ? '+' : ''}${c.varDay.toFixed(2)}%`}
      </span>
      <div style={{ paddingLeft: 3, alignSelf: 'center' }}>
        <div style={{ height: 3, background: '#1a2535', borderRadius: 2 }}>
          <div style={{
            height: 3,
            width: `${barW}%`,
            background: c.isReference ? 'rgba(247,148,29,0.45)' : '#f7941d',
            borderRadius: 2,
          }} />
        </div>
      </div>
    </div>
  );
}

const MATURITY_MAP: Record<string, string> = {
  DI1F27: 'Jan/27', DI1F28: 'Jan/28', DI1F29: 'Jan/29',
  DI1F30: 'Jan/30', DI1F31: 'Jan/31', DI1F32: 'Jan/32',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseB3DiItem(item: any): DiContract | null {
  const sym = String(item.symbol ?? item.cd ?? item.codigoNegociacao ?? '');
  if (!MATURITY_MAP[sym]) return null;
  const rate = item.tradeRate ?? item.lastTrade ?? item.ultimoPreco ?? item.rate ?? null;
  const varDay = item.changePercent ?? item.variacao ?? item.oscilation ?? null;
  return {
    symbol:      sym,
    maturity:    MATURITY_MAP[sym],
    rate:        rate != null ? +Number(rate).toFixed(2) : null,
    varDay:      varDay != null ? +Number(varDay).toFixed(2) : null,
    isReference: false,
  };
}

export default function RendaFixaPanel({ panel: _panel }: { panel: Panel }) {
  const [diCurve,   setDiCurve]   = useState<DiContract[]>([]);
  const [macro,     setMacro]     = useState<MacroData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [updatedAt, setUpdatedAt] = useState('');

  const [diLive,    setDiLive]    = useState<DiContract[] | null>(null);
  const [diTried,   setDiTried]   = useState(false);
  const [focusNext, setFocusNext] = useState<FocusNext | null>(null);

  // Server-side data (Focus-derived fallbacks)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [diRes, macroRes] = await Promise.all([
        fetch('/api/di').then(r => r.json()).catch(() => []),
        fetch('/api/macro').then(r => r.json()).catch(() => ({})),
      ]);
      if (!cancelled) {
        if (Array.isArray(diRes)) setDiCurve(diRes);
        if (macroRes && !macroRes.error) {
          setMacro(macroRes as MacroData);
          setUpdatedAt((macroRes as MacroData).updatedAt ?? '');
        }
        setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Client-side B3 DI futures
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(
          'https://sistemaswebb3-derivativos.b3.com.br/futures-proxy/futures/DI1'
        );
        if (!r.ok) { setDiTried(true); return; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await r.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: any[] = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
        if (!items.length) { setDiTried(true); return; }
        const contracts = items
          .map(parseB3DiItem)
          .filter((c): c is DiContract => c != null)
          .sort((a, b) => a.symbol.localeCompare(b.symbol));
        if (contracts.length) setDiLive(contracts);
        setDiTried(true);
      } catch { setDiTried(true); }
    };
    load();
  }, []);

  // BCB Focus — próximo ano
  useEffect(() => {
    const nextYear = new Date().getFullYear() + 1;
    const fetchIndicator = async (indicator: string): Promise<number | null> => {
      try {
        const r = await fetch(
          `https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais` +
          `?$filter=Indicador%20eq%20'${encodeURIComponent(indicator)}'` +
          `%20and%20DataReferencia%20eq%20'${nextYear}'%20and%20baseCalculo%20eq%200` +
          `&$orderby=Data%20desc&$top=1&$format=json&$select=Mediana`
        );
        if (!r.ok) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json: any = await r.json();
        const val = json?.value?.[0]?.Mediana;
        return val != null ? parseFloat(String(val).replace(',', '.')) : null;
      } catch { return null; }
    };

    Promise.all([
      fetchIndicator('Selic'),
      fetchIndicator('IPCA'),
      fetchIndicator('PIB Total'),
    ]).then(([selic, ipca, pib]) => {
      setFocusNext({ selic, ipca, pib });
    });
  }, []);

  if (loading) return (
    <div style={{ padding: 14, color: '#f7941d', fontSize: 11 }}>
      <span className="blink">● CARREGANDO...</span>
    </div>
  );

  const exchange     = macro?.exchange ?? [];
  const rates        = macro?.rates;
  const ntnbBonds    = macro?.tesouroDireto ?? [];
  const displayDi    = diLive ?? diCurve;
  const maxRate      = displayDi.length
    ? Math.max(...displayDi.map(c => c.rate ?? 0))
    : 15;
  const ts = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';
  const nextYear = new Date().getFullYear() + 1;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%', overflow: 'hidden' }}>

      {/* ── LEFT: CÂMBIO + JUROS + NTN-B ────────────────────────── */}
      <div style={{
        borderRight: '1px solid #1a2535',
        overflowY: 'auto',
        padding: '4px 10px 8px 12px',
      }}>
        <SubLabel text="Câmbio" />
        {exchange.length === 0
          ? <div style={{ color: '#3a556a', fontSize: 10, height: 22, display: 'flex', alignItems: 'center' }}>Carregando…</div>
          : exchange.map(row => <FxRow key={row.label} row={row} />)
        }

        <HRule />

        <SubLabel text="Juros & Inflação" />
        <JurosRow label="SELIC"
          value={rates ? `${(rates.selic   ?? 0).toFixed(2)}% a.a.` : '—'} />
        <JurosRow label="CDI"
          value={rates ? `${(rates.cdi     ?? 0).toFixed(2)}% a.a.` : '—'} />
        <JurosRow label="IPCA"
          value={rates ? `${(rates.ipca12m ?? 0).toFixed(2)}% 12m` : '—'} />

        <HRule />

        <SubLabel text="NTN-B — IPCA+" />
        <div style={{
          display: 'grid', gridTemplateColumns: NTNB_COLS,
          gap: 3, height: 16, alignItems: 'center',
          fontSize: 7, color: '#8ba4bc', letterSpacing: 0.5,
          borderBottom: '1px solid #1a2535',
        }}>
          <span>TÍTULO</span>
          <span style={{ textAlign: 'right' }}>ANO</span>
          <span style={{ textAlign: 'right' }}>TAXA</span>
          <span style={{ textAlign: 'right' }}>DIA</span>
        </div>
        {ntnbBonds.length === 0
          ? <div style={{ color: '#3a556a', fontSize: 10, padding: '4px 0' }}>—</div>
          : ntnbBonds.map(b => <NtnbRow key={b.title} b={b} />)
        }

        {ts && (
          <div style={{ marginTop: 8, fontSize: 7, color: '#3a556a' }}>
            atualizado {ts}
          </div>
        )}
      </div>

      {/* ── RIGHT: SELIC ESPERADA + FOCUS PRÓXIMO ANO ──────────── */}
      <div style={{ overflowY: 'auto', padding: '4px 12px 8px 10px' }}>
        <SubLabel text="SELIC Esperada — Focus BCB" />
        <div style={{ fontSize: 7, color: '#3a556a', marginBottom: 4, lineHeight: 1.4 }}>
          Expectativa mediana do mercado para SELIC no fim de cada ano (Boletim Focus/BCB)
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: DI_COLS,
          gap: 4, height: 16, alignItems: 'center',
          fontSize: 7, color: '#8ba4bc', letterSpacing: 0.5,
          borderBottom: '1px solid #1a2535',
        }}>
          <span>VENC</span>
          <span style={{ textAlign: 'right' }}>TAXA</span>
          <span style={{ textAlign: 'right' }}>DIA</span>
          <span style={{ paddingLeft: 3 }}>CURVA</span>
        </div>

        {displayDi.length === 0
          ? <div style={{ color: '#3a556a', fontSize: 10, padding: '4px 0' }}>—</div>
          : displayDi.map(c => <DiRow key={c.symbol} c={c} maxRate={maxRate} />)
        }

        <HRule />

        <SubLabel text={`Focus — ${nextYear}`} />
        <JurosRow
          label="SELIC"
          value={focusNext?.selic != null ? `${focusNext.selic.toFixed(2)}% a.a.` : '—'}
        />
        <JurosRow
          label="IPCA"
          value={focusNext?.ipca != null ? `${focusNext.ipca.toFixed(2)}%` : '—'}
        />
        <JurosRow
          label="PIB"
          value={focusNext?.pib != null ? `${focusNext.pib.toFixed(2)}%` : '—'}
        />

        <div style={{ marginTop: 6, fontSize: 7, color: '#3a556a' }}>
          BCB · B3 · Tesouro Direto{ts && ` · ${ts}`}
        </div>
      </div>
    </div>
  );
}
