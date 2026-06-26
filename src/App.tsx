import React, { useState, useEffect } from 'react';
import { logger } from './utils/logger';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';

// Global alert interceptor mapping alert() to Sonner toasts
if (typeof window !== 'undefined') {
  window.alert = (message: unknown) => {
    const msgStr = String(message);
    const msg = msgStr.toLowerCase();
    if (msg.includes('hata') || msg.includes('fail') || msg.includes('başarısız') || msg.includes('geçersiz') || msg.includes('olmadı') || msg.includes('silinemedi')) {
      toast.error(msgStr);
    } else if (msg.includes('başarı') || msg.includes('tebrikler') || msg.includes('ok') || msg.includes('onaylandı') || msg.includes('kazanıldı') || msg.includes('tamamlandı')) {
      toast.success(msgStr);
    } else {
      toast(msgStr);
    }
  };
}
import { 
  MOCK_SYSTEM_USERS 
} from './constants';
import {
  Contract,
  Customer,
  Opportunity,
  Project,
  TodoTask,
  Unit,
  User,
  CorporateDocument
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
import VisitPlanModule from './modules/VisitPlanModule';
import CRMModule from './modules/CRMModule';
import CostAnalysisModule from './modules/CostAnalysisModule';
import ArchiveModule from './modules/ArchiveModule';
import SubscriptionModule from './modules/SubscriptionModule';
import ContractWorkflowModule from './modules/ContractWorkflowModule';
import SecurityTestModule from './modules/SecurityTestModule';
import LicenseGeneratorModule from './modules/LicenseGeneratorModule';
import CorporateGovernanceModule from './modules/CorporateGovernanceModule';
import FinanceModule from './modules/FinanceModule';
import ManagementReportingModule from './modules/ManagementReportingModule';
import VirtualAgentsTestModule from './modules/VirtualAgentsTestModule';
import ActivityLogModule from './modules/ActivityLogModule';
import Login from './modules/Login';
import { UnsavedChangesProvider } from './contexts/UnsavedChangesContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AIGateProvider } from './contexts/AIGateContext';
import { apiService } from './services/apiService';
import { ThemeProvider } from './contexts/ThemeContext';

import {
  useOpportunities,
  useCustomers,
  useProjects,
  useContracts,
  useTasks,
  useUnits,
  useUsers,
  useDocuments,
  useProposals
} from './hooks/useEnflowQueries';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

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
          restartTriggered.current = false;
        } else {
          throw new Error();
        }
      } catch {
        if (retryCount < 1) {
          logger.warn('⚠️ Backend check 1 failed, retrying in 2s...');
          setTimeout(() => check(1), 2000);
        } else {
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
      
      logger.warn('🔄 Backend ulaşılamaz durumda, restart tetikleniyor...');
      try {
        await fetch('http://localhost:3005/restart');
        setTimeout(() => {
          setIsRestarting(false);
          check();
        }, 30000); 
      } catch (err) {
        logger.error('Restart servisine ulaşılamadı.');
        setTimeout(() => {
          setIsRestarting(false);
          restartTriggered.current = false;
        }, 5000);
      }
    };

    check();
    const interval = setInterval(() => check(), 15000);
    return () => clearInterval(interval);
  }, [isRestarting]);

  if (status === 'checking') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] lg:right-auto lg:bottom-auto lg:left-8 lg:top-[calc(0.5rem+env(safe-area-inset-top))] z-[9999] pointer-events-none"
      >
        <div className={`flex items-center gap-0 lg:gap-2 p-2 lg:px-4 lg:py-2 rounded-full lg:rounded-xl shadow-lg border backdrop-blur-md transition-all ${
          status === 'ok'
            ? 'bg-emerald-500 lg:bg-emerald-500/10 border-emerald-500/30 lg:border-emerald-500/20 text-white lg:text-emerald-600'
            : 'bg-red-500 lg:bg-red-500/10 border-red-500/30 lg:border-red-500/20 text-white lg:text-red-600 animate-pulse'
        }`}>
          {status === 'ok' ? <CheckCircle2 size={14} /> : <Loader2 size={14} className="animate-spin" />}
          <span className="hidden lg:inline text-[10px] font-black uppercase tracking-widest italic font-sans">
            {status === 'ok' ? 'System Online' : isRestarting ? 'Sistem Yeniden Başlatılıyor...' : 'System Offline'}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

