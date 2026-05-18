'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Panel } from '@/types';
import { useTerminal } from '@/hooks/useTerminal';
import { useMarketData, useMarketSymbols, QuoteSnapshot } from '@/store/useMarketData';

interface QuoteData {
  symbol?: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  regularMarketPreviousClose?: number;
  marketCap?: number;
  currency?: string;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  trailingPE?: number;
  dividendYield?: number;
  averageVolume?: number;
}

const n = (v: number | undefined | null, d = 2) =>
  v == null || isNaN(v) ? 'N/A' : v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

const big = (v: number | undefined) => {
  if (v == null) return 'N/A';
  if (v >= 1e12) return (v / 1e12).toFixed(2) + 'T';
  if (v >= 1e9)  return (v / 1e9).toFixed(2)  + 'B';
  if (v >= 1e6)  return (v / 1e6).toFixed(2)  + 'M';
  if (v >= 1e3)  return (v / 1e3).toFixed(0)  + 'K';
  return String(v);
};

const fmtPct = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return '—';
  return (v > 0 ? '+' : '') + v.toFixed(2) + '%';
};

function pctStyle(v: number | null | undefined): React.CSSProperties {
  if (v == null) return { color: '#5a7a9a' };
  return v >= 0
    ? { color: '#00c076', background: 'rgba(0,192,118,0.09)', borderRadius: 2, padding: '1px 3px' }
    : { color: '#ff3b5c', background: 'rgba(255,59,92,0.09)',  borderRadius: 2, padding: '1px 3px' };
}

const varCol = (v: number | null | undefined) =>
  v == null ? '#5a7a9a' : v >= 0 ? '#00c076' : '#ff3b5c';

function Field({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="row" style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '4px 0', borderBottom: '1px solid #1a2535', fontSize: 11,
    }}>
      <span style={{ color: '#5a7a9a' }}>{label}</span>
      <span style={{ color: color ?? '#d4dce8', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function Loading() {
  return (
    <div style={{ padding: 14, color: '#f7941d', fontSize: 11 }}>
      <span className="blink">● CARREGANDO...</span>
    </div>
  );
}
function Err({ msg }: { msg: string }) {
  return <div style={{ padding: 14, color: '#ff3b5c', fontSize: 11 }}>{msg}</div>;
}

// ── WATCHLIST ─────────────────────────────────────────────────────────────────

// TICKER | PREÇO | DIA% | SEM% | MÊS% | YTD% | ×
const WL_GRID = '1fr 48px 40px 40px 40px 40px 14px';

interface PerfRow { varWeek: number | null; varMonth: number | null; varYTD: number | null }

const GROUPS: { label: string; symbols: string[] }[] = [
  { label: 'HB MÉDIA/ALTA',  symbols: ['CYRE3','EZTC3','EVEN3','TRIS3','LAVV3','JHSF3','MTRE3','MELK3','MDNE3','GFSA3'] },
  { label: 'HB BAIXA RENDA', symbols: ['MRVE3','DIRR3','PLPL3','CURY3','TEND3'] },
  { label: 'SHOPPINGS',      symbols: ['MULT3','IGTI11','ALOS3'] },
];

function GroupSeparator({ label }: { label: string }) {
  return (
    <div style={{
      padding: '5px 0 2px', marginTop: 2, borderTop: '1px solid #1a2535',
      fontSize: 8, letterSpacing: 1, color: '#4a5f75',
    }}>{label}</div>
  );
}

function AvgRow({ syms, quotes, perfMap }: {
  syms: string[];
  quotes: Record<string, QuoteSnapshot>;
  perfMap: Record<string, PerfRow>;
}) {
  const avg = (vals: (number | null | undefined)[]) => {
    const ok = vals.filter((v): v is number => v != null && !isNaN(v));
    return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
  };
  const keys = syms.map(s => s.replace(/\.SA$/i, ''));
  const d = avg(keys.map(k => quotes[k]?.changePct));
  const w = avg(keys.map(k => perfMap[k]?.varWeek));
  const m = avg(keys.map(k => perfMap[k]?.varMonth));
  const y = avg(keys.map(k => perfMap[k]?.varYTD));

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: WL_GRID,
      gap: 2, height: 20, borderBottom: '1px solid #1a2535',
      fontSize: 9, alignItems: 'center',
    }}>
      <span style={{ color: '#f7941d', fontWeight: 700, fontSize: 9 }}>MÉDIA</span>
      <span />
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, ...pctStyle(d) }}>
        {fmtPct(d)}
      </span>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: varCol(w) }}>
        {fmtPct(w)}
      </span>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: varCol(m) }}>
        {fmtPct(m)}
      </span>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: varCol(y) }}>
        {fmtPct(y)}
      </span>
      <span />
    </div>
  );
}

