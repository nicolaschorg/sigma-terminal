'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Panel } from '@/types';
import { useTerminal, WatchlistGroup } from '@/hooks/useTerminal';
import { useMarketData, useMarketSymbols, QuoteSnapshot } from '@/store/useMarketData';

interface QuoteData {
  symbol?: string; shortName?: string;
  regularMarketPrice?: number; regularMarketChange?: number; regularMarketChangePercent?: number;
  regularMarketOpen?: number; regularMarketDayHigh?: number; regularMarketDayLow?: number;
  regularMarketVolume?: number; regularMarketPreviousClose?: number;
  marketCap?: number; currency?: string;
  fiftyTwoWeekHigh?: number; fiftyTwoWeekLow?: number;
  trailingPE?: number; dividendYield?: number; averageVolume?: number;
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
    : { color: '#ff3b5c', background: 'rgba(255,59,92,0.09)', borderRadius: 2, padding: '1px 3px' };
}

const varCol = (v: number | null | undefined) =>
  v == null ? '#5a7a9a' : v >= 0 ? '#00c076' : '#ff3b5c';

function Field({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1a2535', fontSize: 11 }}>
      <span style={{ color: '#5a7a9a' }}>{label}</span>
      <span style={{ color: color ?? '#d4dce8', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function Loading() {
  return <div style={{ padding: 14, color: '#f7941d', fontSize: 11 }}><span className="blink">● CARREGANDO...</span></div>;
}
function Err({ msg }: { msg: string }) {
  return <div style={{ padding: 14, color: '#ff3b5c', fontSize: 11 }}>{msg}</div>;
}

// ── WATCHLIST ─────────────────────────────────────────────────────────────────

// ⠿ | TICKER | PREÇO | DIA% | SEM% | MÊS% | YTD% | ×
const WL_GRID = '8px 1fr 48px 40px 40px 40px 40px 14px';

interface PerfRow { varWeek: number | null; varMonth: number | null; varYTD: number | null }

type DragPayload =
  | { kind: 'sym'; sym: string; fromGroupId: string | null }
  | { kind: 'grp'; id: string };

type DropIndicator =
  | { kind: 'beforeSym'; sym: string; groupId: string | null }
  | { kind: 'beforeGroup'; id: string };

// ── sub-components ────────────────────────────────────────────────────────────

function GroupSeparator({ group, isDragOver, isGrpDragging, onGrpDragStart, onDragOver, onDrop, onDragEnd }: {
  group: WatchlistGroup;
  isDragOver: boolean;
  isGrpDragging: boolean;
  onGrpDragStart: (e: React.DragEvent) => void;
  onDragOver:     (e: React.DragEvent) => void;
  onDrop:         (e: React.DragEvent) => void;
  onDragEnd:      () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onGrpDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{
        padding: '5px 0 2px', marginTop: 2,
        borderTop: isDragOver ? '2px solid #2a6ca8' : '1px solid #1a2535',
        fontSize: 8, letterSpacing: 1,
        color: isGrpDragging ? '#2a3f55' : '#4a5f75',
        cursor: 'grab', userSelect: 'none',
        display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      <span style={{ fontSize: 9, opacity: 0.5 }}>⠿</span>
      {group.label}
    </div>
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
    <div style={{ display: 'grid', gridTemplateColumns: WL_GRID, gap: 2, height: 20, borderBottom: '1px solid #1a2535', fontSize: 9, alignItems: 'center' }}>
      <span />
      <span style={{ color: '#f7941d', fontWeight: 700, fontSize: 9 }}>MÉDIA</span>
      <span />
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, ...pctStyle(d) }}>{fmtPct(d)}</span>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: varCol(w) }}>{fmtPct(w)}</span>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: varCol(m) }}>{fmtPct(m)}</span>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: varCol(y) }}>{fmtPct(y)}</span>
      <span />
    </div>
  );
}

