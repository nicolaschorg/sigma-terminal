import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

export const dynamic = 'force-dynamic';

const FEEDS = [
  { url: 'https://www.infomoney.com.br/feed/',      source: 'InfoMoney' },
  { url: 'https://exame.com/feed/',                 source: 'Exame' },
  { url: 'https://g1.globo.com/rss/g1/economia/',  source: 'G1' },
  { url: 'https://www.cnnbrasil.com.br/feed/',      source: 'CNN Brasil' },
  { url: 'https://metropoles.com/feed/',            source: 'Metrópoles' },
];

interface NewsItem {
  uuid:                string;
  title:               string;
  link:                string;
  publisher:           string;
  providerPublishTime: number;
}

function abortAfter(ms: number): AbortController {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl;
}

// Decode numeric and named HTML entities
function decodeEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g,        (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g,   '&')
    .replace(/&quot;/g,  '"')
    .replace(/&apos;/g,  "'")
    .replace(/&lt;/g,    '<')
    .replace(/&gt;/g,    '>')
    .replace(/&nbsp;/g,  ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rsquo;/g, '’')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveText(v: unknown): string {
  if (typeof v === 'string') return decodeEntities(v);
  if (v && typeof v === 'object' && '#text' in (v as object))
    return decodeEntities(String((v as Record<string, unknown>)['#text']));
  return '';
}

function resolveLink(v: unknown): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    const alt = v.find((x) => x?.['@_rel'] === 'alternate') ?? v[0];
    return resolveText(alt?.['@_href'] ?? alt) || '#';
  }
  if (v && typeof v === 'object') {
    const rec = v as Record<string, unknown>;
    return resolveText(rec['@_href'] ?? rec['#text'] ?? '') || '#';
  }
  return '#';
}

export async function GET() {
  const parser = new XMLParser({
    ignoreAttributes:    false,
    attributeNamePrefix: '@_',
    // Let fast-xml-parser handle known XML entities; we decode HTML entities ourselves
    processEntities:     true,
    htmlEntities:        true,
  });

  const allItems: NewsItem[] = [];

  await Promise.allSettled(
    FEEDS.map(async ({ url, source }) => {
      try {
        const r = await fetch(url, {
          cache:   'no-store',
          signal:  abortAfter(8_000).signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; sigma/1.0)' },
        });
        if (!r.ok) return;

        const xml  = await r.text();
        const parsed = parser.parse(xml);

        // Support both RSS 2.0 (<item>) and Atom (<entry>)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw: any =
          parsed?.rss?.channel?.item ??
          parsed?.feed?.entry ??
          [];

        const items = Array.isArray(raw) ? raw : [raw];

        for (const item of items) {
          const title = resolveText(item.title);
          const link  = resolveLink(item.link ?? item.guid);
          const pub   = resolveText(item.pubDate ?? item.published ?? item.updated ?? '');
          const ts    = pub ? Math.floor(new Date(pub).getTime() / 1000) : 0;

          if (title) {
            allItems.push({
              uuid:                `${source}-${ts}-${Math.random().toString(36).slice(2)}`,
              title,
              link,
              publisher:           source,
              providerPublishTime: ts,
            });
          }
        }
      } catch (err) { console.error(`[news] feed failed: ${source}`, err); }
    })
  );

  allItems.sort((a, b) => b.providerPublishTime - a.providerPublishTime);

  return NextResponse.json(allItems.slice(0, 40));
}
