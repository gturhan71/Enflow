import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  NAV_ITEMS, 
  MOCK_PROJECTS, 
  MOCK_CONTRACTS,
  MOCK_OPPORTUNITIES,
  MOCK_CUSTOMERS,
  MOCK_TODO_TASKS,
  MOCK_SYSTEM_USERS,
  MOCK_UNITS
} from './constants';
import { 
  Contract,
  Opportunity,
  Project,
  TodoTask
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

const TenantAppInner = ({ tenantId, onLogout }: { tenantId: string, onLogout: () => void }) => {
  const { currentUser, setCurrentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [companyLogo, setCompanyLogoState] = useState<string | null>(() => {
    return localStorage.getItem(`enflow_company_logo_${tenantId}`);
  });
  
  const [opportunities, setOpportunities] = useState<Opportunity[]>(() => {
    const saved = localStorage.getItem(`enflow_opps_${tenantId}`);
    return saved ? JSON.parse(saved) : MOCK_OPPORTUNITIES;
  });

  const [customers, setCustomers] = useState<any[]>(() => {
    const saved = localStorage.getItem(`enflow_customers_${tenantId}`);
    return saved ? JSON.parse(saved) : MOCK_CUSTOMERS;
  });
  
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem(`enflow_projects_${tenantId}`);
    return saved ? JSON.parse(saved) : MOCK_PROJECTS;
  });
  
  const [contracts, setContracts] = useState<Contract[]>(() => {
    const saved = localStorage.getItem(`enflow_contracts_${tenantId}`);
    return saved ? JSON.parse(saved) : MOCK_CONTRACTS;
  });

  const [tasks, setTasks] = useState<TodoTask[]>(() => {
    const saved = localStorage.getItem(`enflow_tasks_${tenantId}`);
    return saved ? JSON.parse(saved) : MOCK_TODO_TASKS;
  });

  const [units, setUnits] = useState<Unit[]>([]);

  const [systemUsers, setSystemUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(`enflow_system_users_${tenantId}`);
    return saved ? JSON.parse(saved) : MOCK_SYSTEM_USERS;
  });

  useEffect(() => {
    if (isAuthenticated && activeTenantId) {
       import('./services/apiService').then(({ apiService }) => {
          apiService.getUnits().then(data => setUnits(data)).catch(console.error);
       });
    }
  }, [isAuthenticated, activeTenantId]);

  useEffect(() => {
    localStorage.setItem(`enflow_units_${tenantId}`, JSON.stringify(units));
  }, [units, tenantId]);

  useEffect(() => {
    localStorage.setItem(`enflow_system_users_${tenantId}`, JSON.stringify(systemUsers));
  }, [systemUsers, tenantId]);

  useEffect(() => {
    localStorage.setItem(`enflow_current_user_${tenantId}`, JSON.stringify(currentUser));
    if (currentUser && currentUser.tenantId) {
      // Also update apiService with current auth info
      const savedToken = 'mock-jwt-token'; // In production, get this from localStorage
      import('./services/apiService').then(({ apiService }) => {
        apiService.setAuth(currentUser.tenantId, savedToken);
      });
    }
  }, [currentUser, tenantId]);


  useEffect(() => {
    localStorage.setItem(`enflow_customers_${tenantId}`, JSON.stringify(customers));
  }, [customers, tenantId]);

  useEffect(() => {
    localStorage.setItem(`enflow_projects_${tenantId}`, JSON.stringify(projects));
  }, [projects, tenantId]);

  useEffect(() => {
    localStorage.setItem(`enflow_contracts_${tenantId}`, JSON.stringify(contracts));
  }, [contracts, tenantId]);

  useEffect(() => {
    localStorage.setItem(`enflow_tasks_${tenantId}`, JSON.stringify(tasks));
  }, [tasks, tenantId]);

  const setCompanyLogo = (logo: string | null) => {
    setCompanyLogoState(logo);
    if (logo) {
      localStorage.setItem(`enflow_company_logo_${tenantId}`, logo);
    } else {
      localStorage.removeItem(`enflow_company_logo_${tenantId}`);
    }
  };

  const renderContent = () => {
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
    
    if (activeTab.startsWith('crm-') || activeTab === 'crm') {
      return <CRMModule opportunities={opportunities} setOpportunities={setOpportunities} customers={customers} setCustomers={setCustomers} activeTab={activeTab} tasks={tasks} setTasks={setTasks} />;
    }

    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'presales': return <PresalesModule opportunities={opportunities} setOpportunities={setOpportunities} units={units} users={systemUsers} />;
      case 'sales-support': return <SalesSupport />;
      case 'procurement': return <ProcurementModule projects={projects} setProjects={setProjects} tasks={tasks} setTasks={setTasks} />;
      case 'documents': return <DocumentsModule />;
      case 'archive': return <ArchiveModule />;
      case 'cost-analysis': return <CostAnalysisModule opportunities={opportunities} />;
      case 'contracts': return <ContractModule opportunities={opportunities} contracts={contracts} setContracts={setContracts} projects={projects} setProjects={setProjects} tasks={tasks} setTasks={setTasks} units={units} users={systemUsers} />;
      case 'project-mgmt': return <ProjectManagementModule projects={projects} tasks={tasks} setTasks={setTasks} />;
      case 'todo': return <TodoModule tasks={tasks} setTasks={setTasks} projects={projects} opportunities={opportunities} contracts={contracts} />;
      default: return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <Settings size={48} className="mb-4 opacity-20" />
          <p className="text-lg font-medium">Bu modül yakında eklenecek.</p>
        </div>
      );
    }
  };

  const getHeaderTitle = () => {
    for (const item of NAV_ITEMS) {
      if (item.id === activeTab) return item.label;
      if (item.subItems) {
        const sub = item.subItems.find(s => s.id === activeTab);
        if (sub) return `${item.label} / ${sub.label}`;
      }
    }
    return 'Dashboard';
  };

  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={onLogout} />
      <main className="flex-1 flex flex-col min-w-0">
        <Header title={getHeaderTitle()} onLogout={onLogout} />
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

const TenantApp = (props: any) => (
  <AuthProvider tenantId={props.tenantId}>
    <UnsavedChangesProvider>
      <TenantAppInner {...props} />
    </UnsavedChangesProvider>
  </AuthProvider>
);

import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);

  if (!isAuthenticated || !activeTenantId) {
    return <Login onLogin={(tId) => { setIsAuthenticated(true); setActiveTenantId(tId); }} />;
  }

  return (
    <ErrorBoundary>
      <TenantApp key={activeTenantId} tenantId={activeTenantId} onLogout={() => { setIsAuthenticated(false); setActiveTenantId(null); }} />
    </ErrorBoundary>
  );
}
