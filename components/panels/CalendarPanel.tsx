'use client';
import { useState, useEffect } from 'react';
import { Panel } from '@/types';
import { useTerminal } from '@/hooks/useTerminal';
import type { CalendarEvent, EventType } from '@/app/api/calendar/route';

const TYPE_COLOR: Record<EventType, string> = {
  'COPOM':        '#f7941d',
  'IPCA':         '#4a9eff',
  'IGP-M':        '#6b8fff',
  'IBGE':         '#5a9fff',
  'RESULTADO':    '#00c076',
  'VENC. OPÇÕES': '#f7c948',
  'OUTROS':       '#5a7a9a',
};

function fmtDate(dateStr: string): string {
  const d    = new Date(dateStr + 'T12:00:00');
  const now  = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  if (diff === 0) return 'HOJE';
  if (diff === 1) return 'AMHÃ';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

export default function CalendarPanel({ panel: _panel }: { panel: Panel }) {
  const { watchlist } = useTerminal();
  const [events,  setEvents]  = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const syms = watchlist.slice(0, 8).join(',') || 'PETR4,VALE3,ITUB4';
        const r    = await fetch(`/api/calendar?symbols=${encodeURIComponent(syms)}`);
        if (!r.ok) return;
        const data: CalendarEvent[] = await r.json();
        if (!cancelled) setEvents(Array.isArray(data) ? data : []);
      } catch { /* keep previous */ }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    const id = setInterval(load, 30 * 60_000); // refresh every 30 min
    return () => { cancelled = true; clearInterval(id); };
  }, [watchlist]);

  if (loading) return (
    <div style={{ padding: 10, color: '#f7941d', fontSize: 10 }}>
      <span className="blink">● CARREGANDO...</span>
    </div>
  );

  if (!events.length) return (
    <div style={{ padding: 10, color: '#3a556a', fontSize: 9 }}>Sem eventos próximos.</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {events.map((ev, i) => (
        <div
          key={i}
          className="row"
          style={{
            display: 'grid',
            gridTemplateColumns: '36px 76px 1fr',
            gap: 4,
            height: 22,
            alignItems: 'center',
            padding: '0 10px',
            borderBottom: '1px solid #1a2535',
          }}
        >
          <span style={{ fontSize: 9, color: '#5a7a9a', fontVariantNumeric: 'tabular-nums', letterSpacing: 0.3 }}>
            {fmtDate(ev.date)}
          </span>
          <span style={{
            fontSize: 8, fontWeight: 700, letterSpacing: 0.5,
            color: TYPE_COLOR[ev.type] ?? '#5a7a9a',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {ev.type}
          </span>
          <span style={{
            fontSize: 9, color: '#8ba4bc',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {ev.title}
          </span>
        </div>
      ))}
    </div>
  );
}
