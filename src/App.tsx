import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { 
  NAV_ITEMS, 
} from './constants';
import { 
  Contract,
  Opportunity,
  Project,
  TodoTask,
  Unit,
  User
} from './types';

import Sidebar from './layout/Sidebar';
import Header from './layout/Header';
import Dashboard from './modules/Dashboard';
import PresalesModule from './modules/PresalesModule';
import SalesSupport from './modules/SalesSupport';
import DocumentsModule from './modules/DocumentsModule';
import ProcurementModule from './modules/ProcurementModule';
import TodoModule from './modules/TodoModule';
import SettingsModule from './modules/SettingsModule';
import ContractModule from './modules/ContractModule';
import ProjectManagementModule from './modules/ProjectManagementModule';
import CRMModule from './modules/CRMModule';
import CostAnalysisModule from './modules/CostAnalysisModule';
import ArchiveModule from './modules/ArchiveModule';
import Login from './modules/Login';
import { UnsavedChangesProvider } from './contexts/UnsavedChangesContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { apiService } from './services/apiService';

// --- HEALTH CHECK BANNER ---
const HealthBanner = () => {
  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [isRestarting, setIsRestarting] = useState(false);
  const restartTriggered = React.useRef(false);

  useEffect(() => {
    const check = async (retryCount = 0) => {
      if (isRestarting) return;
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          setStatus('ok');
          restartTriggered.current = false; // Reset on success
        } else {
          throw new Error();
        }
      } catch {
        if (retryCount < 1) {
          // First fail, wait and check again
          console.log('⚠️ Backend check 1 failed, retrying in 2s...');
          setTimeout(() => check(1), 2000);
        } else {
          // Second fail, trigger restart if not already done
          setStatus('error');
          if (!restartTriggered.current) {
            triggerRestart();
          }
        }
      }
    };

    const triggerRestart = async () => {
      if (restartTriggered.current) return;
      restartTriggered.current = true;
      setIsRestarting(true);
      
      console.log('🔄 Backend ulaşılamaz durumda, restart tetikleniyor...');
      try {
        await fetch('http://localhost:3005/restart');
        // Restart sonrası sisteme kendine gelmesi için zaman tanı
        setTimeout(() => {
          setIsRestarting(false);
          check(); // Check again after cooldown
        }, 30000); 
      } catch (err) {
        console.error('Restart servisine ulaşılamadı.');
        setTimeout(() => {
          setIsRestarting(false);
          restartTriggered.current = false;
        }, 5000);
      }
    };

    check();
    const interval = setInterval(() => check(), 15000); // Check every 15s
    return () => clearInterval(interval);
  }, [isRestarting]);

  if (status === 'checking') return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        className="fixed top-4 right-4 z-[9999]"
      >
        <div className={`px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 border backdrop-blur-md transition-all ${
          status === 'ok' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-red-500/10 border-red-500/20 text-red-600 animate-pulse'
        }`}>
          {status === 'ok' ? <CheckCircle2 size={14} /> : <Loader2 size={14} className="animate-spin" />}
          <span className="text-[10px] font-black uppercase tracking-widest italic">
            {status === 'ok' ? 'System Online' : isRestarting ? 'Sistem Yeniden Başlatılıyor...' : 'System Offline'}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

