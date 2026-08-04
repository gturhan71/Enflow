import { useState, useEffect, useCallback, useMemo, type FC } from 'react';
import { Plus, Search, RefreshCw, Layers, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { ProjectHealthCard } from '../components/HealthCards';
import { fmtCurrencyExact as fmt } from '../lib/format';
import {
  Project, ProjectStatus, User, Unit, Opportunity, ProjectHealthReport,
} from '../types';
import { PROJECT_TYPE_LABEL, STATUS_CONFIG } from './project-mgmt/constants';
import { calcFinancials, printProjectReport } from './project-mgmt/helpers';
import OpportunityPicker from './project-mgmt/OpportunityPicker';
import ProjectForm from './project-mgmt/ProjectForm';
import ProjectDetail from './project-mgmt/ProjectDetail';
import KanbanView from './project-mgmt/KanbanView';
import ProjectListView from './project-mgmt/ProjectListView';
import RiskPanel from './project-mgmt/RiskPanel';

interface ProjectManagementModuleProps {
  users?: User[];
  units?: Unit[];
  customers?: { id: string; name: string }[];
  setActiveTab?: (tab: string) => void;
  initialItemId?: string | null;
}

const ProjectManagementModule: FC<ProjectManagementModuleProps> = ({ users = [], customers = [], initialItemId }) => {
  const { currentUser } = useAuth();
  const [view, setView] = useState<'dashboard' | 'list'>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [wonOpportunities, setWonOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showOppPicker, setShowOppPicker] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [prefilledProject, setPrefilledProject] = useState<Partial<Project> & { opportunityId?: string } | undefined>(undefined);
  const [projectHealth, setProjectHealth] = useState<ProjectHealthReport | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getProjects() as Project[];
      setProjects(data);
      if (selectedProject) {
        const upd = data.find(p => p.id === selectedProject.id);
        if (upd) setSelectedProject(upd);
      }
    } finally { setLoading(false); }
  }, [selectedProject?.id]);

  const loadWonOpportunities = useCallback(async () => {
    const data = await apiService.getOpportunities() as Opportunity[];
    setWonOpportunities(data.filter(o => o.status === 'WON'));
  }, []);

  useEffect(() => { loadProjects(); loadWonOpportunities(); apiService.getProjectHealth().then(setProjectHealth).catch(() => {}); }, []);

  // Deep-link: bildirim/görev "Git" ile gelen projeyi otomatik aç.
  useEffect(() => {
    if (!initialItemId) return;
    const p = projects.find(x => x.id === initialItemId);
    if (p) { setView('list'); setSelectedProject(p); }
  }, [initialItemId, projects]);

  const existingProjectOppIds = useMemo(
    () => new Set(projects.map(p => p.opportunityId).filter(Boolean) as string[]),
    [projects]
  );

  const handleNewProjectClick = () => {
    setEditProject(null);
    setPrefilledProject(undefined);
    setShowOppPicker(true);
  };

  const handleOppSelect = (opp: Opportunity) => {
    setShowOppPicker(false);
    setPrefilledProject({
      name: opp.title,
      customerId: opp.customerId ?? undefined,
      customerName: opp.customer?.name ?? undefined,
      totalValue: opp.value ?? 0,
      budgetTotal: opp.value ?? 0,
      opportunityId: opp.id,
    } as Partial<Project> & { opportunityId: string });
    setShowProjectForm(true);
  };

  const handleCreateProject = async (data: Record<string, unknown>) => {
    await apiService.createProject(data);
    setShowProjectForm(false);
    setPrefilledProject(undefined);
    loadProjects();
  };

  const handleUpdateProject = async (data: Record<string, unknown>) => {
    if (!editProject) return;
    await apiService.updateProject(editProject.id, data);
    setEditProject(null);
    setShowProjectForm(false);
    loadProjects();
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Bu proje silinsin mi?')) return;
    await apiService.deleteProject(id);
    if (selectedProject?.id === id) setSelectedProject(null);
    loadProjects();
  };

  const filtered = useMemo(() => projects.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.customerName?.toLowerCase().includes(q) || false;
    const matchS = !filterStatus || p.status === filterStatus;
    const matchT = !filterType || p.type === filterType;
    return matchQ && matchS && matchT;
  }), [projects, search, filterStatus, filterType]);

  // Dashboard metrikleri
  const metrics = useMemo(() => {
    const active = projects.filter(p => p.status === 'IN_PROGRESS' || p.status === 'PLANNING');
    const totalVal = active.reduce((s, p) => s + p.totalValue, 0);
    const delayed = projects.filter(p => {
      const fin = calcFinancials(p);
      return fin.delayedMs > 0 && p.status !== 'COMPLETED' && p.status !== 'CANCELLED';
    }).length;
    const avgMargin = active.length
      ? active.reduce((s, p) => s + calcFinancials(p).actualMargin, 0) / active.length
      : 0;
    return { active: active.length, totalVal, delayed, avgMargin };
  }, [projects]);

  // Kanban gruplandırma
  const kanbanGroups = useMemo(() => {
    const statuses: ProjectStatus[] = ['PLANNING','IN_PROGRESS','ON_HOLD','COMPLETED'];
    return statuses.map(s => ({ status: s, projects: projects.filter(p => p.status === s) }));
  }, [projects]);

  // Risk paneli
  const riskProjects = useMemo(() => projects.filter(p => {
    if (p.status === 'COMPLETED' || p.status === 'CANCELLED') return false;
    const fin = calcFinancials(p);
    return fin.delayedMs > 0 || fin.actualMargin < fin.plannedMargin - 5 || (p.budgetTotal > 0 && fin.totalActual > p.budgetTotal * 0.85);
  }), [projects]);

  const toggleSelectProject = (p: Project) => setSelectedProject(prev => prev?.id === p.id ? null : p);

  return (
    <div className="flex h-full">
      <div className={`flex-1 overflow-y-auto transition-all ${selectedProject ? 'mr-[640px]' : ''}`}>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Proje Yönetimi</h2>
              <p className="text-sm text-slate-400 mt-0.5">Satınalma'dan tahsilata tam proje yaşam döngüsü</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadProjects} className="p-2 hover:bg-white/10 rounded-xl text-slate-400">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
              <button onClick={handleNewProjectClick}
                className="btn-primary px-4 py-2 text-sm rounded-xl flex items-center gap-2">
                <Plus size={16} /> Yeni Proje
              </button>
            </div>
          </div>

          {/* Metrik kartlar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Aktif Proje',     value: metrics.active,            icon: <Layers size={20} />,    color: 'text-indigo-400' },
              { label: 'Toplam Değer',    value: fmt(metrics.totalVal),     icon: <DollarSign size={20} />,color: 'text-green-400'  },
              { label: 'Ort. Kar Marjı',  value: `%${metrics.avgMargin.toFixed(1)}`, icon: <TrendingUp size={20} />, color: metrics.avgMargin >= 15 ? 'text-green-400' : 'text-amber-400' },
              { label: 'Gecikmiş Proje',  value: metrics.delayed,           icon: <AlertCircle size={20} />,color: metrics.delayed > 0 ? 'text-red-400' : 'text-slate-400' },
            ].map(m => (
              <div key={m.label} className="glass-card rounded-2xl p-4">
                <div className={`${m.color} mb-2`}>{m.icon}</div>
                <p className="text-2xl font-bold">{m.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Proje sağlığı (analitikle ortak kart) */}
          {projectHealth && projectHealth.summary.total > 0 && <ProjectHealthCard p={projectHealth} className="" />}

          {/* View toggle */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
              {[{ key: 'dashboard', label: 'Kanban' }, { key: 'list', label: 'Liste' }].map(v => (
                <button key={v.key} onClick={() => setView(v.key as typeof view)}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${view === v.key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                  {v.label}
                </button>
              ))}
            </div>
            {view === 'list' && (
              <div className="flex gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara…"
                    className="input-glass pl-8 pr-3 py-1.5 text-sm rounded-xl w-48" />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-glass px-2 py-1.5 text-sm rounded-xl">
                  <option value="">Tüm Durumlar</option>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-glass px-2 py-1.5 text-sm rounded-xl">
                  <option value="">Tüm Tipler</option>
                  {Object.entries(PROJECT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            )}
          </div>

          {view === 'dashboard' && (
            <KanbanView kanbanGroups={kanbanGroups} selectedProjectId={selectedProject?.id} onSelect={toggleSelectProject} />
          )}

          {view === 'list' && (
            <ProjectListView
              loading={loading}
              filtered={filtered}
              selectedProjectId={selectedProject?.id}
              onSelect={toggleSelectProject}
              onEdit={(p) => { setEditProject(p); setShowProjectForm(true); }}
              onDelete={handleDeleteProject}
            />
          )}

          <RiskPanel riskProjects={riskProjects} onSelect={setSelectedProject} />
        </div>
      </div>

      {/* Detay Çekmecesi */}
      <AnimatePresence>
        {selectedProject && (
          <>
            <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px]" onClick={() => setSelectedProject(null)} />
            <ProjectDetail
              project={selectedProject}
              users={users}
              currentUserRole={currentUser?.role}
              currentUserId={currentUser?.id}
              onClose={() => setSelectedProject(null)}
              onRefresh={loadProjects}
              onPrintReport={printProjectReport}
            />
          </>
        )}
      </AnimatePresence>

      {/* Fırsat Seçici */}
      <AnimatePresence>
        {showOppPicker && (
          <OpportunityPicker
            opportunities={wonOpportunities}
            existingProjectOppIds={existingProjectOppIds}
            onSelect={handleOppSelect}
            onBlank={() => { setShowOppPicker(false); setPrefilledProject(undefined); setShowProjectForm(true); }}
            onClose={() => setShowOppPicker(false)}
          />
        )}
      </AnimatePresence>

      {/* Proje Formu */}
      <AnimatePresence>
        {showProjectForm && (
          <ProjectForm
            initial={editProject ?? prefilledProject as Partial<Project> | undefined}
            users={users}
            customers={customers}
            onSave={editProject ? handleUpdateProject : handleCreateProject}
            onClose={() => { setShowProjectForm(false); setEditProject(null); setPrefilledProject(undefined); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProjectManagementModule;
