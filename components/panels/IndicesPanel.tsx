'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Panel } from '@/types';
import { useMarketData, useMarketSymbols } from '@/store/useMarketData';

interface IndexStock {
  symbol:   string;
  price:    number | null;
  varDay:   number | null;
  varWeek:  number | null;
  varMonth: number | null;
  varYTD:   number | null;
}

interface PerfData {
  varWeek:  number | null;
  varMonth: number | null;
  varYTD:   number | null;
}

type HistField = 'varWeek' | 'varMonth' | 'varYTD';

interface EditCell { symbol: string; field: HistField }

const TABS = [
  { key: 'ibov',     label: 'IBOV'  },
  { key: 'ifix',     label: 'IFIX'  },
  { key: 'idiv',     label: 'IDIV'  },
  { key: 'smll',     label: 'SMLL'  },
  { key: 'offshore', label: 'OFFSHORE' },
] as const;
type Tab = typeof TABS[number]['key'];

const OFFSHORE_GROUPS = [
  { label: 'Multifamily US', symbols: ['IRT','ELME','NXRT','CLPR','EQR','AVB','MAA'] },
  { label: 'Multifamily EU', symbols: ['GYC.DE','GRI.L','VARN.SW','YIPS.MC','LEG.DE','TEG.DE'] },
  { label: 'Retail US',      symbols: ['CBL','SPG','O','NNN'] },
  { label: 'Retail EU',      symbols: ['URW.PA','LI.PA','CARM.PA','WHA.AS','ECMPA.AS','DEQ.DE','HMSO.L','SELER.PA'] },
  { label: 'Office US',      symbols: ['DEI','JBGS','ESRT','CTO','BXP'] },
  { label: 'Office EU',      symbols: ['ICAD.PA','GPE.L','LAND.L','BLND.L'] },
  { label: 'Hotel US',       symbols: ['DRH','PK','RLJ','SHO','HST'] },
  { label: 'Hotel EU',       symbols: ['PPH.L','MEL.MC'] },
  { label: 'Industrial EU',  symbols: ['MONT.BR','VGP.BR','WDP.BR','SGRO.L','ARG.PA'] },
  { label: 'Diversificado EU', symbols: ['COL.MC','BRI.MI'] },
  { label: 'Farmland US',    symbols: ['FPI','LAND'] },
  { label: 'Industrial/Infra US', symbols: ['PLD','AMT'] },
] as const;

const OFFSHORE_NAMES: Record<string, string> = {
  IRT:'Independence Realty', ELME:'Elme Communities', NXRT:'NexPoint', CLPR:'Clipper Realty',
  EQR:'Equity Residential', AVB:'AvalonBay', MAA:'Mid-America',
  'GYC.DE':'Grand City', 'GRI.L':'Grainger', 'VARN.SW':'Varia', 'YIPS.MC':'Inversa Prime',
  'LEG.DE':'LEG Immobilien', 'TEG.DE':'TAG Immobilien',
  CBL:'CBL Properties', SPG:'Simon Property', O:'Realty Income', NNN:'NNN REIT',
  'URW.PA':'Unibail', 'LI.PA':'Klepierre', 'CARM.PA':'Carmila', 'VASTN.AS':'Vastned',
  'WHA.AS':'Wereldhave', 'ECMPA.AS':'Eurocommercial', 'DEQ.DE':'Deutsche Euroshop',
  'HMSO.L':'Hammerson', 'SELER.PA':'Selectirente',
  DEI:'Douglas Emmett', JBGS:'JBG Smith', ESRT:'Empire State', CTO:'CTO Realty', BXP:'BXP Inc',
  'ICAD.PA':'Icade', 'GPE.L':'Great Portland', 'LAND.L':'Land Securities', 'BLND.L':'British Land',
  DRH:'DiamondRock', PK:'Park Hotels', RLJ:'RLJ Lodging', SHO:'Sunstone', HST:'Host Hotels',
  'PPH.L':'PPHE Hotels', 'MEL.MC':'Meliá Hotels',
  'MONT.BR':'Montea', 'VGP.BR':'VGP', 'WDP.BR':'WDP', 'SGRO.L':'Segro', 'ARG.PA':'Argan',
  'COL.MC':'Colonial', 'BRI.MI':'Brioschi',
  FPI:'Farmland Partners', LAND:'Gladstone Land',
  PLD:'Prologis', AMT:'American Tower',
};