function StockRow({ sym, quotes, perfRow, runCommand, removeFromWatchlist }: {
  sym: string;
  quotes: Record<string, QuoteSnapshot>;
  perfRow?: PerfRow;
  runCommand: (cmd: string) => { success: boolean };
  removeFromWatchlist: (sym: string) => void;
}) {
  const key = sym.replace(/\.SA$/i, '');
  const q   = quotes[key];
  const pct = q?.changePct ?? null;
  return (
    <div className="row" style={{
      display: 'grid', gridTemplateColumns: WL_GRID,
      gap: 2, height: 20, borderBottom: '1px solid #1a2535',
      fontSize: 9, alignItems: 'center',
    }}>
      <span
        onClick={() => runCommand(`${key} GP`)}
        title={`Abrir gráfico de ${key}`}
        style={{ color: '#f7941d', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}
      >{key}</span>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#d4dce8', fontSize: 10 }}>
        {q ? n(q.price) : '—'}
      </span>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, ...pctStyle(pct) }}>
        {fmtPct(pct)}
      </span>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: varCol(perfRow?.varWeek) }}>
        {fmtPct(perfRow?.varWeek)}
      </span>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: varCol(perfRow?.varMonth) }}>
        {fmtPct(perfRow?.varMonth)}
      </span>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: varCol(perfRow?.varYTD) }}>
        {fmtPct(perfRow?.varYTD)}
      </span>
      <button
        onClick={() => removeFromWatchlist(sym)}
        title={`Remover ${key}`}
        style={{
          background: 'none', border: 'none', color: '#3a556a',
          fontSize: 13, cursor: 'pointer', lineHeight: 1,
          padding: 0, fontFamily: 'inherit', textAlign: 'center',
          transition: 'color 0.1s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ff3b5c'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#3a556a'; }}
      >×</button>
    </div>
  );
}