function StockRow({ sym, quotes, perfRow, runCommand, onRemove, isDragTarget, isBeingDragged, onDragStart, onDragOver, onDrop, onDragEnd }: {
  sym: string;
  quotes: Record<string, QuoteSnapshot>;
  perfRow?: PerfRow;
  runCommand: (cmd: string) => { success: boolean };
  onRemove: () => void;
  isDragTarget: boolean;
  isBeingDragged: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver:  (e: React.DragEvent) => void;
  onDrop:      (e: React.DragEvent) => void;
  onDragEnd:   () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const key = sym.replace(/\.SA$/i, '');
  const q   = quotes[key];
  const pct = q?.changePct ?? null;

  return (
    <div
      className="row"
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid', gridTemplateColumns: WL_GRID,
        gap: 2, height: 20,
        borderTop: isDragTarget ? '2px solid #2a6ca8' : '1px solid transparent',
        borderBottom: '1px solid #1a2535',
        fontSize: 9, alignItems: 'center',
        opacity: isBeingDragged ? 0.3 : 1,
      }}
    >
      <span style={{ color: hovered ? '#3a556a' : 'transparent', fontSize: 8, cursor: 'grab', userSelect: 'none', textAlign: 'center' }}>⠿</span>
      <span onClick={() => runCommand(`${key} GP`)} title={`Abrir gráfico de ${key}`} style={{ color: '#f7941d', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}>{key}</span>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#d4dce8', fontSize: 10 }}>{q ? n(q.price) : '—'}</span>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, ...pctStyle(pct) }}>{fmtPct(pct)}</span>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: varCol(perfRow?.varWeek) }}>{fmtPct(perfRow?.varWeek)}</span>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: varCol(perfRow?.varMonth) }}>{fmtPct(perfRow?.varMonth)}</span>
      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: varCol(perfRow?.varYTD) }}>{fmtPct(perfRow?.varYTD)}</span>
      <button
        onClick={onRemove}
        title={`Remover ${key}`}
        style={{ background: 'none', border: 'none', color: '#3a556a', fontSize: 13, cursor: 'pointer', lineHeight: 1, padding: 0, fontFamily: 'inherit', textAlign: 'center', transition: 'color 0.1s' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ff3b5c'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#3a556a'; }}
      >×</button>
    </div>
  );
}

// ── WatchlistPanel ─────────────────────────────────────────────────────────────

