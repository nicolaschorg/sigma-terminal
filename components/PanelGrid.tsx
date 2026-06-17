'use client';
import { CSSProperties, useRef, useState, useCallback, useEffect } from 'react';
import { useTerminal } from '@/hooks/useTerminal';
import { Panel } from '@/types';
import dynamic from 'next/dynamic';
import QuotePanel         from './panels/QuotePanel';
import NewsPanel          from './panels/NewsPanel';
import FundamentalsPanel  from './panels/FundamentalsPanel';
import ConsolePanel       from './panels/ConsolePanel';
import SearchPanel        from './panels/SearchPanel';
import MacroPanel         from './panels/MacroPanel';
import IndicesPanel       from './panels/IndicesPanel';
import MultPanel          from './panels/MultPanel';
import RendaFixaPanel     from './panels/RendaFixaPanel';
import GlobalIndicesPanel from './panels/GlobalIndicesPanel';
import HeatmapPanel       from './panels/HeatmapPanel';
import CalendarPanel      from './panels/CalendarPanel';

const ChartPanel      = dynamic(() => import('./panels/ChartPanel'),      { ssr: false });
const YTDPanel        = dynamic(() => import('./panels/YTDPanel'),        { ssr: false });
const ComparisonPanel = dynamic(() => import('./panels/ComparisonPanel'), { ssr: false });

// ── Resize state ───────────────────────────────────────────────────────────────
const DEFAULTS = {
  cols:       [25, 40, 35],
  leftRows:   [50, 30, 20],
  centerRows: [60, 40],
  rightRows:  [50, 50],
};
const MIN_FLEX  = 6;
const DV        = 5; // divider thickness px

function loadSizes(): typeof DEFAULTS {
  try {
    const s = localStorage.getItem('bterm-panel-sizes');
    if (s) {
      const p = JSON.parse(s);
      return {
        cols:       p.cols       ?? DEFAULTS.cols,
        leftRows:   p.leftRows   ?? DEFAULTS.leftRows,
        centerRows: p.centerRows ?? DEFAULTS.centerRows,
        rightRows:  p.rightRows  ?? DEFAULTS.rightRows,
      };
    }
  } catch {}
  return { ...DEFAULTS };
}

function saveSizes(s: typeof DEFAULTS) {
  try { localStorage.setItem('bterm-panel-sizes', JSON.stringify(s)); } catch {}
}

function adjustTwo(arr: number[], i: number, j: number, deltaPx: number, containerPx: number): number[] {
  const total = arr.reduce((s, v) => s + v, 0);
  const d     = (deltaPx / Math.max(containerPx, 1)) * total;
  const next  = [...arr];
  next[i] = Math.max(MIN_FLEX, next[i] + d);
  next[j] = Math.max(MIN_FLEX, next[j] - d);
  return next;
}

// ── Divider components ─────────────────────────────────────────────────────────
function VDivider({ onDelta }: { onDelta: (dx: number) => void }) {
  const [lit, setLit]   = useState(false);
  const dragging        = useRef(false);

  const handleDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    setLit(true);
    let last = e.clientX;
    const move = (ev: MouseEvent) => { onDelta(ev.clientX - last); last = ev.clientX; };
    const up   = () => {
      dragging.current = false;
      setLit(false);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup',   up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup',   up);
  };

  return (
    <div
      onMouseDown={handleDown}
      onMouseEnter={() => setLit(true)}
      onMouseLeave={() => { if (!dragging.current) setLit(false); }}
      style={{
        width: DV, flexShrink: 0, cursor: 'col-resize',
        display: 'flex', justifyContent: 'center', alignItems: 'stretch',
      }}
    >
      <div style={{ width: 1, background: lit ? '#f7941d' : '#1a2535', transition: 'background 0.12s' }} />
    </div>
  );
}