const OVERRIDE_KEY = 'sigma-idx-overrides';

const fmtPrice = (v: number | null) =>
  v == null || isNaN(v)
    ? 'N/A'
    : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (v: number | null) => {
  if (v == null || isNaN(v)) return '—';
  return (v > 0 ? '+' : '') + v.toFixed(2) + '%';
};

function pctStyle(v: number | null, isOverride?: boolean): React.CSSProperties {
  if (isOverride) return { color: '#f7c559' };
  if (v == null)  return { color: '#5a7a9a' };
  return v >= 0
    ? { color: '#00c076', background: 'rgba(0,192,118,0.09)', borderRadius: 2, padding: '1px 3px' }
    : { color: '#ff3b5c', background: 'rgba(255,59,92,0.09)', borderRadius: 2, padding: '1px 3px' };
}

const varDayCol = (v: number | null) =>
  v == null ? '#5a7a9a' : v >= 0 ? '#00c076' : '#ff3b5c';

// ── VarCell — must be defined OUTSIDE IndicesPanel so React never remounts it ─
interface VarCellProps {
  s:               IndexStock;
  field:           HistField;
  v:               number | null;
  isOverride:      boolean;
  isEditing:       boolean;
  editVal:         string;
  editInputRef:    React.RefObject<HTMLInputElement>;
  onStartEdit:     (sym: string, field: HistField, v: number | null) => void;
  onCommit:        (sym: string, field: HistField) => void;
  onCancel:        () => void;
  onEditValChange: (val: string) => void;
}

