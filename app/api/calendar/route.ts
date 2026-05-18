import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export type EventType = 'COPOM' | 'IPCA' | 'IGP-M' | 'IBGE' | 'RESULTADO' | 'VENC. OPÇÕES' | 'OUTROS';

export interface CalendarEvent {
  date:   string;    // YYYY-MM-DD
  type:   EventType;
  title:  string;
  source: string;
}

function abortAfter(ms: number) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl;
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

// Parse Brazilian date "DD/MM/YYYY HH:mm:ss" → Date
function parseBrDate(s: string): Date | null {
  const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
}

// ── COPOM — BCB API, falls back to hardcoded 2026 schedule if blocked ─────────
const COPOM_2026_FALLBACK: { first: string; decision: string }[] = [
  { first: '2026-06-17', decision: '2026-06-18' },
  { first: '2026-07-29', decision: '2026-07-30' },
  { first: '2026-09-15', decision: '2026-09-16' },
  { first: '2026-10-28', decision: '2026-10-29' },
  { first: '2026-12-09', decision: '2026-12-10' },
];

async function fetchCopom(): Promise<CalendarEvent[]> {
  const now = new Date(); now.setHours(0, 0, 0, 0);

  // Try BCB API
  try {
    const r = await fetch(
      'https://www.bcb.gov.br/api/servico/sitebcb/reunioes-copom/fechamento?quantidade=10&filtro=',
      {
        cache:   'no-store',
        signal:  abortAfter(6_000).signal,
        headers: {
          'Accept':    'application/json',
          'Origin':    'https://www.bcb.gov.br',
          'Referer':   'https://www.bcb.gov.br/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );
    if (r.ok) {
      const data = await r.json();
      const items: CalendarEvent[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const item of (data.conteudo ?? []) as any[]) {
        const raw = item.DataRealizacao2 ?? item.DataRealizacao;
        if (!raw) continue;
        const d = new Date(raw);
        if (isNaN(d.getTime()) || d < now) continue;
        items.push({ date: isoDate(d), type: 'COPOM', title: 'Reunião COPOM — Decisão de Juros', source: 'BCB' });
        if (item.DataRealizacao && item.DataRealizacao !== raw) {
          const d1 = new Date(item.DataRealizacao);
          if (!isNaN(d1.getTime()) && d1 >= now)
            items.push({ date: isoDate(d1), type: 'COPOM', title: 'Reunião COPOM (1º dia)', source: 'BCB' });
        }
      }
      if (items.length) return items;
    }
  } catch { /* fall through to hardcoded */ }

  // Hardcoded fallback — 2026 schedule published by BCB
  return COPOM_2026_FALLBACK.flatMap(({ first, decision }) => {
    const events: CalendarEvent[] = [];
    if (new Date(decision) >= now)
      events.push({ date: decision, type: 'COPOM', title: 'Reunião COPOM — Decisão de Juros', source: 'BCB' });
    if (new Date(first) >= now)
      events.push({ date: first, type: 'COPOM', title: 'Reunião COPOM (1º dia)', source: 'BCB' });
    return events;
  });
}

// ── IBGE — calendário de divulgações ─────────────────────────────────────────
// IBGE titles spell out full names, not abbreviations.
// Each entry is tested with upper.includes(keyword) after title.toUpperCase().
const IBGE_KEYWORDS = [
  // Abbreviated names (sometimes appear in nome_produto)
  'IPCA', 'INPC', 'IGP', 'PIB', 'PNAD', 'PMC', 'PIM', 'PMS',
  // Full-name fragments as they appear in IBGE titles
  'CONSUMIDOR AMPLO',    // IPCA / IPCA-15 / IPCA-E
  'CONSUMIDOR',          // INPC — also catches IPCA (fine, typed below)
  'INDUSTRIAL MENSAL',   // PIM
  'MENSAL DE COM',       // PMC — avoids accented É in COMÉRCIO
  'MENSAL DE SERV',      // PMS — avoids Ç in SERVIÇOS
  'AMOSTRA DE DOM',      // PNAD — avoids Í in DOMICÍLIOS
  'CONTAS NACIONAIS',    // PIB/GDP quarterly
];

async function fetchIbge(): Promise<CalendarEvent[]> {
  const r = await fetch(
    'https://servicodados.ibge.gov.br/api/v3/calendario?view=json',
    { cache: 'no-store', signal: abortAfter(8_000).signal }
  );
  if (!r.ok) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = await r.json();
  // Response: { count, items: [{ titulo, data_divulgacao: "DD/MM/YYYY HH:mm:ss", ... }] }
  const arr: unknown[] = Array.isArray(raw) ? raw : (raw?.items ?? raw?.conteudo ?? []);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const events: CalendarEvent[] = [];

  for (const item of arr as Record<string, unknown>[]) {
    const rawDate = String(item.data_divulgacao ?? item.previsao ?? item.data ?? '');
    const d = parseBrDate(rawDate) ?? new Date(rawDate);
    if (isNaN(d.getTime()) || d < now) continue;

    const title = String(item.titulo ?? item.nome ?? '').trim();
    if (!title) continue;

    const upper = title.toUpperCase();
    // Only surface macro-relevant events
    if (!IBGE_KEYWORDS.some(k => upper.includes(k))) continue;

    const type: EventType = (upper.includes('IPCA') || upper.includes('CONSUMIDOR AMPLO')) ? 'IPCA'
                          : upper.includes('IGP')  ? 'IGP-M'
                          : 'IBGE';

    events.push({ date: isoDate(d), type, title, source: 'IBGE' });
  }

  // Sort chronologically, deduplicate by date+type, return max 8 future events
  events.sort((a, b) => a.date.localeCompare(b.date));
  const seen = new Set<string>();
  return events.filter(e => {
    const k = `${e.date}|${e.type}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 8);
}

// ── Brapi — earnings das empresas da watchlist ────────────────────────────────
async function fetchEarnings(symbols: string[]): Promise<CalendarEvent[]> {
  if (!symbols.length) return [];
  const tok = process.env.BRAPI_TOKEN ?? '';
  const r   = await fetch(
    `https://brapi.dev/api/quote/${symbols.join(',')}?modules=calendarEvents&token=${tok}`,
    { cache: 'no-store', signal: abortAfter(8_000).signal }
  );
  if (!r.ok) return [];
  const data = await r.json();
  const events: CalendarEvent[] = [];
  const now = new Date(); now.setHours(0, 0, 0, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const q of (data.results ?? []) as any[]) {
    const sym   = String(q.symbol ?? '').replace(/\.SA$/i, '');
    const dates: string[] = q.calendarEvents?.earnings?.earningsDate ?? [];
    for (const ds of dates) {
      const d = new Date(ds);
      if (isNaN(d.getTime()) || d < now) continue;
      events.push({ date: isoDate(d), type: 'RESULTADO', title: `${sym} — Resultado`, source: 'Brapi' });
    }
  }
  return events;
}

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get('symbols') ?? 'PETR4,VALE3,ITUB4,BBDC4,ABEV3';
  const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 10);

  const [copomRes, ibgeRes, earningsRes] = await Promise.allSettled([
    fetchCopom(),
    fetchIbge(),
    fetchEarnings(symbols),
  ]);

  const all: CalendarEvent[] = [
    ...(copomRes.status    === 'fulfilled' ? copomRes.value    : []),
    ...(ibgeRes.status     === 'fulfilled' ? ibgeRes.value     : []),
    ...(earningsRes.status === 'fulfilled' ? earningsRes.value : []),
  ];

  // Deduplicate (same date + type + title) then sort
  const seen = new Set<string>();
  const unique = all.filter(e => {
    const key = `${e.date}|${e.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json(unique.slice(0, 15));
}
