'use client';
import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useTerminal } from '@/hooks/useTerminal';
import { getSuggestions } from '@/lib/parser';
import { COMMAND_DESCRIPTIONS } from '@/lib/commands';

export default function CommandBar() {
  const [input,       setInput]       = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { runCommand, navigateHistory } = useTerminal();

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (
        e.key.length === 1 &&
        !e.ctrlKey && !e.metaKey && !e.altKey &&
        document.activeElement !== inputRef.current
      ) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleChange = (val: string) => {
    const upper = val.toUpperCase();
    setInput(upper);
    setSuggestions(getSuggestions(upper));
    setSelectedIdx(-1);
  };

  const commit = (cmd: string) => {
    if (!cmd.trim()) return;
    runCommand(cmd.trim());
    setInput('');
    setSuggestions([]);
    setSelectedIdx(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        commit(selectedIdx >= 0 && suggestions[selectedIdx] ? suggestions[selectedIdx] : input);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (suggestions.length > 0) {
          setSelectedIdx((i) => Math.max(0, i - 1));
        } else {
          const prev = navigateHistory('up');
          if (prev) { setInput(prev); setSuggestions(getSuggestions(prev)); }
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (suggestions.length > 0) {
          setSelectedIdx((i) => Math.min(suggestions.length - 1, i + 1));
        } else {
          const next = navigateHistory('down');
          setInput(next);
          setSuggestions(getSuggestions(next));
        }
        break;
      case 'Tab':
        e.preventDefault();
        if (suggestions.length > 0) {
          const idx = selectedIdx >= 0 ? selectedIdx : 0;
          setInput(suggestions[idx]);
          setSuggestions([]);
          setSelectedIdx(-1);
        }
        break;
      case 'Escape':
        setSuggestions([]);
        setSelectedIdx(-1);
        break;
    }
  };

  return (
    <div style={{
      position: 'relative',
      background: '#060b12',
      borderBottom: '1px solid #1a2535',
      flexShrink: 0,
      zIndex: 50,
    }}>
      {/* ── Pill suggestions — opens downward ── */}
      {suggestions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0, right: 0,
          background: '#060b12',
          borderBottom: '1px solid #1a2535',
          padding: '6px 14px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 5,
          zIndex: 100,
        }}>
          {suggestions.map((sug, i) => {
            const func = sug.split(' ').at(-1) ?? '';
            const desc = COMMAND_DESCRIPTIONS[func] ?? '';
            const active = i === selectedIdx;
            return (
              <button
                key={sug}
                onMouseDown={() => commit(sug)}
                title={desc}
                style={{
                  background: active ? 'rgba(247,148,29,0.12)' : 'rgba(26,37,53,0.6)',
                  border: `1px solid ${active ? 'rgba(247,148,29,0.4)' : '#1a2535'}`,
                  color: active ? '#f7941d' : '#8ba4bc',
                  fontSize: 10,
                  padding: '2px 9px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  borderRadius: 3,
                  letterSpacing: 0.4,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.08s ease',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(26,37,53,1)';
                    (e.currentTarget as HTMLElement).style.color = '#d4dce8';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(26,37,53,0.6)';
                    (e.currentTarget as HTMLElement).style.color = '#8ba4bc';
                  }
                }}
              >{sug}</button>
            );
          })}
        </div>
      )}

      {/* ── Input row ── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '7px 14px', gap: 10 }}>
        <span style={{
          color: '#f7941d',
          fontSize: 14,
          lineHeight: 1,
          flexShrink: 0,
          fontWeight: 600,
        }}>›</span>
        <input
          id="command-input"
          ref={inputRef}
          value={input}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="PETR4 GP  ·  VALE3 DES  ·  ITUB4 YTD  ·  SRCH PETRO  ·  WL ADD MGLU3  ·  MACRO  ·  HELP"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#d4dce8',
            fontSize: 12,
            fontFamily: 'inherit',
            caretColor: '#f7941d',
            letterSpacing: 0.3,
          }}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {input && (
          <span style={{ color: '#3a556a', fontSize: 9, letterSpacing: 1, flexShrink: 0 }}>
            ENTER
          </span>
        )}
      </div>
    </div>
  );
}
