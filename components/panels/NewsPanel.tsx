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

function fmtTime(pub?: string): string {
  if (!pub) return '';
  const d = new Date(pub);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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

  const duration = Math.max(news.length * 3, 20);

  return (
    <div
      style={{ height: '100%', overflow: 'hidden', position: 'relative' }}
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
  );
}