function WatchlistPanel() {
  const { watchlist, addToWatchlist, removeFromWatchlist, runCommand } = useTerminal();
  const quotes = useMarketData(s => s.quotes);
  useMarketSymbols(watchlist);

  const [adding,     setAdding]     = useState(false);
  const [input,      setInput]      = useState('');
  const [addErr,     setAddErr]     = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [perfMap,    setPerfMap]    = useState<Record<string, PerfRow>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  type WLSortKey = 'ticker' | 'price' | 'day' | 'week' | 'month' | 'ytd';
  const [sortKey,  setSortKey]  = useState<WLSortKey | null>(null);
  const [sortDir,  setSortDir]  = useState<'desc' | 'asc'>('desc');
  const [hoverCol, setHoverCol] = useState<WLSortKey | null>(null);

  const handleSort = (key: WLSortKey) => {
    if (sortKey === key) {
      if (sortDir === 'desc') setSortDir('asc');
      else { setSortKey(null); setSortDir('desc'); }
    } else { setSortKey(key); setSortDir('desc'); }
  };

  const wlKey = watchlist.join(',');
  useEffect(() => {
    const syms = watchlist.map(s => s.replace(/\.SA$/i, ''));
    if (!syms.length) return;
    let cancelled = false;
    const load = async () => {
      const results = await Promise.allSettled(
        syms.map(sym => fetch(`/api/perf/${sym}`).then(r => r.json()).catch(() => null))
      );
      if (cancelled) return;
      const map: Record<string, PerfRow> = {};
      results.forEach((r, i) => {
        const d = r.status === 'fulfilled' ? r.value : null;
        if (d && typeof d === 'object') map[syms[i]] = d as PerfRow;
      });
      setPerfMap(map);
    };
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wlKey]);

  useEffect(() => {
    if (adding) setTimeout(() => inputRef.current?.focus(), 0);
  }, [adding]);

  const cancelAdd = () => { setAdding(false); setInput(''); setAddErr(null); };

  const validateAndAdd = async () => {
    const sym = input.trim().toUpperCase();
    if (!sym) { cancelAdd(); return; }
    if (watchlist.includes(sym)) { setAddErr(`"${sym}" já está na watchlist`); return; }
    setValidating(true); setAddErr(null);
    try {
      const r = await fetch(`/api/quote/${sym}`);
      const d = await r.json();
      if (r.ok && !d.error && d.regularMarketPrice != null) {
        addToWatchlist(sym); setInput(''); setAdding(false);
      } else { setAddErr(`"${sym}" não encontrado`); }
    } catch { setAddErr('Erro de conexão'); }
    finally  { setValidating(false); }
  };

  const sortFn = useCallback((a: string, b: string): number => {
    if (!sortKey) return 0;
    const ka = a.replace(/\.SA$/i, '');
    const kb = b.replace(/\.SA$/i, '');
    if (sortKey === 'ticker') {
      const r = ka.localeCompare(kb);
      return sortDir === 'desc' ? -r : r;
    }
    let va: number | null = null;
    let vb: number | null = null;
    if (sortKey === 'price') {
      va = quotes[ka]?.price ?? null;
      vb = quotes[kb]?.price ?? null;
    } else if (sortKey === 'day') {
      va = quotes[ka]?.changePct ?? null;
      vb = quotes[kb]?.changePct ?? null;
    } else {
      const field = sortKey === 'week' ? 'varWeek' : sortKey === 'month' ? 'varMonth' : 'varYTD';
      va = perfMap[ka]?.[field] ?? null;
      vb = perfMap[kb]?.[field] ?? null;
    }
    if (va == null && vb == null) return 0;
    if (va == null) return 1; if (vb == null) return -1;
    return sortDir === 'desc' ? vb - va : va - vb;
  }, [sortKey, sortDir, quotes, perfMap]);

  const { groupedItems, others } = useMemo(() => {
    const wlSet = new Set(watchlist.map(s => s.toUpperCase()));
    const seen  = new Set<string>();
    const groupedItems = GROUPS
      .map(g => ({ label: g.label, symbols: g.symbols.filter(s => wlSet.has(s)) }))
      .filter(g => g.symbols.length > 0);
    groupedItems.forEach(g => g.symbols.forEach(s => seen.add(s)));
    const others = watchlist.filter(s => !seen.has(s.toUpperCase()));
    return { groupedItems, others };
  }, [watchlist]);

  const sortedGroups = useMemo(
    () => groupedItems.map(g => ({ ...g, symbols: [...g.symbols].sort(sortFn) })),
    [groupedItems, sortFn]
  );
  const sortedOthers = useMemo(() => [...others].sort(sortFn), [others, sortFn]);

  const COLS: [WLSortKey, string, boolean][] = [
    ['ticker', 'TICKER', false],
    ['price',  'PREÇO',  true],
    ['day',    'DIA%',   true],
    ['week',   'SEM%',   true],
    ['month',  'MÊS%',   true],
    ['ytd',    'YTD%',   true],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {adding && (
        <div style={{
          padding: '5px 10px', borderBottom: '1px solid #1a2535',
          background: '#060b12', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value.toUpperCase()); setAddErr(null); }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter')  { e.preventDefault(); validateAndAdd(); }
                if (e.key === 'Escape') cancelAdd();
              }}
              onKeyUp={(e)    => e.stopPropagation()}
              onKeyPress={(e) => e.stopPropagation()}
              disabled={validating}
              placeholder="TICKER..."
              style={{
                background: '#080c14', border: '1px solid #1a2535',
                color: '#d4dce8', fontSize: 11, padding: '2px 6px',
                fontFamily: 'inherit', width: 80, outline: 'none', borderRadius: 2,
              }}
            />
            {validating ? (
              <span style={{ color: '#f7941d', fontSize: 10 }}>verificando…</span>
            ) : (
              <button
                onClick={validateAndAdd}
                style={{
                  background: '#f7941d', border: 'none', color: '#080c14',
                  fontSize: 10, padding: '2px 6px', cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 700, borderRadius: 2,
                }}
              >OK</button>
            )}
            <button
              onClick={cancelAdd}
              style={{
                background: 'none', border: 'none', color: '#3a556a',
                fontSize: 14, cursor: 'pointer', lineHeight: 1, padding: 0,
              }}
            >×</button>
          </div>
          {addErr && <div style={{ color: '#ff3b5c', fontSize: 10, marginTop: 2 }}>{addErr}</div>}
        </div>
      )}

      {/* Column headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: WL_GRID,
        gap: 2, padding: '3px 10px', borderBottom: '1px solid #1a2535',
        fontSize: 8, letterSpacing: 0.8, flexShrink: 0, alignItems: 'center',
      }}>
        {COLS.map(([col, label, right]) => (
          <span
            key={col}
            onClick={() => handleSort(col)}
            onMouseEnter={() => setHoverCol(col)}
            onMouseLeave={() => setHoverCol(null)}
            style={{
              textAlign: right ? 'right' : 'left',
              cursor: 'pointer', userSelect: 'none',
              color: sortKey === col ? '#f7941d' : hoverCol === col ? '#c8d4e0' : '#8ba4bc',
            }}
          >{label}{sortKey === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}</span>
        ))}
        <button
          onClick={() => setAdding((v) => !v)}
          title="Adicionar ticker"
          style={{
            background: 'none',
            border: `1px solid ${adding ? 'rgba(247,148,29,0.4)' : '#1a2535'}`,
            color: adding ? '#f7941d' : '#5a7a9a',
            fontSize: 10, cursor: 'pointer', lineHeight: 1,
            padding: '0 2px', fontFamily: 'inherit', borderRadius: 2,
          }}
        >+</button>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 10px' }}>

        {/* Ungrouped (user-added stocks not in any group) */}
        {sortedOthers.length > 0 && (
          <>
            {sortedOthers.map(sym => (
              <StockRow
                key={sym} sym={sym} quotes={quotes}
                perfRow={perfMap[sym.replace(/\.SA$/i, '')]}
                runCommand={runCommand} removeFromWatchlist={removeFromWatchlist}
              />
            ))}
            <AvgRow syms={sortedOthers} quotes={quotes} perfMap={perfMap} />
          </>
        )}

        {/* Predefined groups */}
        {sortedGroups.map(g => (
          <div key={g.label}>
            <GroupSeparator label={g.label} />
            {g.symbols.map(sym => (
              <StockRow
                key={sym} sym={sym} quotes={quotes}
                perfRow={perfMap[sym.replace(/\.SA$/i, '')]}
                runCommand={runCommand} removeFromWatchlist={removeFromWatchlist}
              />
            ))}
            <AvgRow syms={g.symbols} quotes={quotes} perfMap={perfMap} />
          </div>
        ))}

        {watchlist.length === 0 && (
          <div style={{ padding: '10px 0', color: '#3a556a', fontSize: 10 }}>
            Watchlist vazia. [+] para adicionar.
          </div>
        )}
      </div>
    </div>
  );
}