function VarCell({
  s, field, v, isOverride, isEditing,
  editVal, editInputRef,
  onStartEdit, onCommit, onCancel, onEditValChange,
}: VarCellProps) {
  if (isEditing) {
    return (
      <input
        ref={editInputRef}
        value={editVal}
        onChange={(e) => onEditValChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter')  onCommit(s.symbol, field);
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={() => onCommit(s.symbol, field)}
        style={{
          width: '100%', background: '#080c14',
          border: '1px solid #f7941d',
          color: '#f7941d', fontSize: 10, fontFamily: 'inherit',
          outline: 'none', textAlign: 'right', padding: '0 3px',
          borderRadius: 2,
        }}
      />
    );
  }

  return (
    <span
      onDoubleClick={() => onStartEdit(s.symbol, field, v)}
      title="Duplo clique para editar"
      style={{
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        fontSize: 10,
        cursor: 'text',
        display: 'block',
        ...pctStyle(v, isOverride),
      }}
    >
      {fmtPct(v)}
      {isOverride && <span style={{ fontSize: 8, marginLeft: 2, opacity: 0.6 }}>*</span>}
    </span>
  );
}

export default function IndicesPanel({ panel: _panel }: { panel: Panel }) {
  const [tab,       setTab]       = useState<Tab>('ibov');
  const [stocks,    setStocks]    = useState<IndexStock[]>([]);
  const [syms,      setSyms]      = useState<string[]>([]);
  const [perfMap,   setPerfMap]   = useState<Map<string, PerfData>>(new Map());
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [editCell,  setEditCell]  = useState<EditCell | null>(null);
  const [editVal,   setEditVal]   = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const symsRef      = useRef<string[]>([]);

  type IdxSortKey = 'ticker' | 'price' | 'day' | 'week' | 'month' | 'ytd';
  const [sortKey,  setSortKey]  = useState<IdxSortKey | null>(null);
  const [sortDir,  setSortDir]  = useState<'desc' | 'asc'>('desc');
  const [hoverCol, setHoverCol] = useState<IdxSortKey | null>(null);

  const handleSort = (key: IdxSortKey) => {
    if (sortKey === key) {
      if (sortDir === 'desc') setSortDir('asc');
      else { setSortKey(null); setSortDir('desc'); }
    } else { setSortKey(key); setSortDir('desc'); }
  };

  useMarketSymbols(syms);
  const quotes = useMarketData(s => s.quotes);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(OVERRIDE_KEY);
      if (raw) setOverrides(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (editCell) setTimeout(() => editInputRef.current?.focus(), 0);
  }, [editCell]);

  useEffect(() => {
    let cancelled = false;
    symsRef.current = [];
    setPerfMap(new Map());

    const loadPrices = async () => {
      setLoading(true); setError(null);
      try {
        if (tab === 'offshore') {
          const allSyms = OFFSHORE_GROUPS.flatMap(g => [...g.symbols]);
          const [histSettled, liveSettled] = await Promise.allSettled([
            fetch('/api/indices?tab=offshore').then(r => r.ok ? r.json() : Promise.reject()),
            fetch(`/api/quote-yahoo?tickers=${allSyms.join(',')}`).then(r => r.ok ? r.json() : Promise.reject()),
          ]);
          const histArr: IndexStock[] = histSettled.status === 'fulfilled' && Array.isArray(histSettled.value) ? histSettled.value : [];
          const histMap = new Map(histArr.map((s: IndexStock) => [s.symbol, s]));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const liveMap: Record<string, { price: number | null; changePercent: number | null }> =
            liveSettled.status === 'fulfilled' ? (liveSettled.value ?? {}) : {};
          const merged: IndexStock[] = allSyms.map(sym => {
            const hist = histMap.get(sym);
            const live = liveMap[sym];
            return {
              symbol:   sym,
              price:    live?.price          ?? hist?.price    ?? null,
              varDay:   live?.changePercent  ?? hist?.varDay   ?? null,
              varWeek:  hist?.varWeek  ?? null,
              varMonth: hist?.varMonth ?? null,
              varYTD:   hist?.varYTD   ?? null,
            };
          });
          symsRef.current = allSyms;
          if (!cancelled) { setStocks(merged); setSyms(allSyms); }
          return;
        }

        let url = `/api/indices?tab=${tab}`;
        try {
          const compR = await fetch(`/api/index-composition/${tab.toUpperCase()}`);
          if (compR.ok) {
            const comp: { code: string; part: number }[] = await compR.json();
            if (Array.isArray(comp) && comp.length) {
              const syms = comp.slice(0, 25).map(c => c.code).join(',');
              url = `/api/indices?symbols=${encodeURIComponent(syms)}`;
            }
          }
        } catch { /* fall back to tab-based hardcoded list */ }

        const r    = await fetch(url);
        const data = await r.json();
        if (!r.ok || data.error) throw new Error(data.error ?? `HTTP ${r.status}`);
        const s: IndexStock[] = Array.isArray(data) ? data : [];
        symsRef.current = s.map((x) => x.symbol);
        if (!cancelled) { setStocks(s); setSyms(s.map(x => x.symbol)); }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const loadPerf = async () => {
      const syms = symsRef.current;
      if (!syms.length) return;
      const results = await Promise.allSettled(
        syms.map((sym) =>
          fetch(`/api/perf/${sym}`).then((r) => r.json()).catch(() => null)
        )
      );
      if (cancelled) return;
      const map = new Map<string, PerfData>();
      results.forEach((r, i) => {
        const p = r.status === 'fulfilled' ? r.value : null;
        if (p && typeof p === 'object' && ('varYTD' in p || 'varWeek' in p))
          map.set(syms[i], p as PerfData);
      });
      setPerfMap(map);
    };

    loadPrices().then(() => { if (!cancelled && tab !== 'offshore') loadPerf(); });

    const perfId = tab !== 'offshore' ? setInterval(loadPerf, 5 * 60_000) : undefined;
    return () => {
      cancelled = true;
      if (perfId != null) clearInterval(perfId);
    };
  }, [tab]);

  const ovKey = (sym: string, field: HistField) => `${tab}:${sym}:${field}`;

  const getVal = (s: IndexStock, field: HistField): { v: number | null; isOverride: boolean } => {
    const k = ovKey(s.symbol, field);
    if (overrides[k] !== undefined) return { v: overrides[k], isOverride: true };
    const perf = perfMap.get(s.symbol);
    if (perf && perf[field] != null) return { v: perf[field], isOverride: false };
    return { v: s[field], isOverride: false };
  };

  const commitEdit = (sym: string, field: HistField) => {
    const parsed = parseFloat(editVal.replace(',', '.'));
    if (!isNaN(parsed)) {
      const next = { ...overrides, [ovKey(sym, field)]: parsed };
      setOverrides(next);
      try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    }
    setEditCell(null);
  };

  const startEdit = (sym: string, field: HistField, currentVal: number | null) => {
    setEditCell({ symbol: sym, field });
    setEditVal(currentVal != null ? currentVal.toFixed(2) : '');
  };

  const stocksMap = useMemo(() => new Map(stocks.map(s => [s.symbol, s])), [stocks]);

  const sortedOffshore = useMemo(() => {
    if (tab !== 'offshore' || !sortKey) return null;
    const all: IndexStock[] = OFFSHORE_GROUPS
      .flatMap(g => [...g.symbols])
      .map(sym => stocksMap.get(sym) ?? { symbol: sym, price: null, varDay: null, varWeek: null, varMonth: null, varYTD: null });
    return [...all].sort((a, b) => {
      if (sortKey === 'ticker') {
        const r = a.symbol.localeCompare(b.symbol);
        return sortDir === 'desc' ? -r : r;
      }
      let va: number | null = null;
      let vb: number | null = null;
      if      (sortKey === 'price')  { va = a.price;    vb = b.price;    }
      else if (sortKey === 'day')    { va = a.varDay;   vb = b.varDay;   }
      else if (sortKey === 'week')   { va = a.varWeek;  vb = b.varWeek;  }
      else if (sortKey === 'month')  { va = a.varMonth; vb = b.varMonth; }
      else if (sortKey === 'ytd')    { va = a.varYTD;   vb = b.varYTD;   }
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  }, [tab, sortKey, sortDir, stocksMap]);

  const sortedStocks = useMemo(() => {
    if (!sortKey) return stocks;
    const getV = (s: IndexStock, f: HistField): number | null => {
      const k = `${tab}:${s.symbol}:${f}`;
      if (overrides[k] !== undefined) return overrides[k];
      const perf = perfMap.get(s.symbol);
      if (perf && perf[f] != null) return perf[f];
      return s[f];
    };
    return [...stocks].sort((a, b) => {
      if (sortKey === 'ticker') {
        const r = a.symbol.localeCompare(b.symbol);
        return sortDir === 'desc' ? -r : r;
      }
      let va: number | null = null;
      let vb: number | null = null;
      if (sortKey === 'price') {
        va = quotes[a.symbol]?.price ?? a.price;
        vb = quotes[b.symbol]?.price ?? b.price;
      } else if (sortKey === 'day') {
        va = quotes[a.symbol]?.changePct ?? a.varDay;
        vb = quotes[b.symbol]?.changePct ?? b.varDay;
      } else {
        const f: HistField = sortKey === 'week' ? 'varWeek' : sortKey === 'month' ? 'varMonth' : 'varYTD';
        va = getV(a, f);
        vb = getV(b, f);
      }
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  }, [stocks, sortKey, sortDir, quotes, perfMap, overrides, tab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 3, padding: '5px 12px',
        borderBottom: '1px solid #1a2535', flexShrink: 0,
        alignItems: 'center',
      }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setEditCell(null); setSortKey(null); }}
            style={{
              padding: '2px 10px',
              background: tab === t.key ? 'rgba(247,148,29,0.15)' : 'transparent',
              color:      tab === t.key ? '#f7941d' : '#5a7a9a',
              border:     tab === t.key ? '1px solid rgba(247,148,29,0.35)' : '1px solid transparent',
              cursor: 'pointer', fontSize: 10,
              fontFamily: 'inherit', borderRadius: 3,
              fontWeight: tab === t.key ? 600 : 400,
              letterSpacing: 0.3,
              transition: 'all 0.1s',
            }}
          >{t.label}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 8, color: '#3a556a', letterSpacing: 0.5 }}>
          2× clique p/ editar
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {loading && (
          <div style={{ padding: 14, color: '#f7941d', fontSize: 11 }}>
            <span className="blink">● CARREGANDO {tab.toUpperCase()}…</span>
          </div>
        )}
        {!loading && error && (
          <div style={{ padding: 14, color: '#ff3b5c', fontSize: 11 }}>{error}</div>
        )}
        {!loading && !error && tab === 'offshore' && (
          <div style={{ padding: '0 12px' }}>
            {/* Sticky sortable header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '74px 106px 64px 50px 50px 50px 50px',
              gap: 4, padding: '4px 0',
              borderBottom: '1px solid #1a2535',
              fontSize: 8, letterSpacing: 0.8,
              position: 'sticky', top: 0, zIndex: 2,
              background: '#080c14',
            }}>
              {([
                ['ticker', 'TICKER', false],
                [null,     'NOME',   false],
                ['price',  'PREÇO',  true],
                ['day',    'DIA%',   true],
                ['week',   'SEM%',   true],
                ['month',  'MÊS%',   true],
                ['ytd',    'YTD%',   true],
              ] as Array<[IdxSortKey | null, string, boolean]>).map(([col, label, right]) => (
                <span
                  key={label}
                  onClick={() => col != null && handleSort(col)}
                  onMouseEnter={() => col != null && setHoverCol(col)}
                  onMouseLeave={() => setHoverCol(null)}
                  style={{
                    textAlign: right ? 'right' : 'left',
                    cursor: col != null ? 'pointer' : 'default',
                    userSelect: 'none',
                    color: col != null && sortKey === col ? '#f7941d'
                         : col != null && hoverCol === col ? '#c8d4e0'
                         : '#8ba4bc',
                    transition: 'color 0.1s',
                  }}
                >
                  {label}{col != null && sortKey === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                </span>
              ))}
            </div>

            {sortedOffshore ? (
              /* Flat sorted view */
              sortedOffshore.map((h) => (
                <div key={h.symbol} className="row" style={{
                  display: 'grid',
                  gridTemplateColumns: '74px 106px 64px 50px 50px 50px 50px',
                  gap: 4, padding: '3px 0',
                  borderBottom: '1px solid #0e1620',
                  fontSize: 10, alignItems: 'center',
                }}>
                  <span style={{ color: '#f7941d', fontWeight: 600, fontSize: 9 }}>{h.symbol}</span>
                  <span style={{ color: '#5a7a9a', fontSize: 9, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{OFFSHORE_NAMES[h.symbol] ?? ''}</span>
                  <span style={{ textAlign: 'right', color: '#d4dce8', fontVariantNumeric: 'tabular-nums' }}>{fmtPrice(h.price)}</span>
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...pctStyle(h.varDay) }}>{fmtPct(h.varDay)}</span>
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...pctStyle(h.varWeek) }}>{fmtPct(h.varWeek)}</span>
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...pctStyle(h.varMonth) }}>{fmtPct(h.varMonth)}</span>
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...pctStyle(h.varYTD) }}>{fmtPct(h.varYTD)}</span>
                </div>
              ))
            ) : (
              /* Grouped view */
              OFFSHORE_GROUPS.map((grp) => {
                const avg = (vals: (number | null)[]) => {
                  const nums = vals.filter((v): v is number => typeof v === 'number' && isFinite(v));
                  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
                };
                const grpStocks = grp.symbols.map(sym => stocksMap.get(sym)).filter((s): s is IndexStock => s != null);
                const aDay = avg(grpStocks.map(s => s.varDay));
                const aWeek = avg(grpStocks.map(s => s.varWeek));
                const aMonth = avg(grpStocks.map(s => s.varMonth));
                const aYTD = avg(grpStocks.map(s => s.varYTD));
                return (
                  <div key={grp.label}>
                    <div style={{
                      fontSize: 8, letterSpacing: 0.7, color: '#3a556a',
                      padding: '6px 0 2px', borderBottom: '1px solid #141e2c',
                      textTransform: 'uppercase',
                    }}>{grp.label}</div>
                    {grp.symbols.map((sym) => {
                      const s = stocksMap.get(sym);
                      const h = s ?? { symbol: sym, price: null, varDay: null, varWeek: null, varMonth: null, varYTD: null };
                      return (
                        <div key={sym} className="row" style={{
                          display: 'grid',
                          gridTemplateColumns: '74px 106px 64px 50px 50px 50px 50px',
                          gap: 4, padding: '3px 0',
                          borderBottom: '1px solid #0e1620',
                          fontSize: 10, alignItems: 'center',
                        }}>
                          <span style={{ color: '#f7941d', fontWeight: 600, fontSize: 9 }}>{sym}</span>
                          <span style={{ color: '#5a7a9a', fontSize: 9, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{OFFSHORE_NAMES[sym] ?? ''}</span>
                          <span style={{ textAlign: 'right', color: '#d4dce8', fontVariantNumeric: 'tabular-nums' }}>{fmtPrice(h.price)}</span>
                          <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...pctStyle(h.varDay) }}>{fmtPct(h.varDay)}</span>
                          <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...pctStyle(h.varWeek) }}>{fmtPct(h.varWeek)}</span>
                          <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...pctStyle(h.varMonth) }}>{fmtPct(h.varMonth)}</span>
                          <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...pctStyle(h.varYTD) }}>{fmtPct(h.varYTD)}</span>
                        </div>
                      );
                    })}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '74px 106px 64px 50px 50px 50px 50px',
                      gap: 4, padding: '3px 0',
                      borderTop: '1px solid #1a2535', borderBottom: '1px solid #1a2535',
                      fontSize: 9, alignItems: 'center',
                      background: 'rgba(255,255,255,0.02)',
                    }}>
                      <span style={{ color: '#8ba4bc', fontStyle: 'italic', letterSpacing: 0.5 }}>MÉDIA</span>
                      <span /><span />
                      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontStyle: 'italic', ...pctStyle(aDay) }}>{fmtPct(aDay)}</span>
                      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontStyle: 'italic', ...pctStyle(aWeek) }}>{fmtPct(aWeek)}</span>
                      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontStyle: 'italic', ...pctStyle(aMonth) }}>{fmtPct(aMonth)}</span>
                      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontStyle: 'italic', ...pctStyle(aYTD) }}>{fmtPct(aYTD)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {!loading && !error && tab !== 'offshore' && (
          <div style={{ padding: '0 12px' }}>
            {/* Column header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '60px 68px 58px 58px 58px 58px',
              gap: 4, padding: '4px 0',
              borderBottom: '1px solid #1a2535',
              fontSize: 8, letterSpacing: 0.8,
            }}>
              {([
                ['ticker', 'TICKER',  false],
                ['price',  'PREÇO',   true],
                ['day',    'VAR DIA', true],
                ['week',   'VAR SEM', true],
                ['month',  'VAR MÊS', true],
                ['ytd',    'YTD',     true],
              ] as [IdxSortKey, string, boolean][]).map(([col, label, right]) => (
                <span
                  key={col}
                  onClick={() => handleSort(col)}
                  onMouseEnter={() => setHoverCol(col)}
                  onMouseLeave={() => setHoverCol(null)}
                  style={{
                    textAlign: right ? 'right' : 'left',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: sortKey === col ? '#f7941d' : hoverCol === col ? '#c8d4e0' : '#8ba4bc',
                    transition: 'color 0.1s',
                  }}
                >
                  {label}{sortKey === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                </span>
              ))}
            </div>

            {sortedStocks.map((s, i) => {
              const wk  = getVal(s, 'varWeek');
              const mo  = getVal(s, 'varMonth');
              const ytd = getVal(s, 'varYTD');
              return (
                <div
                  key={s.symbol ?? i}
                  className="row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 68px 58px 58px 58px 58px',
                    gap: 4, padding: '4px 0',
                    borderBottom: '1px solid #1a2535',
                    fontSize: 11, alignItems: 'center',
                  }}
                >
                  <span style={{ color: '#f7941d', fontWeight: 600 }}>{s.symbol}</span>
                  <span style={{
                    textAlign: 'right', color: '#d4dce8',
                    fontVariantNumeric: 'tabular-nums',
                  }}>{fmtPrice(quotes[s.symbol]?.price ?? s.price)}</span>
                  <span style={{
                    textAlign: 'right',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 10,
                    color: varDayCol(quotes[s.symbol]?.changePct ?? s.varDay),
                  }}>{fmtPct(quotes[s.symbol]?.changePct ?? s.varDay)}</span>
                  <VarCell
                    s={s} field="varWeek"
                    v={wk.v} isOverride={wk.isOverride}
                    isEditing={editCell?.symbol === s.symbol && editCell?.field === 'varWeek'}
                    editVal={editVal} editInputRef={editInputRef}
                    onStartEdit={startEdit} onCommit={commitEdit}
                    onCancel={() => setEditCell(null)} onEditValChange={setEditVal}
                  />
                  <VarCell
                    s={s} field="varMonth"
                    v={mo.v} isOverride={mo.isOverride}
                    isEditing={editCell?.symbol === s.symbol && editCell?.field === 'varMonth'}
                    editVal={editVal} editInputRef={editInputRef}
                    onStartEdit={startEdit} onCommit={commitEdit}
                    onCancel={() => setEditCell(null)} onEditValChange={setEditVal}
                  />
                  <VarCell
                    s={s} field="varYTD"
                    v={ytd.v} isOverride={ytd.isOverride}
                    isEditing={editCell?.symbol === s.symbol && editCell?.field === 'varYTD'}
                    editVal={editVal} editInputRef={editInputRef}
                    onStartEdit={startEdit} onCommit={commitEdit}
                    onCancel={() => setEditCell(null)} onEditValChange={setEditVal}
                  />
                </div>
              );
            })}

            {stocks.length === 0 && (
              <div style={{ padding: 14, color: '#3a556a', fontSize: 11 }}>
                Sem dados para {tab.toUpperCase()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