function WatchlistPanel() {
  const {
    watchlist, addToWatchlist, removeFromWatchlist, runCommand,
    groups, addGroup, removeGroup, addToGroup, removeFromGroup,
    reorderGroups, reorderGroupSymbols,
  } = useTerminal();

  const quotes = useMarketData(s => s.quotes);
  useMarketSymbols(watchlist);

  const [adding,     setAdding]     = useState(false);
  const [input,      setInput]      = useState('');
  const [addErr,     setAddErr]     = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [pendingSym, setPendingSym] = useState<string | null>(null);
  const [deleteGrpId, setDeleteGrpId] = useState<string | null>(null);
  const [perfMap,    setPerfMap]    = useState<Record<string, PerfRow>>({});

  const inputRef = useRef<HTMLInputElement>(null);

  type WLSortKey = 'ticker' | 'price' | 'day' | 'week' | 'month' | 'ytd';
  const [sortKey,  setSortKey]  = useState<WLSortKey | null>(null);
  const [sortDir,  setSortDir]  = useState<'desc' | 'asc'>('desc');
  const [hoverCol, setHoverCol] = useState<WLSortKey | null>(null);

  const dragPayloadRef = useRef<DragPayload | null>(null);
  const [dragActive,    setDragActive]    = useState<DragPayload | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);

  // ── perf data ──────────────────────────────────────────────────────────────
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
    if (adding && !pendingSym) setTimeout(() => inputRef.current?.focus(), 0);
  }, [adding, pendingSym]);

  // ── add ticker flow ────────────────────────────────────────────────────────
  const cancelAdd = () => {
    setAdding(false); setInput(''); setAddErr(null); setPendingSym(null);
  };

  const validateAndShowPicker = async () => {
    const sym = input.trim().toUpperCase();
    if (!sym) { cancelAdd(); return; }
    if (watchlist.includes(sym)) { setAddErr(`"${sym}" já está na watchlist`); return; }
    setValidating(true); setAddErr(null);
    try {
      const r = await fetch(`/api/quote/${sym}`);
      const d = await r.json();
      if (r.ok && !d.error && d.regularMarketPrice != null) {
        setPendingSym(sym);
      } else {
        setAddErr(`"${sym}" não encontrado`);
      }
    } catch { setAddErr('Erro de conexão'); }
    finally  { setValidating(false); }
  };

  const commitAdd = (sym: string, groupId: string | null) => {
    addToWatchlist(sym);
    if (groupId) addToGroup(sym, groupId);
    cancelAdd();
  };

  const handleNewGroup = (sym: string) => {
    const label = window.prompt('Nome do novo grupo:')?.trim();
    if (!label) return;
    const id = addGroup(label);
    addToWatchlist(sym);
    addToGroup(sym, id);
    cancelAdd();
  };

  // ── remove ─────────────────────────────────────────────────────────────────
  const handleRemove = (sym: string, groupId: string | null) => {
    if (groupId) {
      const group = groups.find(g => g.id === groupId);
      removeFromGroup(sym, groupId);
      removeFromWatchlist(sym);
      if (group && group.symbols.length === 1) setDeleteGrpId(groupId);
      return;
    }
    removeFromWatchlist(sym);
  };

  // ── drag & drop ────────────────────────────────────────────────────────────
  const clearDrag = useCallback(() => {
    dragPayloadRef.current = null;
    setDragActive(null);
    setDropIndicator(null);
  }, []);

  const onSymDragStart = (sym: string, fromGroupId: string | null) => (e: React.DragEvent) => {
    const p: DragPayload = { kind: 'sym', sym, fromGroupId };
    dragPayloadRef.current = p;
    setDragActive(p);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onGrpDragStart = (id: string) => (e: React.DragEvent) => {
    e.stopPropagation();
    const p: DragPayload = { kind: 'grp', id };
    dragPayloadRef.current = p;
    setDragActive(p);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOverSym = (sym: string, groupId: string | null) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const drag = dragPayloadRef.current;
    if (drag?.kind === 'sym' && drag.sym !== sym) {
      setDropIndicator({ kind: 'beforeSym', sym, groupId });
    }
  };

  const onDragOverGrpSep = (grpId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const drag = dragPayloadRef.current;
    if (!drag) return;
    if (drag.kind === 'sym') {
      setDropIndicator({ kind: 'beforeSym', sym: `__grpstart__${grpId}`, groupId: grpId });
    } else {
      setDropIndicator({ kind: 'beforeGroup', id: grpId });
    }
  };

  const onDropOnSym = (beforeSym: string, toGroupId: string | null) => (e: React.DragEvent) => {
    e.preventDefault();
    const drag = dragPayloadRef.current;
    if (!drag || drag.kind !== 'sym') { clearDrag(); return; }
    const { sym, fromGroupId } = drag;
    if (sym === beforeSym) { clearDrag(); return; }

    if (fromGroupId === toGroupId && toGroupId !== null) {
      const group = groups.find(g => g.id === toGroupId);
      if (group) {
        const syms = group.symbols.filter(s => s !== sym);
        const idx  = syms.indexOf(beforeSym);
        syms.splice(idx === -1 ? syms.length : idx, 0, sym);
        reorderGroupSymbols(toGroupId, syms);
      }
    } else {
      if (fromGroupId !== null) removeFromGroup(sym, fromGroupId);
      if (toGroupId !== null) {
        const group   = groups.find(g => g.id === toGroupId);
        const current = (group?.symbols ?? []).filter(s => s !== sym);
        const idx     = current.indexOf(beforeSym);
        current.splice(idx === -1 ? current.length : idx, 0, sym);
        reorderGroupSymbols(toGroupId, current);
      }
    }
    clearDrag();
  };

  const onDropOnGrpSep = (grpId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const drag = dragPayloadRef.current;
    if (!drag) { clearDrag(); return; }

    if (drag.kind === 'sym') {
      const { sym, fromGroupId } = drag;
      if (fromGroupId === grpId) { clearDrag(); return; }
      if (fromGroupId !== null) removeFromGroup(sym, fromGroupId);
      const group   = groups.find(g => g.id === grpId);
      const current = (group?.symbols ?? []).filter(s => s !== sym);
      reorderGroupSymbols(grpId, [sym, ...current]);
    } else if (drag.kind === 'grp') {
      const { id: dragId } = drag;
      if (dragId === grpId) { clearDrag(); return; }
      const ids = groups.map(g => g.id).filter(id => id !== dragId);
      const idx = ids.indexOf(grpId);
      ids.splice(idx === -1 ? ids.length : idx, 0, dragId);
      reorderGroups(ids);
    }
    clearDrag();
  };

  // ── sort ───────────────────────────────────────────────────────────────────
  const handleSort = (key: WLSortKey) => {
    if (sortKey === key) {
      if (sortDir === 'desc') setSortDir('asc');
      else { setSortKey(null); setSortDir('desc'); }
    } else { setSortKey(key); setSortDir('desc'); }
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
      va = quotes[ka]?.price ?? null; vb = quotes[kb]?.price ?? null;
    } else if (sortKey === 'day') {
      va = quotes[ka]?.changePct ?? null; vb = quotes[kb]?.changePct ?? null;
    } else {
      const field = sortKey === 'week' ? 'varWeek' : sortKey === 'month' ? 'varMonth' : 'varYTD';
      va = perfMap[ka]?.[field] ?? null; vb = perfMap[kb]?.[field] ?? null;
    }
    if (va == null && vb == null) return 0;
    if (va == null) return 1; if (vb == null) return -1;
    return sortDir === 'desc' ? vb - va : va - vb;
  }, [sortKey, sortDir, quotes, perfMap]);

  const allGroupedSyms = useMemo(() => {
    const s = new Set<string>();
    groups.forEach(g => g.symbols.forEach(sym => s.add(sym.toUpperCase())));
    return s;
  }, [groups]);

  const others = useMemo(
    () => watchlist.filter(s => !allGroupedSyms.has(s.toUpperCase())),
    [watchlist, allGroupedSyms]
  );

  const sortedGroups = useMemo(
    () => groups.map(g => ({ ...g, symbols: [...g.symbols].sort(sortFn) })),
    [groups, sortFn]
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

  const deleteGrp = groups.find(g => g.id === deleteGrpId);

  // helper to check if a sym is the active drag target
  const isBeingDragged = (sym: string) =>
    dragActive?.kind === 'sym' && (dragActive as { kind: 'sym'; sym: string }).sym === sym;
  const isGrpBeingDragged = (id: string) =>
    dragActive?.kind === 'grp' && (dragActive as { kind: 'grp'; id: string }).id === id;
  const isSymDropTarget = (sym: string, groupId: string | null) =>
    dropIndicator?.kind === 'beforeSym' &&
    (dropIndicator as { kind: 'beforeSym'; sym: string; groupId: string | null }).sym === sym &&
    (dropIndicator as { kind: 'beforeSym'; sym: string; groupId: string | null }).groupId === groupId;
  const isGrpDropTarget = (id: string) =>
    dropIndicator?.kind === 'beforeGroup' &&
    (dropIndicator as { kind: 'beforeGroup'; id: string }).id === id;
  const isGrpStartDropTarget = (id: string) =>
    dropIndicator?.kind === 'beforeSym' &&
    (dropIndicator as { kind: 'beforeSym'; sym: string }).sym === `__grpstart__${id}`;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Delete-group prompt */}
      {deleteGrpId && deleteGrp && (
        <div style={{ padding: '6px 10px', background: '#060b12', borderBottom: '1px solid #1a2535', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: '#8ba4bc', marginBottom: 5 }}>
            Grupo <span style={{ color: '#d4dce8' }}>&quot;{deleteGrp.label}&quot;</span> está vazio. Remover?
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => { removeGroup(deleteGrpId); setDeleteGrpId(null); }}
              style={{ background: 'rgba(255,59,92,0.1)', border: '1px solid rgba(255,59,92,0.3)', color: '#ff3b5c', fontSize: 10, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 2 }}
            >Sim, remover</button>
            <button
              onClick={() => setDeleteGrpId(null)}
              style={{ background: 'none', border: '1px solid #1a2535', color: '#5a7a9a', fontSize: 10, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 2 }}
            >Manter vazio</button>
          </div>
        </div>
      )}

      {/* Add ticker + group picker — single unified block */}
      {adding && (
        <div style={{ padding: '5px 10px', borderBottom: '1px solid #1a2535', background: '#060b12', flexShrink: 0 }}>
          {!pendingSym ? (
            /* Phase 1 — ticker input */
            <>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => { setInput(e.target.value.toUpperCase()); setAddErr(null); }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter')  { e.preventDefault(); validateAndShowPicker(); }
                    if (e.key === 'Escape') cancelAdd();
                  }}
                  onKeyUp={(e) => e.stopPropagation()}
                  onKeyPress={(e) => e.stopPropagation()}
                  disabled={validating}
                  placeholder="TICKER..."
                  style={{ background: '#080c14', border: '1px solid #1a2535', color: '#d4dce8', fontSize: 11, padding: '2px 6px', fontFamily: 'inherit', width: 80, outline: 'none', borderRadius: 2 }}
                />
                {validating ? (
                  <span style={{ color: '#f7941d', fontSize: 10 }}>verificando…</span>
                ) : (
                  <button onClick={validateAndShowPicker} style={{ background: '#f7941d', border: 'none', color: '#080c14', fontSize: 10, padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, borderRadius: 2 }}>OK</button>
                )}
                <button onClick={cancelAdd} style={{ background: 'none', border: 'none', color: '#3a556a', fontSize: 14, cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
              </div>
              {addErr && <div style={{ color: '#ff3b5c', fontSize: 10, marginTop: 2 }}>{addErr}</div>}
            </>
          ) : (
            /* Phase 2 — group picker (inline, no extra state) */
            <>
              <div style={{ fontSize: 10, color: '#8ba4bc', marginBottom: 5 }}>
                <span style={{ color: '#f7941d', fontWeight: 700 }}>{pendingSym}</span>
                {' '}— adicionar a:
              </div>
              {groups.map(g => (
                <button key={g.id} onClick={() => commitAdd(pendingSym, g.id)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: '#c8d4e0', fontSize: 10, padding: '3px 0', cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.6 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#f7941d'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#c8d4e0'; }}
                >▸ {g.label}</button>
              ))}
              <div style={{ borderTop: '1px solid #1a2535', marginTop: 4, paddingTop: 4, display: 'flex', gap: 10 }}>
                <button onClick={() => handleNewGroup(pendingSym)}
                  style={{ background: 'none', border: 'none', color: '#5a7a9a', fontSize: 10, padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#f7941d'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#5a7a9a'; }}
                >➕ Novo grupo</button>
                <button onClick={() => commitAdd(pendingSym, null)}
                  style={{ background: 'none', border: 'none', color: '#5a7a9a', fontSize: 10, padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#c8d4e0'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#5a7a9a'; }}
                >Sem grupo</button>
                <button onClick={cancelAdd}
                  style={{ background: 'none', border: 'none', color: '#3a556a', fontSize: 10, padding: 0, cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}
                >cancelar</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: WL_GRID, gap: 2, padding: '3px 10px', borderBottom: '1px solid #1a2535', fontSize: 8, letterSpacing: 0.8, flexShrink: 0, alignItems: 'center' }}>
        <span />
        {COLS.map(([col, label, right]) => (
          <span key={col}
            onClick={() => handleSort(col)}
            onMouseEnter={() => setHoverCol(col)}
            onMouseLeave={() => setHoverCol(null)}
            style={{ textAlign: right ? 'right' : 'left', cursor: 'pointer', userSelect: 'none', color: sortKey === col ? '#f7941d' : hoverCol === col ? '#c8d4e0' : '#8ba4bc' }}
          >{label}{sortKey === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}</span>
        ))}
        <button
          onClick={() => setAdding((v) => !v)}
          title="Adicionar ticker"
          style={{ background: 'none', border: `1px solid ${adding ? 'rgba(247,148,29,0.4)' : '#1a2535'}`, color: adding ? '#f7941d' : '#5a7a9a', fontSize: 10, cursor: 'pointer', lineHeight: 1, padding: '0 2px', fontFamily: 'inherit', borderRadius: 2 }}
        >+</button>
      </div>

      {/* Rows */}
      <div
        style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 10px' }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) clearDrag(); }}
      >
        {/* Ungrouped */}
        {sortedOthers.length > 0 && (
          <>
            {sortedOthers.map(sym => (
              <StockRow
                key={sym} sym={sym} quotes={quotes}
                perfRow={perfMap[sym.replace(/\.SA$/i, '')]}
                runCommand={runCommand}
                onRemove={() => handleRemove(sym, null)}
                isDragTarget={isSymDropTarget(sym, null)}
                isBeingDragged={isBeingDragged(sym)}
                onDragStart={onSymDragStart(sym, null)}
                onDragOver={onDragOverSym(sym, null)}
                onDrop={onDropOnSym(sym, null)}
                onDragEnd={clearDrag}
              />
            ))}
            <AvgRow syms={sortedOthers} quotes={quotes} perfMap={perfMap} />
          </>
        )}

        {/* Groups */}
        {sortedGroups.map(g => (
          <div key={g.id} style={{ borderTop: isGrpDropTarget(g.id) ? '2px solid #2a6ca8' : undefined }}>
            <GroupSeparator
              group={g}
              isDragOver={isGrpStartDropTarget(g.id)}
              isGrpDragging={isGrpBeingDragged(g.id)}
              onGrpDragStart={onGrpDragStart(g.id)}
              onDragOver={onDragOverGrpSep(g.id)}
              onDrop={onDropOnGrpSep(g.id)}
              onDragEnd={clearDrag}
            />
            {g.symbols.map(sym => (
              <StockRow
                key={sym} sym={sym} quotes={quotes}
                perfRow={perfMap[sym.replace(/\.SA$/i, '')]}
                runCommand={runCommand}
                onRemove={() => handleRemove(sym, g.id)}
                isDragTarget={isSymDropTarget(sym, g.id)}
                isBeingDragged={isBeingDragged(sym)}
                onDragStart={onSymDragStart(sym, g.id)}
                onDragOver={onDragOverSym(sym, g.id)}
                onDrop={onDropOnSym(sym, g.id)}
                onDragEnd={clearDrag}
              />
            ))}
            {g.symbols.length > 0 && (
              <AvgRow syms={g.symbols} quotes={quotes} perfMap={perfMap} />
            )}
          </div>
        ))}

        {watchlist.length === 0 && (
          <div style={{ padding: '10px 0', color: '#3a556a', fontSize: 10 }}>Watchlist vazia. [+] para adicionar.</div>
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
          {quote.shortName && <span style={{ color: '#5a7a9a', fontSize: 11 }}>{quote.shortName}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 22, letterSpacing: -0.5, color: '#d4dce8' }}>{n(quote.regularMarketPrice)}</span>
          <span style={{ fontSize: 13, color: pos ? '#00c076' : '#ff3b5c', background: pos ? 'rgba(0,192,118,0.09)' : 'rgba(255,59,92,0.09)', borderRadius: 3, padding: '1px 5px' }}>
            {pos ? '+' : ''}{n(chg)} ({pos ? '+' : ''}{n(chgPct)}%)
          </span>
        </div>
        <div style={{ color: '#3a556a', fontSize: 10, marginTop: 3 }}>{quote.currency ?? 'BRL'} · {quote.symbol ?? ''}</div>
      </div>

      <div style={{ borderTop: '1px solid #1a2535', paddingTop: 4 }}>
        <Field label="ABERTURA"       value={n(quote.regularMarketOpen)} />
        <Field label="MÁXIMA DIA"     value={n(quote.regularMarketDayHigh)} />
        <Field label="MÍNIMA DIA"     value={n(quote.regularMarketDayLow)} />
        <Field label="FECH. ANTERIOR" value={n(quote.regularMarketPreviousClose)} />
        <Field label="VOLUME"         value={big(quote.regularMarketVolume)} />
        <Field label="VOL. MÉDIO"     value={big(quote.averageVolume)} />
        <Field label="MARKET CAP"     value={big(quote.marketCap)} color={highlight === 'marketCap' ? '#f7941d' : undefined} />
        <Field label="52S MÁXIMA"     value={n(quote.fiftyTwoWeekHigh)} />
        <Field label="52S MÍNIMA"     value={n(quote.fiftyTwoWeekLow)} />
        {quote.trailingPE    != null && <Field label="P/L"        value={n(quote.trailingPE)} />}
        {quote.dividendYield != null && <Field label="DIV. YIELD" value={`${n(quote.dividendYield * 100)}%`} />}
      </div>
    </div>
  );
}
