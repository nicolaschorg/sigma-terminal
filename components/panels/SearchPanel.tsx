'use client';
import { useState, useEffect } from 'react';
import { Panel } from '@/types';
import { useTerminal } from '@/hooks/useTerminal';

interface SearchResult {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  quoteType?: string;
  sector?: string;
  industry?: string;
  score?: number;
}

const TYPE_LABEL: Record<string, string> = {
  EQUITY:         'AÇÃO',
  ETF:            'ETF',
  MUTUALFUND:     'FUNDO',
  CURRENCY:       'MOEDA',
  CRYPTOCURRENCY: 'CRYPTO',
  INDEX:          'ÍNDICE',
  FUTURE:         'FUTURO',
  OPTION:         'OPÇÃO',
};

const ACTIONS = ['GP', 'DES', 'FA', 'NEWS'] as const;

export default function SearchPanel({ panel }: { panel: Panel }) {
  const query = String(panel.data ?? '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const { runCommand } = useTerminal();

  useEffect(() => {
    if (!query.trim()) { setLoading(false); return; }
    const search = async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json();
        setResults(Array.isArray(d) ? d : []);
      } catch { setError('Search error'); }
      finally { setLoading(false); }
    };
    search();
  }, [query]);

  if (loading) return (
    <div style={{ padding: 12, color: '#f7941d', fontSize: 11 }}>
      <span className="blink">● SEARCHING &quot;{query}&quot;...</span>
    </div>
  );
  if (error) return <div style={{ padding: 12, color: '#ff4757', fontSize: 11 }}>{error}</div>;
  if (!results.length) return (
    <div style={{ padding: 12, color: '#7a8fa8', fontSize: 12 }}>
      No results for <span style={{ color: '#c8d4e0' }}>&quot;{query}&quot;</span>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid #1a2d42', fontSize: 10, color: '#4a5f75' }}>
        {results.length} result{results.length !== 1 ? 's' : ''} for&nbsp;
        <span style={{ color: '#f7941d' }}>&quot;{query}&quot;</span>
      </div>

      {results.map((r) => {
        const typeLabel = r.quoteType ? (TYPE_LABEL[r.quoteType] ?? r.quoteType) : null;
        return (
          <div
            key={r.symbol}
            style={{ padding: '10px 12px', borderBottom: '1px solid #1a2d42' }}
          >
            {/* Row 1 — symbol + type badge + exchange */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ color: '#f7941d', fontSize: 14, fontWeight: 700, minWidth: 90 }}>
                {r.symbol}
              </span>
              {typeLabel && (
                <span style={{
                  fontSize: 9, background: '#1a3a5c', color: '#7a8fa8',
                  padding: '1px 6px', borderRadius: 2, letterSpacing: 0.5,
                }}>
                  {typeLabel}
                </span>
              )}
              {r.exchange && (
                <span style={{ fontSize: 10, color: '#4a5f75' }}>{r.exchange}</span>
              )}
            </div>

            {/* Row 2 — company name */}
            <div style={{ color: '#c8d4e0', fontSize: 12, marginBottom: 3 }}>
              {r.longname ?? r.shortname ?? '—'}
            </div>

            {/* Row 3 — sector / industry */}
            {(r.sector || r.industry) && (
              <div style={{ fontSize: 10, color: '#4a5f75', marginBottom: 6 }}>
                {[r.sector, r.industry].filter(Boolean).join(' · ')}
              </div>
            )}

            {/* Row 4 — action buttons */}
            <div style={{ display: 'flex', gap: 5 }}>
              {ACTIONS.map((fn) => (
                <button
                  key={fn}
                  onClick={() => runCommand(`${r.symbol} ${fn}`)}
                  style={{
                    background: '#1a2d42',
                    border: 'none',
                    color: '#c8d4e0',
                    fontSize: 10,
                    padding: '3px 9px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    borderRadius: 2,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = '#f7941d';
                    el.style.color = '#0a0f1a';
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = '#1a2d42';
                    el.style.color = '#c8d4e0';
                  }}
                >
                  {fn}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
