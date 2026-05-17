import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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

const TenantAppInner = ({ tenantId, onLogout }: { tenantId: string, onLogout: () => void }) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  
  // States derived from API
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [companyLogo, setCompanyLogoState] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [oppsData, custData, projData, contrData, tasksData, unitsData, usersData] = await Promise.all([
        apiService.getOpportunities(),
        apiService.getCustomers(),
        apiService.getProjects(),
        apiService.getContracts(),
        apiService.getTasks(),
        apiService.getUnits(),
        apiService.getUsers()
      ]);

      setOpportunities(oppsData);
      setCustomers(custData);
      setProjects(projData);
      setContracts(contrData);
      setTasks(tasksData);
      setUnits(unitsData);
      setSystemUsers(usersData);
      
      // Logo still in localStorage for now as it's a tenant setting
      const savedLogo = localStorage.getItem(`enflow_company_logo_${tenantId}`);
      setCompanyLogoState(savedLogo);
    } catch (error) {
      console.error('Data fetching error:', error);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

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
            <div className="relative">
              <div className="w-20 h-20 border-4 border-primary/10 rounded-full" />
              <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0 shadow-lg shadow-primary/20" />
            </div>
            <div className="text-center">
              <p className="text-slate-900 font-black uppercase tracking-[0.2em] text-[10px] italic">Sistem Verileri Yükleniyor</p>
              <div className="flex items-center justify-center gap-1 mt-2">
                {[0, 1, 2].map(i => (
                  <motion.div 
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                    className="w-1.5 h-1.5 bg-primary rounded-full" 
                  />
                ))}
              </div>
            </div>
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
      case 'dashboard': return <Dashboard opportunities={opportunities} projects={projects} tasks={tasks} />;
      case 'crm':
      case 'crm-opportunities':
      case 'crm-customers':
      case 'crm-proposals':
        return (
          <CRMModule 
            opportunities={opportunities} 
            setOpportunities={setOpportunities} 
            customers={customers} 
            setCustomers={setCustomers} 
            activeTab={activeTab} 
            tasks={tasks} 
            setTasks={setTasks} 
          />
        );
      case 'presales': return <PresalesModule opportunities={opportunities} setOpportunities={setOpportunities} units={units} users={systemUsers} />;
      case 'sales-support': return <SalesSupport opportunities={opportunities} />;
      case 'spec-analysis': return <CostAnalysisModule opportunities={opportunities} />;
      case 'documents': return <DocumentsModule />;
      case 'contract': return <ContractModule contracts={contracts} setContracts={setContracts} opportunities={opportunities} projects={projects} setProjects={setProjects} />;
      case 'archive': return <ArchiveModule />;
      case 'procurement': return <ProcurementModule projects={projects} setProjects={setProjects} tasks={tasks} setTasks={setTasks} />;
      case 'project-mgmt': return <ProjectManagementModule projects={projects} tasks={tasks} setTasks={setTasks} />;
      case 'todo': return <TodoModule tasks={tasks} setTasks={setTasks} projects={projects} opportunities={opportunities} contracts={contracts} />;
      default: return <Dashboard opportunities={opportunities} projects={projects} tasks={tasks} />;
    }
  };

  return (
    <UnsavedChangesProvider>
      <div className="flex h-screen bg-slate-50 overflow-hidden font-geist">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={onLogout} />
        <main className="flex-1 flex flex-col min-w-0 relative">
          <Header activeTab={activeTab} companyLogo={companyLogo} />
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
    return <Login onLogin={handleLogin} />;
  }

  return (
    <AuthProvider tenantId={activeTenantId}>
      <TenantAppInner tenantId={activeTenantId} onLogout={handleLogout} />
    </AuthProvider>
  );
};

export default App;
