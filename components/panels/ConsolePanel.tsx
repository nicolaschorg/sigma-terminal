'use client';
import { Panel } from '@/types';
import { COMMAND_DESCRIPTIONS } from '@/lib/commands';
import { useTerminal } from '@/hooks/useTerminal';

export default function ConsolePanel({ panel }: { panel: Panel }) {
  const { watchlist, addToWatchlist, removeFromWatchlist } = useTerminal();

  return (
    <div style={{ padding: 14, fontSize: 12, lineHeight: 1.7 }}>
      <div style={{ color: '#f7941d', fontSize: 15, letterSpacing: 4, marginBottom: 14, fontWeight: 700 }}>
        SIGMA v0.1
      </div>

      <div style={{ color: '#7a8fa8', marginBottom: 8, fontSize: 11 }}>COMANDOS DISPONÍVEIS</div>

      <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 16 }}>
        <tbody>
          {Object.entries(COMMAND_DESCRIPTIONS).map(([cmd, desc]) => {
            const [short, long] = desc.split('—');
            return (
              <tr key={cmd}>
                <td style={{ color: '#f7941d', paddingRight: 14, paddingBottom: 4, verticalAlign: 'top', whiteSpace: 'nowrap', fontSize: 12 }}>
                  {cmd}
                </td>
                <td style={{ color: '#c8d4e0', paddingBottom: 4, fontSize: 11 }}>
                  <span style={{ color: '#c8d4e0' }}>{short.trim()}</span>
                  {long && <span style={{ color: '#4a5f75' }}> — {long.trim()}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ color: '#7a8fa8', marginBottom: 8, fontSize: 11 }}>USO</div>
      <div style={{ color: '#4a5f75', fontSize: 11, marginBottom: 14 }}>
        <div>{'<SÍMBOLO> <FUNÇÃO>  →  ex: PETR4 GP'}</div>
        <div>{'<FUNÇÃO>            →  ex: ALLQ, HELP'}</div>
        <div>{'<SÍMBOLO>           →  abre gráfico (GP)'}</div>
      </div>

      <div style={{ color: '#7a8fa8', marginBottom: 8, fontSize: 11 }}>WATCHLIST</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {watchlist.map((sym) => (
          <div
            key={sym}
            style={{
              border: '1px solid #1a2d42',
              padding: '2px 8px',
              fontSize: 11,
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#c8d4e0' }}>{sym}</span>
            <button
              onClick={() => removeFromWatchlist(sym)}
              style={{
                background: 'none',
                border: 'none',
                color: '#4a5f75',
                cursor: 'pointer',
                fontSize: 13,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {panel.data != null && (
        <div
          style={{
            marginTop: 16,
            borderTop: '1px solid #1a2d42',
            paddingTop: 12,
          }}
        >
          {panel.func === 'WL' ? (
            // WL feedback — prominent highlight
            <div
              style={{
                background: '#111d2e',
                border: '1px solid #1a3a5c',
                padding: '10px 14px',
                fontSize: 13,
                color: String(panel.data).startsWith('✓') ? '#00d26a' : '#f7941d',
                letterSpacing: 0.5,
              }}
            >
              {String(panel.data)}
            </div>
          ) : (
            <pre style={{ color: '#c8d4e0', fontSize: 11, whiteSpace: 'pre-wrap' }}>
              {String(panel.data)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
