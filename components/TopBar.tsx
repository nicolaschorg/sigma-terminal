'use client';
import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { TickerItem } from '@/types';

export default function TopBar() {
  const [time,   setTime]   = useState('');
  const [ticker, setTicker] = useState<TickerItem[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const tick = () => {
      setTime(format(new Date(), 'HH:mm:ss'));
      timerRef.current = setTimeout(tick, 1000);
    };
    tick();
    return () => clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/ticker');
        if (r.ok) setTicker(await r.json());
      } catch {}
    };
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const looped = [...ticker, ...ticker];

  return (
    <header style={{
      height: 32,
      background: '#090d18',
      borderBottom: '1px solid #1a2535',
      display: 'flex',
      alignItems: 'center',
      padding: '0 14px',
      gap: 12,
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {/* Logo */}
      <span style={{
        color: '#f7941d',
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: 5,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        SIGMA
      </span>

      <Divider />

      {/* Animated ticker tape */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            width: 'max-content',
            animation: looped.length > 0 ? 'ticker-slide 65s linear infinite' : 'none',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.animationPlayState = 'paused'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.animationPlayState = 'running'; }}
        >
          {looped.map((item, i) => (
            <TickerCell key={`${item.symbol}-${i}`} item={item} />
          ))}
        </div>
      </div>

      {/* Clock */}
      <span style={{
        color: '#5a7a9a',
        fontSize: 11,
        whiteSpace: 'nowrap',
        letterSpacing: 1,
        flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {time}
      </span>
    </header>
  );
}

function Divider() {
  return (
    <span style={{ color: '#1a2535', fontSize: 14, lineHeight: 1, flexShrink: 0, opacity: 0.8 }}>│</span>
  );
}

function TickerCell({ item }: { item: TickerItem }) {
  if (item.isRate) {
    return (
      <>
        <div style={{
          display: 'flex',
          gap: 5,
          alignItems: 'center',
          fontSize: 10,
          whiteSpace: 'nowrap',
          padding: '0 12px',
        }}>
          <span style={{ color: '#5a7a9a', letterSpacing: 0.3 }}>{item.symbol}</span>
          <span style={{ color: '#f7941d', fontWeight: 600 }}>
            {item.price.toFixed(2)}% a.a.
          </span>
        </div>
        <Divider />
      </>
    );
  }

  const pos = item.changePercent >= 0;
  return (
    <>
      <div style={{
        display: 'flex',
        gap: 5,
        alignItems: 'center',
        fontSize: 10,
        whiteSpace: 'nowrap',
        padding: '0 12px',
      }}>
        <span style={{ color: '#5a7a9a', letterSpacing: 0.3 }}>{item.symbol}</span>
        <span style={{ color: '#d4dce8', fontVariantNumeric: 'tabular-nums' }}>
          {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span style={{ color: pos ? '#00c076' : '#ff3b5c', fontWeight: 500 }}>
          {pos ? '▲' : '▼'}{Math.abs(item.changePercent).toFixed(2)}%
        </span>
      </div>
      <Divider />
    </>
  );
}
