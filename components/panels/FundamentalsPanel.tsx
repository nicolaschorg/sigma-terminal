'use client';
import { useState, useEffect } from 'react';
import { Panel } from '@/types';

interface FundData {
  summaryDetail?: {
    trailingPE?: number;
    forwardPE?: number;
    dividendRate?: number;
    dividendYield?: number;
    beta?: number;
    marketCap?: number;
    fiftyTwoWeekLow?: number;
    fiftyTwoWeekHigh?: number;
    fiftyDayAverage?: number;
    twoHundredDayAverage?: number;
  };
  defaultKeyStatistics?: {
    trailingEps?: number;
    forwardEps?: number;
    priceToBook?: number;
    bookValue?: number;
    enterpriseToEbitda?: number;
    enterpriseToRevenue?: number;
    grossMargins?: number;
    operatingMargins?: number;
    profitMargins?: number;
    returnOnAssets?: number;
    returnOnEquity?: number;
    debtToEquity?: number;
  };
  financialData?: {
    totalRevenue?: number;
    totalCash?: number;
    totalDebt?: number;
    freeCashflow?: number;
    operatingCashflow?: number;
    currentRatio?: number;
    quickRatio?: number;
    grossMargins?: number;
    operatingMargins?: number;
    profitMargins?: number;
    returnOnAssets?: number;
    returnOnEquity?: number;
    debtToEquity?: number;
    revenueGrowth?: number;
    earningsGrowth?: number;
  };
  assetProfile?: {
    longBusinessSummary?: string;
    sector?: string;
    industry?: string;
    fullTimeEmployees?: number;
    country?: string;
    website?: string;
  };
}

const pct = (v?: number) => (v == null || isNaN(v) ? 'N/A' : `${(v * 100).toFixed(2)}%`);
const num = (v?: number, d = 2) =>
  v == null || isNaN(v) ? 'N/A' : v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const big = (v?: number) => {
  if (v == null) return 'N/A';
  if (Math.abs(v) >= 1e12) return (v / 1e12).toFixed(2) + 'T';
  if (Math.abs(v) >= 1e9)  return (v / 1e9).toFixed(2)  + 'B';
  if (Math.abs(v) >= 1e6)  return (v / 1e6).toFixed(2)  + 'M';
  return v.toFixed(0);
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          color: '#f7941d',
          fontSize: 10,
          letterSpacing: 1.5,
          marginBottom: 5,
          paddingBottom: 3,
          borderBottom: '1px solid #1a2d42',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '2px 0',
        fontSize: 11,
      }}
    >
      <span style={{ color: '#7a8fa8' }}>{label}</span>
      <span style={{ color: color ?? '#c8d4e0', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

export default function FundamentalsPanel({ panel }: { panel: Panel }) {
  const [data, setData] = useState<FundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!panel.symbol) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/fundamentals/${panel.symbol}`);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        setData(await r.json());
      } catch { setError('Erro ao carregar fundamentos'); }
      finally { setLoading(false); }
    };

    load();
  }, [panel.symbol]);

  if (loading) return (
    <div style={{ padding: 12, color: '#f7941d', fontSize: 11 }}>
      <span className="blink">● CARREGANDO...</span>
    </div>
  );
  if (error) return <div style={{ padding: 12, color: '#ff4757', fontSize: 11 }}>{error}</div>;
  if (!data) return null;

  const { summaryDetail: sd, defaultKeyStatistics: dk, financialData: fd, assetProfile: ap } = data;

  return (
    <div style={{ padding: 10, overflowY: 'auto', height: '100%' }}>
      {ap && (
        <Section title="EMPRESA">
          {ap.sector    && <Row label="SETOR"        value={ap.sector} />}
          {ap.industry  && <Row label="INDÚSTRIA"    value={ap.industry} />}
          {ap.country   && <Row label="PAÍS"         value={ap.country} />}
          {ap.fullTimeEmployees && (
            <Row label="FUNCIONÁRIOS" value={ap.fullTimeEmployees.toLocaleString('pt-BR')} />
          )}
        </Section>
      )}

      <Section title="AVALIAÇÃO (VALUATION)">
        <Row label="P/L TTM"        value={num(sd?.trailingPE)} />
        <Row label="P/L FORWARD"    value={num(sd?.forwardPE)} />
        <Row label="P/VPA"          value={num(dk?.priceToBook)} />
        <Row label="VPA"            value={num(dk?.bookValue)} />
        <Row label="EV/EBITDA"      value={num(dk?.enterpriseToEbitda)} />
        <Row label="EV/RECEITA"     value={num(dk?.enterpriseToRevenue)} />
        <Row label="LPA TTM"        value={num(dk?.trailingEps)} />
        <Row label="LPA FORWARD"    value={num(dk?.forwardEps)} />
      </Section>

      <Section title="LUCRATIVIDADE">
        <Row label="MARGEM BRUTA"   value={pct(fd?.grossMargins    ?? dk?.grossMargins)} />
        <Row label="MARGEM OPER."   value={pct(fd?.operatingMargins ?? dk?.operatingMargins)} />
        <Row label="MARGEM LÍQUIDA" value={pct(fd?.profitMargins   ?? dk?.profitMargins)} />
        <Row label="ROE"            value={pct(fd?.returnOnEquity  ?? dk?.returnOnEquity)} />
        <Row label="ROA"            value={pct(fd?.returnOnAssets  ?? dk?.returnOnAssets)} />
        {fd?.revenueGrowth  != null && <Row label="CRESC. RECEITA" value={pct(fd.revenueGrowth)} />}
        {fd?.earningsGrowth != null && <Row label="CRESC. LUCRO"   value={pct(fd.earningsGrowth)} />}
      </Section>

      <Section title="BALANÇO">
        <Row label="RECEITA"      value={big(fd?.totalRevenue)} />
        <Row label="CAIXA"        value={big(fd?.totalCash)} />
        <Row label="DÍVIDA TOTAL" value={big(fd?.totalDebt)} />
        <Row label="DIV/PL"       value={num(fd?.debtToEquity ?? dk?.debtToEquity)} />
        <Row label="ÍNDICE CORR." value={num(fd?.currentRatio)} />
        <Row label="ÍNDICE RÁPIDO"value={num(fd?.quickRatio)} />
        <Row label="FCF"          value={big(fd?.freeCashflow)} />
        <Row label="FCO"          value={big(fd?.operatingCashflow)} />
      </Section>

      <Section title="DIVIDENDOS">
        <Row label="DIV. ANUAL"   value={num(sd?.dividendRate)} />
        <Row label="YIELD"        value={pct(sd?.dividendYield)} />
      </Section>

      <Section title="MERCADO">
        <Row label="MARKET CAP"   value={big(sd?.marketCap)} />
        <Row label="BETA"         value={num(sd?.beta)} />
        <Row label="MÁXIMO 52S"   value={num(sd?.fiftyTwoWeekHigh)} />
        <Row label="MÍNIMO 52S"   value={num(sd?.fiftyTwoWeekLow)} />
        <Row label="MM 50 DIAS"   value={num(sd?.fiftyDayAverage)} />
        <Row label="MM 200 DIAS"  value={num(sd?.twoHundredDayAverage)} />
      </Section>

      {ap?.longBusinessSummary && (
        <Section title="DESCRIÇÃO">
          <p style={{ color: '#7a8fa8', fontSize: 10, lineHeight: 1.55 }}>
            {ap.longBusinessSummary.slice(0, 500)}
            {ap.longBusinessSummary.length > 500 ? '…' : ''}
          </p>
        </Section>
      )}
    </div>
  );
}
