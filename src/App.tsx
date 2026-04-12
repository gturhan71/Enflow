import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  NAV_ITEMS, 
  MOCK_PROJECTS, 
  MOCK_CONTRACTS,
  MOCK_OPPORTUNITIES
} from './constants';
import { 
  Contract,
  Opportunity,
  Project
} from './types';

import Sidebar from './layout/Sidebar';
import Header from './layout/Header';
import Dashboard from './modules/Dashboard';
import SmartImporter from './modules/SmartImporter';
import SalesSupport from './modules/SalesSupport';
import DocumentsModule from './modules/DocumentsModule';
import ProcurementModule from './modules/ProcurementModule';
import TodoModule from './modules/TodoModule';
import SettingsModule from './modules/SettingsModule';
import ContractModule from './modules/ContractModule';
import ProjectManagementModule from './modules/ProjectManagementModule';
import CRMModule from './modules/CRMModule';
import CostAnalysisModule from './modules/CostAnalysisModule';
import Login from './modules/Login';
import { UnsavedChangesProvider } from './contexts/UnsavedChangesContext';
import { secureStorage } from './lib/storage';

const TenantApp = ({ tenantId, onLogout }: { key?: string, tenantId: string, onLogout: () => void }) => {
  const [companyLogo, setCompanyLogoState] = useState<string | null>(() => {
    return secureStorage.getItem<string>(`enflow_company_logo_${tenantId}`);
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [opportunities, setOpportunities] = useState<Opportunity[]>(() => {
    const saved = secureStorage.getItem<Opportunity[]>(`enflow_opps_${tenantId}`);
    return saved || MOCK_OPPORTUNITIES;
  });
  
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = secureStorage.getItem<Project[]>(`enflow_projects_${tenantId}`);
    return saved || MOCK_PROJECTS;
  });
  
  const [contracts, setContracts] = useState<Contract[]>(() => {
    const saved = secureStorage.getItem<Contract[]>(`enflow_contracts_${tenantId}`);
    return saved || MOCK_CONTRACTS;
  });

  useEffect(() => {
    secureStorage.setItem(`enflow_opps_${tenantId}`, opportunities);
  }, [opportunities, tenantId]);

  useEffect(() => {
    secureStorage.setItem(`enflow_projects_${tenantId}`, projects);
  }, [projects, tenantId]);

  useEffect(() => {
    secureStorage.setItem(`enflow_contracts_${tenantId}`, contracts);
  }, [contracts, tenantId]);

  const setCompanyLogo = (logo: string | null) => {
    setCompanyLogoState(logo);
    if (logo) {
      secureStorage.setItem(`enflow_company_logo_${tenantId}`, logo);
    } else {
      secureStorage.removeItem(`enflow_company_logo_${tenantId}`);
    }
  };

  const renderContent = () => {
    if (activeTab.startsWith('settings-')) {
      const subTab = activeTab.replace('settings-', '');
      return <SettingsModule companyLogo={companyLogo} setCompanyLogo={setCompanyLogo} activeSubTab={subTab} />;
    }
    
    if (activeTab.startsWith('crm-') || activeTab === 'crm') {
      return <CRMModule opportunities={opportunities} setOpportunities={setOpportunities} />;
    }

    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'presales': return <SmartImporter />;
      case 'sales-support': return <SalesSupport />;
      case 'procurement': return <ProcurementModule projects={projects} setProjects={setProjects} />;
      case 'documents': return <DocumentsModule />;
      case 'cost-analysis': return <CostAnalysisModule opportunities={opportunities} />;
      case 'contracts': return <ContractModule opportunities={opportunities} contracts={contracts} setContracts={setContracts} projects={projects} setProjects={setProjects} />;
      case 'project-mgmt': return <ProjectManagementModule projects={projects} />;
      case 'todo': return <TodoModule />;
      default: return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <Settings size={48} className="mb-4 opacity-20" />
          <p className="text-lg font-medium">Bu modül yakında eklenecek.</p>
          <p className="text-sm">Şu an Dashboard, CRM, Presales, Satış Destek, Satın Alma, Evrak, Maliyet Analizi, Sözleşme, Proje Yönetimi ve Ayarlar modülleri aktiftir.</p>
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
    <UnsavedChangesProvider>
      <div className="flex min-h-screen bg-[#f8f9fa]">
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
    </UnsavedChangesProvider>
  );
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);

  if (!isAuthenticated || !activeTenantId) {
    return <Login onLogin={(tId) => { setIsAuthenticated(true); setActiveTenantId(tId); }} />;
  }

  return <TenantApp key={activeTenantId} tenantId={activeTenantId} onLogout={() => { setIsAuthenticated(false); setActiveTenantId(null); }} />;
}
