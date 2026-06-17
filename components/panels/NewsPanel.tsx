'use client';
import { useState, useEffect } from 'react';
import { Panel } from '@/types';

interface NewsItem {
  uuid?: string;
  title: string;
  publisher?: string;
  lang?: string;
  link: string;
  publishedAt?: string;
}

const HEADLINE_SOURCES = ['Bloomberg', 'FT', 'CNBC', 'Reuters', 'MarketWatch', 'Nikkei Asia', 'Valor Econômico', 'InfoMoney'];

function fmtTime(pub?: string): string {
  if (!pub) return '';
  const d = new Date(pub);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function HeadlineRow({ item }: { item: NewsItem }) {
  const src = item.publisher ?? '';
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        height: 20, flexShrink: 0,
        textDecoration: 'none',
        padding: '0 10px',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: '#f7941d', fontSize: 9, flexShrink: 0 }}>
        [{src.toUpperCase().slice(0, 12)}]
      </span>
      <span style={{
        color: '#e8edf2', fontSize: 10,
        overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
      }}>
        {item.title}
      </span>
    </a>
  );
}

function NewsRow({ item }: { item: NewsItem }) {
  const src  = item.publisher ?? '';
  const t    = fmtTime(item.publishedAt);
  const isEn = item.lang === 'en';
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="row"
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        height: 20, flexShrink: 0,
        textDecoration: 'none',
        borderBottom: '1px solid #1a2535',
        padding: '0 10px',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      {isEn && (
        <span style={{ color: '#4a9eff', fontSize: 9, flexShrink: 0 }}>[EN]</span>
      )}
      {src && (
        <span style={{ color: '#f7941d', fontSize: 9, flexShrink: 0 }}>
          [{src.toUpperCase().slice(0, 12)}]
        </span>
      )}
      <span style={{
        color: '#d4dce8', fontSize: 10,
        overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
      }}>
        {item.title}
      </span>
      {t && (
        <span style={{ color: '#3a556a', fontSize: 9, flexShrink: 0 }}>{t}</span>
      )}
    </a>
  );
}

export default function NewsPanel({ panel: _panel }: { panel: Panel }) {
  const [news,    setNews]    = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [paused,  setPaused]  = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch('/api/news');
        if (!r.ok) return;
        const data = await r.json();
        if (!cancelled) setNews(Array.isArray(data) ? data : []);
      } catch { /* keep existing */ }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (loading) return (
    <div style={{ padding: 10, color: '#f7941d', fontSize: 11 }}>
      <span className="blink">● CARREGANDO NOTÍCIAS...</span>
    </div>
  );

  if (!news.length) return (
    <div style={{ padding: 10, color: '#3a556a', fontSize: 10 }}>Sem notícias.</div>
  );

  const headlines = HEADLINE_SOURCES
    .map(src => news.find(n => n.publisher === src))
    .filter((x): x is NewsItem => x !== undefined);

  const duration = Math.max(news.length * 3, 20);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* TOP HEADLINES — fixed, sem scroll */}
      <div style={{ flexShrink: 0 }}>
        <div style={{
          padding: '4px 10px 3px',
          color: '#f7941d', fontSize: 10, letterSpacing: '0.08em',
          borderBottom: '1px solid #1a2535',
        }}>
          TOP HEADLINES
        </div>
        {headlines.map((item, i) => (
          <HeadlineRow key={item.uuid ?? i} item={item} />
        ))}
        <div style={{ borderBottom: '1px solid #2a3f55' }} />
      </div>

      {/* Feed cronológico — scroll */}
      <div
        style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div style={{
          animation: paused ? 'none' : `news-scroll ${duration}s linear infinite`,
          willChange: 'transform',
        }}>
          {[...news, ...news].map((item, i) => (
            <NewsRow key={`${item.uuid ?? item.title}-${i}`} item={item} />
          ))}
        </div>
      </div>

    </div>
  );
}
