import React, { useState } from 'react';
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

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [opportunities, setOpportunities] = useState<Opportunity[]>(MOCK_OPPORTUNITIES);
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS as Project[]);
  const [contracts, setContracts] = useState<Contract[]>(MOCK_CONTRACTS);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'crm': return <CRMModule opportunities={opportunities} setOpportunities={setOpportunities} />;
      case 'presales': return <SmartImporter />;
      case 'sales-support': return <SalesSupport />;
      case 'procurement': return <ProcurementModule projects={projects} setProjects={setProjects} />;
      case 'documents': return <DocumentsModule />;
      case 'cost-analysis': return <CostAnalysisModule opportunities={opportunities} />;
      case 'contracts': return <ContractModule opportunities={opportunities} contracts={contracts} setContracts={setContracts} projects={projects} setProjects={setProjects} />;
      case 'project-mgmt': return <ProjectManagementModule projects={projects} />;
      case 'todo': return <TodoModule />;
      case 'settings': return <SettingsModule />;
      default: return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <Settings size={48} className="mb-4 opacity-20" />
          <p className="text-lg font-medium">Bu modül yakında eklenecek.</p>
          <p className="text-sm">Şu an Dashboard, CRM, Presales, Satış Destek, Satın Alma, Evrak, Maliyet Analizi, Sözleşme, Proje Yönetimi ve Ayarlar modülleri aktiftir.</p>
        </div>
      );
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 flex flex-col min-w-0">
        <Header title={NAV_ITEMS.find(i => i.id === activeTab)?.label || 'Dashboard'} />
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
}