// ── SINGLE-QUOTE ──────────────────────────────────────────────────────────────

export default function QuotePanel({ panel }: { panel: Panel }) {
  const isAllQ = panel.func === 'ALLQ';

  const [quote,   setQuote]   = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (isAllQ || !panel.symbol) return;
    let cancelled = false;
    const go = async () => {
      setLoading(true); setError(null);
      try {
        const r = await fetch(`/api/quote/${panel.symbol}`);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        if (!cancelled) setQuote(await r.json());
      } catch { if (!cancelled) setError('Erro ao carregar cotação'); }
      finally  { if (!cancelled) setLoading(false); }
    };
    go();
    const id = setInterval(go, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [panel.symbol, isAllQ]);

  if (isAllQ) return <WatchlistPanel />;
  if (loading) return <Loading />;
  if (error)   return <Err msg={error} />;
  if (!quote)  return null;

  const chg    = quote.regularMarketChange ?? 0;
  const chgPct = quote.regularMarketChangePercent ?? 0;
  const pos    = chg >= 0;
  const highlight = panel.func === 'MKTCAP' ? 'marketCap' : null;

  return (
    <div style={{ padding: '10px 14px' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
          <span style={{ color: '#f7941d', fontSize: 15, fontWeight: 700 }}>
            {String(quote.symbol ?? panel.symbol ?? '').replace(/\.SA$/i, '')}
          </span>
          {quote.shortName && (
            <span style={{ color: '#5a7a9a', fontSize: 11 }}>{quote.shortName}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 22, letterSpacing: -0.5, color: '#d4dce8' }}>{n(quote.regularMarketPrice)}</span>
          <span style={{
            fontSize: 13,
            color: pos ? '#00c076' : '#ff3b5c',
            background: pos ? 'rgba(0,192,118,0.09)' : 'rgba(255,59,92,0.09)',
            borderRadius: 3, padding: '1px 5px',
          }}>
            {pos ? '+' : ''}{n(chg)} ({pos ? '+' : ''}{n(chgPct)}%)
          </span>
        </div>
        <div style={{ color: '#3a556a', fontSize: 10, marginTop: 3 }}>
          {quote.currency ?? 'BRL'} · {quote.symbol ?? ''}
        </div>
      </div>

      <div style={{ borderTop: '1px solid #1a2535', paddingTop: 4 }}>
        <Field label="ABERTURA"       value={n(quote.regularMarketOpen)} />
        <Field label="MÁXIMA DIA"     value={n(quote.regularMarketDayHigh)} />
        <Field label="MÍNIMA DIA"     value={n(quote.regularMarketDayLow)} />
        <Field label="FECH. ANTERIOR" value={n(quote.regularMarketPreviousClose)} />
        <Field label="VOLUME"         value={big(quote.regularMarketVolume)} />
        <Field label="VOL. MÉDIO"     value={big(quote.averageVolume)} />
        <Field
          label="MARKET CAP"
          value={big(quote.marketCap)}
          color={highlight === 'marketCap' ? '#f7941d' : undefined}
        />
        <Field label="52S MÁXIMA" value={n(quote.fiftyTwoWeekHigh)} />
        <Field label="52S MÍNIMA" value={n(quote.fiftyTwoWeekLow)} />
        {quote.trailingPE    != null && <Field label="P/L"        value={n(quote.trailingPE)} />}
        {quote.dividendYield != null && <Field label="DIV. YIELD" value={`${n(quote.dividendYield * 100)}%`} />}
      </div>
    </div>
  );
}