function HDivider({ onDelta }: { onDelta: (dy: number) => void }) {
  const [lit, setLit]   = useState(false);
  const dragging        = useRef(false);

  const handleDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    setLit(true);
    let last = e.clientY;
    const move = (ev: MouseEvent) => { onDelta(ev.clientY - last); last = ev.clientY; };
    const up   = () => {
      dragging.current = false;
      setLit(false);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup',   up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup',   up);
  };

  return (
    <div
      onMouseDown={handleDown}
      onMouseEnter={() => setLit(true)}
      onMouseLeave={() => { if (!dragging.current) setLit(false); }}
      style={{
        height: DV, flexShrink: 0, cursor: 'row-resize',
        display: 'flex', alignItems: 'center',
      }}
    >
      <div style={{ height: 1, flex: 1, background: lit ? '#f7941d' : '#1a2535', transition: 'background 0.12s' }} />
    </div>
  );
}

// ── Panel content / wrapper ────────────────────────────────────────────────────
function PanelContent({ panel }: { panel: Panel }) {
  switch (panel.type) {
    case 'chart':          return <ChartPanel         panel={panel} />;
    case 'quote':          return <QuotePanel         panel={panel} />;
    case 'news':           return <NewsPanel          panel={panel} />;
    case 'fundamentals':   return <FundamentalsPanel  panel={panel} />;
    case 'console':        return <ConsolePanel       panel={panel} />;
    case 'search':         return <SearchPanel        panel={panel} />;
    case 'ytd':            return <YTDPanel           panel={panel} />;
    case 'macro':          return <MacroPanel         panel={panel} />;
    case 'indices':        return <IndicesPanel       panel={panel} />;
    case 'comparison':     return <ComparisonPanel    panel={panel} />;
    case 'mult':           return <MultPanel          panel={panel} />;
    case 'renda-fixa':     return <RendaFixaPanel     panel={panel} />;
    case 'global-indices': return <GlobalIndicesPanel panel={panel} />;
    case 'heatmap':        return <HeatmapPanel       panel={panel} />;
    case 'calendar':       return <CalendarPanel      panel={panel} />;
    default:               return null;
  }
}

function PanelWrapper({ panel, style }: { panel: Panel; style?: CSSProperties }) {
  const { closePanel, maximizePanel } = useTerminal();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: '#0d1421',
      border: '1px solid #1a2535',
      borderTop: '2px solid #f7941d',
      overflow: 'hidden',
      position: 'relative',
      minHeight: 0,
      ...style,
    }}>
      <div
        onDoubleClick={() => !panel.fixed && maximizePanel(panel.id)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 12px', height: 28,
          background: '#090d18', borderBottom: '1px solid #1a2535',
          cursor: panel.fixed ? 'default' : 'pointer',
          userSelect: 'none', flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 10, color: '#8ba4bc', letterSpacing: 1.5, fontWeight: 500 }}>
          {panel.title.toUpperCase()}
        </span>
        {!panel.fixed && (
          <button
            onClick={(e) => { e.stopPropagation(); closePanel(panel.id); }}
            style={{ background: 'none', border: 'none', color: '#3a556a', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px', transition: 'color 0.1s' }}
            title="Fechar"
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ff3b5c'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#3a556a'; }}
          >×</button>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <PanelContent panel={panel} />
      </div>
    </div>
  );
}

