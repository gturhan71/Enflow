import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../../services/apiService';
import { useDashboardStream } from '../dashboard/useDashboardStream';
import { ProjectHealthCard, CustomerHealthCard } from '../../components/HealthCards';
import type {
  FunnelReport, TenderAnalytics, BomVarianceReport, ConcentrationReport, ForecastReport, BidScorecard,
  DocumentPortfolio, BusinessHealth, ProjectHealthReport, CustomerHealthReport, DmoAnalytics,
  UnitAbsorptionReport, ArchiveAnalytics, BrandCategoryAnalytics,
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
import BrandCategoryCard from './BrandCategoryCard';

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
  const [brandCat, setBrandCat] = useState<BrandCategoryAnalytics | null>(null);
  const [err, setErr] = useState(false);
  const load = useCallback(() => {
    let active = true;
    Promise.all([apiService.getBusinessHealth(), apiService.getProjectHealth(), apiService.getCustomerHealth(), apiService.getFunnel(), apiService.getTenderAnalytics(), apiService.getBomVariance(), apiService.getConcentration(), apiService.getForecast(), apiService.getBidScorecard(), apiService.getDocumentPortfolio()])
      .then(([hh, ph, ch, f, t, v, c, fc, sc, dp]) => { if (active) { setHealth(hh); setProjectHealth(ph); setCustomerHealth(ch); setFunnel(f); setTender(t); setVariance(v); setConc(c); setForecast(fc); setScorecard(sc); setPortfolio(dp); } })
      .catch(() => { if (active) setErr(true); });
    return () => { active = false; };
  }, []);
  const loadDmo = useCallback(() => { apiService.getDmoAnalytics().then(setDmo).catch(() => {}); }, []); // DMO opsiyonel/ayrı lisans — bloklamaz
  const loadAbsorption = useCallback(() => { apiService.getUnitBudgetAbsorption().then(setAbsorption).catch(() => {}); }, []);
  const loadArchive = useCallback(() => { apiService.getArchiveAnalytics().then(setArchive).catch(() => {}); }, []); // rol erişimi olmayabilir — bloklamaz
  const loadBrandCat = useCallback(() => { apiService.getBrandCategoryAnalytics().then(setBrandCat).catch(() => {}); }, []);
  useEffect(() => load(), [load]);
  useEffect(() => { loadDmo(); }, [loadDmo]);
  useEffect(() => { loadAbsorption(); }, [loadAbsorption]);
  useEffect(() => { loadArchive(); }, [loadArchive]);
  useEffect(() => { loadBrandCat(); }, [loadBrandCat]);
  const reloadForecast = useCallback(() => { apiService.getForecast().then(setForecast).catch(() => {}); apiService.getBusinessHealth().then(setHealth).catch(() => {}); }, []);

  // Canlı güncelleme: bir ihale kazanıldı işaretlendiğinde (veya tenant'ta başka bir
  // mutasyon olduğunda) sunucudan gelen "bir şey değişti" sinyaliyle (bkz. Dashboard.tsx
  // ile paylaşımlı SSE — pingDashboard/useDashboardStream) tüm raporlar anında yeniden
  // çekilir; sekmeden çıkıp geri girmeye ya da sayfayı yenilemeye gerek kalmaz. Art arda
  // gelen sinyalleri (toplu işlem) tek istek turuna toplamak için hafif debounce uygulanır.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshAll = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      load(); loadDmo(); loadAbsorption(); loadArchive(); loadBrandCat();
    }, 600);
  }, [load, loadDmo, loadAbsorption, loadArchive, loadBrandCat]);
  useDashboardStream(refreshAll);
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
      {brandCat && (brandCat.byBrand.length > 0 || brandCat.byCategory.length > 0 || brandCat.byVendor.length > 0) && <BrandCategoryCard d={brandCat} />}
    </div>
  );
}
