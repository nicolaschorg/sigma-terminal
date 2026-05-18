'use client';
import { CSSProperties } from 'react';
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

function PanelContent({ panel }: { panel: Panel }) {
  switch (panel.type) {
    case 'chart':          return <ChartPanel        panel={panel} />;
    case 'quote':          return <QuotePanel        panel={panel} />;
    case 'news':           return <NewsPanel         panel={panel} />;
    case 'fundamentals':   return <FundamentalsPanel panel={panel} />;
    case 'console':        return <ConsolePanel      panel={panel} />;
    case 'search':         return <SearchPanel       panel={panel} />;
    case 'ytd':            return <YTDPanel          panel={panel} />;
    case 'macro':          return <MacroPanel        panel={panel} />;
    case 'indices':        return <IndicesPanel      panel={panel} />;
    case 'comparison':     return <ComparisonPanel   panel={panel} />;
    case 'mult':           return <MultPanel         panel={panel} />;
    case 'renda-fixa':     return <RendaFixaPanel     panel={panel} />;
    case 'global-indices': return <GlobalIndicesPanel  panel={panel} />;
    case 'heatmap':        return <HeatmapPanel        panel={panel} />;
    case 'calendar':       return <CalendarPanel       panel={panel} />;
    default:               return null;
  }
}

function PanelWrapper({ panel, style }: { panel: Panel; style?: CSSProperties }) {
  const { closePanel, maximizePanel } = useTerminal();
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: '#0d1421',
      border: '1px solid #1a2535',
      borderTop: '2px solid #f7941d',
      overflow: 'hidden',
      position: 'relative',
      ...style,
    }}>
      {/* Panel header */}
      <div
        onDoubleClick={() => !panel.fixed && maximizePanel(panel.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          height: 28,
          background: '#090d18',
          borderBottom: '1px solid #1a2535',
          cursor: panel.fixed ? 'default' : 'pointer',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <span style={{
          fontSize: 10,
          color: '#8ba4bc',
          letterSpacing: 1.5,
          fontWeight: 500,
        }}>
          {panel.title.toUpperCase()}
        </span>

        {!panel.fixed && (
          <button
            onClick={(e) => { e.stopPropagation(); closePanel(panel.id); }}
            style={{
              background: 'none',
              border: 'none',
              color: '#3a556a',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: '0 2px',
              transition: 'color 0.1s',
            }}
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

export default function PanelGrid() {
  const { panels, floatingPanels } = useTerminal();

  const [watchlist, indices, news, gidx, rendaFixa, heatmap, calendar] = panels;

  return (
    <div style={{
      flex: 1,
      display: 'grid',
      gridTemplateColumns: '25fr 40fr 35fr',
      gap: 2,
      padding: 2,
      minHeight: 0,
      position: 'relative',
      background: '#080c14',
    }}>
      {/* Left: WATCHLIST (50%) + HEATMAP (30%) + CALENDAR (20%) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}>
        {watchlist && <PanelWrapper panel={watchlist} style={{ flex: 5 }} />}
        {heatmap   && <PanelWrapper panel={heatmap}   style={{ flex: 3 }} />}
        {calendar  && <PanelWrapper panel={calendar}  style={{ flex: 2 }} />}
      </div>

      {/* Center: ÍNDICES (60%) + NOTÍCIAS (40%) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}>
        {indices && <PanelWrapper panel={indices} style={{ flex: 6 }} />}
        {news    && <PanelWrapper panel={news}    style={{ flex: 4 }} />}
      </div>

      {/* Right: ÍNDICES GLOBAIS (50%) + RENDA FIXA (50%) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}>
        {gidx      && <PanelWrapper panel={gidx}      style={{ flex: 1 }} />}
        {rendaFixa && <PanelWrapper panel={rendaFixa} style={{ flex: 1 }} />}
      </div>

      {floatingPanels.length > 0 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          gap: 2,
          background: '#080c14',
        }}>
          {floatingPanels.map((p) => (
            <PanelWrapper key={p.id} panel={p} style={{ flex: 1 }} />
          ))}
        </div>
      )}
    </div>
  );
}