// ── Main grid ──────────────────────────────────────────────────────────────────
export default function PanelGrid() {
  const { panels, floatingPanels } = useTerminal();
  const [watchlist, indices, news, gidx, rendaFixa, heatmap, calendar] = panels;

  const [cols,       setCols]       = useState(DEFAULTS.cols);
  const [leftRows,   setLeftRows]   = useState(DEFAULTS.leftRows);
  const [centerRows, setCenterRows] = useState(DEFAULTS.centerRows);
  const [rightRows,  setRightRows]  = useState(DEFAULTS.rightRows);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const s = loadSizes();
    setCols(s.cols);
    setLeftRows(s.leftRows);
    setCenterRows(s.centerRows);
    setRightRows(s.rightRows);
  }, []);

  // Debounced persist
  useEffect(() => {
    const id = setTimeout(() => saveSizes({ cols, leftRows, centerRows, rightRows }), 500);
    return () => clearTimeout(id);
  }, [cols, leftRows, centerRows, rightRows]);

  // Container / column refs for pixel-to-flex conversion
  const containerRef = useRef<HTMLDivElement>(null);
  const leftColRef   = useRef<HTMLDivElement>(null);
  const centerColRef = useRef<HTMLDivElement>(null);
  const rightColRef  = useRef<HTMLDivElement>(null);

  // Vertical divider handlers (adjust two columns)
  const adjustCols01 = useCallback((dx: number) => {
    const w = (containerRef.current?.clientWidth  ?? 800) - 2 * DV;
    setCols(prev => adjustTwo(prev, 0, 1, dx, w));
  }, []);

  const adjustCols12 = useCallback((dx: number) => {
    const w = (containerRef.current?.clientWidth  ?? 800) - 2 * DV;
    setCols(prev => adjustTwo(prev, 1, 2, dx, w));
  }, []);

  // Horizontal divider handlers per column
  const adjLeft01 = useCallback((dy: number) => {
    const h = (leftColRef.current?.clientHeight   ?? 600) - 2 * DV;
    setLeftRows(prev => adjustTwo(prev, 0, 1, dy, h));
  }, []);

  const adjLeft12 = useCallback((dy: number) => {
    const h = (leftColRef.current?.clientHeight   ?? 600) - 2 * DV;
    setLeftRows(prev => adjustTwo(prev, 1, 2, dy, h));
  }, []);

  const adjCenter = useCallback((dy: number) => {
    const h = (centerColRef.current?.clientHeight ?? 600) - DV;
    setCenterRows(prev => adjustTwo(prev, 0, 1, dy, h));
  }, []);

  const adjRight = useCallback((dy: number) => {
    const h = (rightColRef.current?.clientHeight  ?? 600) - DV;
    setRightRows(prev => adjustTwo(prev, 0, 1, dy, h));
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1, display: 'flex', flexDirection: 'row',
        padding: 2, minHeight: 0, position: 'relative',
        background: '#080c14',
      }}
    >
      {/* Left column: Watchlist / Heatmap / Calendar */}
      <div ref={leftColRef} style={{ flex: cols[0], display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        {watchlist && <PanelWrapper panel={watchlist} style={{ flex: leftRows[0] }} />}
        {watchlist && heatmap  && <HDivider onDelta={adjLeft01} />}
        {heatmap   && <PanelWrapper panel={heatmap}   style={{ flex: leftRows[1] }} />}
        {heatmap   && calendar && <HDivider onDelta={adjLeft12} />}
        {calendar  && <PanelWrapper panel={calendar}  style={{ flex: leftRows[2] }} />}
      </div>

      <VDivider onDelta={adjustCols01} />

      {/* Center column: Índices / Notícias */}
      <div ref={centerColRef} style={{ flex: cols[1], display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        {indices && <PanelWrapper panel={indices} style={{ flex: centerRows[0] }} />}
        {indices && news && <HDivider onDelta={adjCenter} />}
        {news    && <PanelWrapper panel={news}    style={{ flex: centerRows[1] }} />}
      </div>

      <VDivider onDelta={adjustCols12} />

      {/* Right column: Índices Globais / Renda Fixa */}
      <div ref={rightColRef} style={{ flex: cols[2], display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        {gidx      && <PanelWrapper panel={gidx}      style={{ flex: rightRows[0] }} />}
        {gidx      && rendaFixa && <HDivider onDelta={adjRight} />}
        {rendaFixa && <PanelWrapper panel={rendaFixa} style={{ flex: rightRows[1] }} />}
      </div>

      {floatingPanels.length > 0 && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          display: 'flex', gap: 2, background: '#080c14',
        }}>
          {floatingPanels.map((p) => (
            <PanelWrapper key={p.id} panel={p} style={{ flex: 1 }} />
          ))}
        </div>
      )}
    </div>
  );
}