const TenantAppInner = ({ tenantId, onLogout }: { tenantId: string, onLogout: () => void }) => {
  const { currentUser, setCurrentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Auto-fix for legacy 'user1' IDs in localStorage
  useEffect(() => {
    if (currentUser?.id === 'user1') {
      console.log('🧹 Legacy user ID detected, updating to default...');
      setCurrentUser(MOCK_SYSTEM_USERS[0]);
    }
  }, [currentUser, setCurrentUser]);
  
  useEffect(() => {
    const token = localStorage.getItem('enflow_auth_token') || 'mock-token';
    apiService.setAuth(tenantId, token);
  }, [tenantId]);

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [documents, setDocuments] = useState<CorporateDocument[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [companyLogo, setCompanyLogoState] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [oppsData, custData, projData, contrData, tasksData, unitsData, usersData, docsData, propsData] = await Promise.all([
        apiService.getOpportunities(),
        apiService.getCustomers(),
        apiService.getProjects(),
        apiService.getContracts(),
        apiService.getTasks(),
        apiService.getUnits(),
        apiService.getUsers(),
        apiService.getDocuments(),
        apiService.getProposals()
      ]);

      setOpportunities(oppsData);
      setCustomers(custData);
      setProjects(projData);
      setContracts(contrData);
      setTasks(tasksData);
      setUnits(unitsData);
      setSystemUsers(usersData);
      setDocuments(docsData);
      setProposals(propsData);
      
      const savedLogo = localStorage.getItem(`enflow_company_logo_${tenantId}`);
      setCompanyLogoState(savedLogo);
    } catch (error) {
      console.error('Data fetching error:', error);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const handleApproveProposal = async (opportunityId: string) => {
    try {
      const response = await apiService.approveProposal(opportunityId, { note: 'Dashboard üzerinden onaylandı.' });
      setOpportunities(prev => prev.map(opp => opp.id === opportunityId ? { ...opp, technicalStatus: 'APPROVED', status: 'PROPOSAL' } : opp));
      // Refresh other data if needed, but for now just update local state
      console.log('Proposal approved:', response);
    } catch (error) {
      console.error('Approval error:', error);
      alert('Onay işlemi sırasında bir hata oluştu.');
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setCompanyLogo = (logo: string | null) => {
    setCompanyLogoState(logo);
    if (logo) {
      localStorage.setItem(`enflow_company_logo_${tenantId}`, logo);
    } else {
      localStorage.removeItem(`enflow_company_logo_${tenantId}`);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center bg-slate-50/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-6">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-slate-900 font-black uppercase tracking-[0.2em] text-[10px] italic">Veriler Senkronize Ediliyor</p>
          </div>
        </div>
      );
    }

    if (activeTab.startsWith('settings-')) {
      const subTab = activeTab.replace('settings-', '');
      return (
        <SettingsModule 
          companyLogo={companyLogo} 
          setCompanyLogo={setCompanyLogo} 
          activeSubTab={subTab} 
          units={units}
          setUnits={setUnits}
          users={systemUsers}
          setUsers={setSystemUsers}
        />
      );
    }
    
    switch (activeTab) {
      case 'dashboard': return <Dashboard opportunities={opportunities} projects={projects} tasks={tasks} contracts={contracts} onApproveProposal={handleApproveProposal} />;
      case 'crm':
      case 'crm-opportunities':
      case 'crm-customers':
      case 'crm-proposals':
      case 'crm-negotiation':
        return (
          <CRMModule 
            opportunities={opportunities} 
            setOpportunities={setOpportunities} 
            customers={customers} 
            setCustomers={setCustomers} 
            proposals={proposals}
            setProposals={setProposals}
            activeTab={activeTab} 
            tasks={tasks} 
            setTasks={setTasks} 
            setActiveTab={setActiveTab}
          />
        );
      case 'presales': return <PresalesModule opportunities={opportunities} setOpportunities={setOpportunities} units={units} users={systemUsers} />;
      case 'sales-support': return <SalesSupport opportunities={opportunities} />;
      case 'cost-analysis': return <CostAnalysisModule opportunities={opportunities} setOpportunities={setOpportunities} />;
      case 'documents': return <DocumentsModule documents={documents} setDocuments={setDocuments} />;
      case 'contract': return <ContractModule contracts={contracts} setContracts={setContracts} opportunities={opportunities} projects={projects} setProjects={setProjects} tasks={tasks} setTasks={setTasks} />;
      case 'archive': return <ArchiveModule />;
      case 'procurement': return <ProcurementModule projects={projects} setProjects={setProjects} tasks={tasks} setTasks={setTasks} />;
      case 'project-mgmt': return <ProjectManagementModule projects={projects} setProjects={setProjects} tasks={tasks} setTasks={setTasks} setActiveTab={setActiveTab} />;
      case 'todo': return <TodoModule tasks={tasks} setTasks={setTasks} projects={projects} opportunities={opportunities} contracts={contracts} />;
      default: return <Dashboard opportunities={opportunities} projects={projects} tasks={tasks} onApproveProposal={handleApproveProposal} />;
    }
  };

  return (
    <UnsavedChangesProvider>
      <div className="flex h-screen bg-slate-50 overflow-hidden font-geist">
        <HealthBanner />
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={onLogout} companyLogo={companyLogo} />
        <main className="flex-1 flex flex-col min-w-0 relative">
          <Header activeTab={activeTab} companyLogo={companyLogo} onLogout={onLogout} />
          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </UnsavedChangesProvider>
  );
};

const App = () => {
  const [activeTenantId, setActiveTenantId] = useState<string | null>(() => localStorage.getItem('enflow_active_tenant_id'));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!localStorage.getItem('enflow_auth_token'));

  const handleLogin = (tenantId: string) => {
    localStorage.setItem('enflow_active_tenant_id', tenantId);
    setActiveTenantId(tenantId);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('enflow_active_tenant_id');
    localStorage.removeItem('enflow_auth_token');
    setActiveTenantId(null);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated || !activeTenantId) {
    return (
      <>
        <HealthBanner />
        <Login onLogin={handleLogin} />
      </>
    );
  }

  return (
    <AuthProvider tenantId={activeTenantId}>
      <TenantAppInner tenantId={activeTenantId} onLogout={handleLogout} />
    </AuthProvider>
  );
};

export default App;
