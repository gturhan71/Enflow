import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../../services/apiService';
import { ProjectHealthCard, CustomerHealthCard } from '../../components/HealthCards';
import type {
  FunnelReport, TenderAnalytics, BomVarianceReport, ConcentrationReport, ForecastReport, BidScorecard,
  DocumentPortfolio, BusinessHealth, ProjectHealthReport, CustomerHealthReport, DmoAnalytics,
  UnitAbsorptionReport, ArchiveAnalytics,
} from '../../types';
import BusinessHealthCard from './BusinessHealthCard';
import DmoAnalyticsCard from './DmoAnalyticsCard';
import UnitAbsorptionCard from './UnitAbsorptionCard';
import ForecastCard from './ForecastCard';
import FunnelCard from './FunnelCard';
import BidScorecardCard from './BidScorecardCard';
import TenderCard from './TenderCard';
import DocPortfolioCard from './DocPortfolioCard';
import ArchiveCard from './ArchiveCard';
import ConcentrationCard from './ConcentrationCard';
import BomVarianceCard from './BomVarianceCard';

// ── Büyüme Analitiği (Faz 1) ────────────────────────────────────────────────
export default function AnalyticsTab() {
  const [health, setHealth] = useState<BusinessHealth | null>(null);
  const [projectHealth, setProjectHealth] = useState<ProjectHealthReport | null>(null);
  const [customerHealth, setCustomerHealth] = useState<CustomerHealthReport | null>(null);
  const [dmo, setDmo] = useState<DmoAnalytics | null>(null);
  const [absorption, setAbsorption] = useState<UnitAbsorptionReport | null>(null);
  const [funnel, setFunnel] = useState<FunnelReport | null>(null);
  const [tender, setTender] = useState<TenderAnalytics | null>(null);
  const [variance, setVariance] = useState<BomVarianceReport | null>(null);
  const [conc, setConc] = useState<ConcentrationReport | null>(null);
  const [forecast, setForecast] = useState<ForecastReport | null>(null);
  const [scorecard, setScorecard] = useState<BidScorecard | null>(null);
  const [portfolio, setPortfolio] = useState<DocumentPortfolio | null>(null);
  const [archive, setArchive] = useState<ArchiveAnalytics | null>(null);
  const [err, setErr] = useState(false);
  const load = useCallback(() => {
    let active = true;
    Promise.all([apiService.getBusinessHealth(), apiService.getProjectHealth(), apiService.getCustomerHealth(), apiService.getFunnel(), apiService.getTenderAnalytics(), apiService.getBomVariance(), apiService.getConcentration(), apiService.getForecast(), apiService.getBidScorecard(), apiService.getDocumentPortfolio()])
      .then(([hh, ph, ch, f, t, v, c, fc, sc, dp]) => { if (active) { setHealth(hh); setProjectHealth(ph); setCustomerHealth(ch); setFunnel(f); setTender(t); setVariance(v); setConc(c); setForecast(fc); setScorecard(sc); setPortfolio(dp); } })
      .catch(() => { if (active) setErr(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => load(), [load]);
  useEffect(() => { apiService.getDmoAnalytics().then(setDmo).catch(() => {}); }, []); // DMO opsiyonel/ayrı lisans — bloklamaz
  useEffect(() => { apiService.getUnitBudgetAbsorption().then(setAbsorption).catch(() => {}); }, []);
  useEffect(() => { apiService.getArchiveAnalytics().then(setArchive).catch(() => {}); }, []); // rol erişimi olmayabilir — bloklamaz
  const reloadForecast = useCallback(() => { apiService.getForecast().then(setForecast).catch(() => {}); apiService.getBusinessHealth().then(setHealth).catch(() => {}); }, []);
  if (err) return <div className="glass-card p-8 text-center text-slate-400 italic">Analitik verisi alınamadı.</div>;
  if (!health || !projectHealth || !customerHealth || !funnel || !tender || !variance || !conc || !forecast || !scorecard || !portfolio) return <div className="glass-card p-8 text-center text-slate-400 italic">Analitik yükleniyor…</div>;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in duration-500">
      <BusinessHealthCard h={health} />
      {dmo && dmo.totalOrders > 0 && <DmoAnalyticsCard d={dmo} />}
      {absorption && absorption.units.length > 0 && <UnitAbsorptionCard a={absorption} />}
      <ProjectHealthCard p={projectHealth} />
      <CustomerHealthCard c={customerHealth} />
      <ForecastCard f={forecast} onSaved={reloadForecast} />
      <FunnelCard f={funnel} />
      <BidScorecardCard s={scorecard} />
      <TenderCard t={tender} />
      <DocPortfolioCard d={portfolio} />
      {archive && archive.summary.total > 0 && <ArchiveCard d={archive} />}
      <ConcentrationCard c={conc} />
      <BomVarianceCard v={variance} />
    </div>
  );
}