const TenantAppInner = ({ 
  tenantId, 
  setTenantId,
  onLogout, 
  companyLogo 
}: { 
  tenantId: string, 
  setTenantId: (id: string) => void,
  onLogout: () => void, 
  companyLogo: string | null 
}) => {
  const { currentUser, setCurrentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (currentUser?.id === 'user1') {
      logger.debug('🧹 Legacy user ID detected, updating to default...');
      setCurrentUser(MOCK_SYSTEM_USERS[0]);
    }
  }, [currentUser, setCurrentUser]);
  
  useEffect(() => {
    const token = localStorage.getItem('enflow_auth_token') || 'mock-token';
    apiService.setAuth(tenantId, token);
  }, [tenantId]);

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [documents, setDocuments] = useState<CorporateDocument[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);

  // Lazy load enabled flags based on active tab
  const isCrmActive = activeTab.startsWith('crm');
  const isDashboardActive = activeTab === 'dashboard';
  const isPresalesActive = activeTab === 'presales';
  const isSettingsActive = activeTab.startsWith('settings-');
  const isProjectActive = activeTab === 'project-mgmt' || activeTab === 'procurement';
  const isVisitPlanActive = activeTab === 'visit-plan';
  const isTodoActive = activeTab === 'todo';
  const isDocsActive = activeTab === 'documents';
  const isContractsActive = activeTab === 'contracts';
  const isCostActive = activeTab === 'cost-analysis' || activeTab === 'crm-cost';
  const isContractWorkflowActive = activeTab === 'contract-workflow' || activeTab === 'contract-workflow-test';

  const { data: opportunitiesData, isLoading: opportunitiesLoading } = useOpportunities(tenantId, {
    enabled: isCrmActive || isDashboardActive || isPresalesActive || isContractsActive || isTodoActive || isCostActive || isContractWorkflowActive || isVisitPlanActive
  });
  const { data: customersData } = useCustomers(tenantId, {
    enabled: isCrmActive || isVisitPlanActive
  });
  const { data: projectsData, isLoading: projectsLoading } = useProjects(tenantId, {
    enabled: isDashboardActive || isProjectActive || isContractsActive || isTodoActive || isVisitPlanActive
  });
  const { data: contractsData, isLoading: contractsLoading } = useContracts(tenantId, {
    enabled: isDashboardActive || isContractsActive || isTodoActive
  });
  const { data: tasksData, isLoading: tasksLoading } = useTasks(tenantId, {
    enabled: isDashboardActive || isCrmActive || isProjectActive || isContractsActive || isTodoActive
  });
  const { data: unitsData, isLoading: unitsLoading } = useUnits(tenantId, {
    enabled: isSettingsActive || isPresalesActive || isDashboardActive || isTodoActive
  });
  const { data: systemUsersData, isLoading: systemUsersLoading } = useUsers(tenantId, {
    enabled: isSettingsActive || isPresalesActive
  });
  const { data: documentsData, isLoading: documentsLoading } = useDocuments(tenantId, {
    enabled: isDocsActive
  });
  const { data: proposalsData, isLoading: proposalsLoading } = useProposals(tenantId, {
    enabled: isCrmActive || isTodoActive || isDashboardActive || isContractWorkflowActive
  });

  // Sync React Query data to local state for compatibility
  useEffect(() => { if (opportunitiesData) setOpportunities(opportunitiesData); }, [opportunitiesData]);
  useEffect(() => { if (customersData) setCustomers(customersData); }, [customersData]);
  useEffect(() => { if (projectsData) setProjects(projectsData); }, [projectsData]);
  useEffect(() => { if (contractsData) setContracts(contractsData); }, [contractsData]);
  useEffect(() => { if (tasksData) setTasks(tasksData); }, [tasksData]);
  useEffect(() => { if (unitsData) setUnits(unitsData); }, [unitsData]);
  useEffect(() => { if (systemUsersData) setSystemUsers(systemUsersData); }, [systemUsersData]);
  useEffect(() => { if (documentsData) setDocuments(documentsData); }, [documentsData]);
  useEffect(() => { if (proposalsData) setProposals(proposalsData); }, [proposalsData]);

  // Combined Loading state based on active tab
  const loading = 
    (isCrmActive && opportunitiesLoading) ||
    (isDashboardActive && (opportunitiesLoading || projectsLoading || tasksLoading || contractsLoading)) ||
    (isPresalesActive && (opportunitiesLoading || unitsLoading || systemUsersLoading)) ||
    (isSettingsActive && (unitsLoading || systemUsersLoading)) ||
    (isProjectActive && (projectsLoading || tasksLoading)) ||
    (isTodoActive && (tasksLoading || projectsLoading || opportunitiesLoading || contractsLoading || proposalsLoading)) ||
    (isDocsActive && documentsLoading) ||
    (isContractsActive && (contractsLoading || opportunitiesLoading || projectsLoading || tasksLoading)) ||
    (isCostActive && opportunitiesLoading);

  const handleApproveProposal = async (opportunityId: string) => {
    try {
      await apiService.approveProposal(opportunityId, { note: 'Dashboard üzerinden onaylandı.' });
      setOpportunities(prev => prev.map(opp => opp.id === opportunityId ? { ...opp, technicalStatus: 'APPROVED' as const, status: 'PROPOSAL' as const } : opp));
    } catch (error) {
      logger.error('Approval error:', error);
      alert('Onay işlemi sırasında bir hata oluştu.');
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center bg-background/50 backdrop-blur-sm h-full">
          <div className="flex flex-col items-center gap-6">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-foreground font-black uppercase tracking-[0.2em] text-[10px] italic">Veriler Senkronize Ediliyor</p>
          </div>
        </div>
      );
    }

    if (activeTab.startsWith('settings-')) {
      const subTab = activeTab.replace('settings-', '');
      return (
        <SettingsModule 
          companyLogo={companyLogo} 
          setCompanyLogo={() => {}} 
          activeSubTab={subTab} 
          units={units}
          setUnits={setUnits}
          users={systemUsers}
          setUsers={setSystemUsers}
          activeTenantId={tenantId}
          setActiveTenantId={setTenantId}
        />
      );
    }
    
    switch (activeTab) {
      case 'dashboard': return <Dashboard opportunities={opportunities} projects={projects} tasks={tasks} contracts={contracts} units={units} proposals={proposals} onApproveProposal={handleApproveProposal} onNavigate={setActiveTab} />;
      case 'crm':
      case 'crm-dashboard':
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
      // Presales & alt sekmeler
      case 'presales':
      case 'presales-bom':
        return <PresalesModule opportunities={opportunities} setOpportunities={setOpportunities} units={units} users={systemUsers} proposals={proposals} setProposals={setProposals} setTasks={setTasks} />;
      case 'crm-cost':
      case 'presales-cost': // geriye dönük uyumluluk (eski Presales konumu)
      case 'cost-analysis': // geriye dönük uyumluluk
        return <CostAnalysisModule opportunities={opportunities} setOpportunities={setOpportunities} setActiveTab={setActiveTab} tenantId={tenantId} />;

      case 'sales-support': return <SalesSupport opportunities={opportunities} />;

      // Sözleşme — yeni ContractWorkflow ana modül
      case 'contract-workflow':
      case 'contract-workflow-test': // geriye dönük uyumluluk (legacy alias)
        return <ContractWorkflowModule opportunities={opportunities} proposals={proposals} />;

      // Eski sözleşme modülü — erişim kapanmadı, sadece menüden çıkarıldı
      case 'contracts': return <ContractModule contracts={contracts} setContracts={setContracts} opportunities={opportunities} projects={projects} setProjects={setProjects} tasks={tasks} setTasks={setTasks} />;

      case 'procurement': return <ProcurementModule projects={projects} units={units} />;
      case 'project-mgmt': return <ProjectManagementModule users={systemUsers} units={units} customers={customers.map(c => ({ id: c.id, name: c.name }))} setActiveTab={setActiveTab} />;
      case 'visit-plan': return <VisitPlanModule customers={customers.map(c => ({ id: c.id, name: c.name }))} opportunities={opportunities.map(o => ({ id: o.id, title: o.title }))} projects={projects.map(p => ({ id: p.id, name: p.name }))} />;
      case 'todo': return <TodoModule tasks={tasks} setTasks={setTasks} projects={projects} opportunities={opportunities} contracts={contracts} units={units} proposals={proposals} setProposals={setProposals} />;
      case 'documents': return <DocumentsModule documents={documents} setDocuments={setDocuments} />;
      case 'archive': return <ArchiveModule />;
      case 'corporate-governance': return <CorporateGovernanceModule />;
      case 'finance': return <FinanceModule />;
      case 'management-reports': return <ManagementReportingModule />;
      case 'security-test': return <SecurityTestModule onDone={() => setActiveTab('dashboard')} />;
      case 'virtual-agents-test': return <VirtualAgentsTestModule />;
      case 'activity-log': return <ActivityLogModule />;

      // Abonelik ve Lisans artık settings altında — doğrudan URL'ler için geriye dönük uyumluluk
      case 'subscription': return <SubscriptionModule />;
      case 'license-gen': return <LicenseGeneratorModule />;

      default: return <Dashboard opportunities={opportunities} projects={projects} tasks={tasks} contracts={contracts} units={units} proposals={proposals} onApproveProposal={handleApproveProposal} onNavigate={setActiveTab} />;
    }
  };

  return (
    <UnsavedChangesProvider>
      <AIGateProvider onNavigateToIntegrations={() => setActiveTab('settings-integrations')}>
      <div className="flex h-screen bg-background overflow-hidden font-geist relative">
        <Sidebar
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onLogout={onLogout} 
          companyLogo={companyLogo} 
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="flex-1 flex flex-col min-w-0 relative h-screen overflow-hidden">
          <Header 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            onLogout={onLogout} 
            onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            isSidebarOpen={isSidebarOpen}
          />
          <div className="flex-1 overflow-y-auto relative custom-scrollbar pb-[env(safe-area-inset-bottom)]">
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
      </AIGateProvider>
    </UnsavedChangesProvider>
  );
};

const App = () => {
  const [activeTenantId, setActiveTenantId] = useState<string | null>(() => localStorage.getItem('enflow_active_tenant_id'));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!localStorage.getItem('enflow_auth_token'));
  const [companyLogo, setCompanyLogoState] = useState<string | null>(null);

  useEffect(() => {
    if (activeTenantId) {
      const savedLogo = localStorage.getItem(`enflow_company_logo_${activeTenantId}`);
      setCompanyLogoState(savedLogo);
    }
  }, [activeTenantId]);

  const handleLogin = (tenantId: string, token: string) => {
    localStorage.setItem('enflow_active_tenant_id', tenantId);
    localStorage.setItem('enflow_auth_token', token);
    setActiveTenantId(tenantId);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('enflow_active_tenant_id');
    localStorage.removeItem('enflow_auth_token');
    setActiveTenantId(null);
    setIsAuthenticated(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <HealthBanner />
        <Toaster position="top-right" richColors />
        {!isAuthenticated || !activeTenantId ? (
          <Login onLogin={handleLogin} />
        ) : (
          <AuthProvider tenantId={activeTenantId}>
            <TenantAppInner 
              tenantId={activeTenantId} 
              setTenantId={setActiveTenantId}
              onLogout={handleLogout} 
              companyLogo={companyLogo} 
            />
          </AuthProvider>
        )}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
