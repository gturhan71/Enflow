import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileSearch, 
  FileText, 
  ShoppingCart, 
  Archive, 
  Settings,
  Bell,
  Search,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ChevronRight,
  Menu,
  X,
  LogOut,
  TrendingUp,
  DollarSign,
  Briefcase,
  Truck,
  Package,
  History,
  FileDown,
  Calendar,
  ShieldCheck,
  MapPin,
  UserCheck,
  ExternalLink,
  Download,
  Filter,
  MoreVertical,
  BarChart3,
  PieChart,
  ArrowDownRight,
  Target,
  Percent,
  FileSignature,
  Gavel,
  Kanban,
  Wand2,
  Puzzle,
  Cpu,
  Mail,
  MessageSquare,
  ListTodo,
  UserPlus,
  FileCheck2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import { 
  NAV_ITEMS, 
  MOCK_CUSTOMERS,
  MOCK_PROJECTS, 
  MOCK_DOCUMENTS, 
  MOCK_WORK_EXPERIENCE, 
  MOCK_CERTIFICATES,
  MOCK_UNITS,
  MOCK_PERMISSIONS,
  MOCK_SYSTEM_USERS,
  MOCK_BOM_ITEMS,
  MOCK_COST_REQUIREMENTS,
  MOCK_CONTRACTS,
  MOCK_CONTRACT_DOCS,
  MOCK_PROJECT_TASKS,
  MOCK_TODO_TASKS,
  MOCK_OPPORTUNITIES
} from '../constants';
import { 
  CorporateDocument, 
  Unit, 
  User, 
  Permission, 
  BoMItem, 
  CostRequirement,
  Contract,
  ContractDocumentRequirement,
  ProjectTask,
  TodoTask,
  Opportunity,
  Project,
  NextcloudConfig,
  ExchangeConfig,
  WhatsAppConfig
} from '../types';
import { nextcloudService } from '../services/nextcloudService';
import { exchangeService } from '../services/exchangeService';
import { whatsappService } from '../services/whatsappService';


import { useAuth } from '../contexts/AuthContext';


const Sidebar = ({ activeTab, setActiveTab, onLogout }: { activeTab: string, setActiveTab: (id: string) => void, onLogout: () => void }) => {
  const { handleNavigate } = useUnsavedChanges();
  const { currentUser, hasPermission } = useAuth();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  const toggleMenu = (id: string) => {
    setExpandedMenus(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  // Filter NAV_ITEMS based on currentUser permissions
  const visibleNavItems = NAV_ITEMS.filter(item => {
    // If no specific permission required, show it (or default to a view permission)
    const hasBasePermission = hasPermission(item.requiredPermission);
    
    if (item.subItems) {
      // If it has subitems, at least one subitem must be visible OR the parent itself must be allowed
      const visibleSubItems = item.subItems.filter(sub => hasPermission(sub.requiredPermission));
      return hasBasePermission || visibleSubItems.length > 0;
    }
    
    return hasBasePermission;
  });

  return (
    <div className="w-64 glass-sidebar h-screen flex flex-col sticky top-0 z-20">
      <div className="p-6 flex items-center gap-3 border-b border-white/20">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
          <Briefcase size={22} />
        </div>
        <div>
          <h1 className="font-bold text-slate-900 leading-tight uppercase tracking-tighter text-xl">ENFLOW</h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Sistem Entegratörü</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const isExpanded = expandedMenus.includes(item.id);
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isActive = activeTab === item.id || (hasSubItems && item.subItems?.some(sub => sub.id === activeTab));

          // Filter subItems as well
          const visibleSubItems = item.subItems?.filter(sub => 
            currentUser.permissions.includes(sub.requiredPermission) || currentUser.role === 'GENERAL_MANAGER'
          );

          return (
            <div key={item.id}>
              <button
                onClick={() => {
                  if (hasSubItems) {
                    toggleMenu(item.id);
                  } else {
                    handleNavigate(() => setActiveTab(item.id));
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group",
                  isActive && !hasSubItems
                    ? "bg-primary/10 text-primary shadow-sm shadow-primary/5" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon size={20} className={cn(
                  "transition-colors",
                  isActive ? "text-primary" : "text-slate-400 group-hover:text-slate-600"
                )} />
                <span className="flex-1 text-left">{item.label}</span>
                {hasSubItems && (
                  <ChevronRight size={16} className={cn(
                    "transition-transform duration-200",
                    isExpanded ? "rotate-90" : ""
                  )} />
                )}
                {isActive && !hasSubItems && (
                  <motion.div 
                    layoutId="active-pill"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
                  />
                )}
              </button>
              
              {hasSubItems && (
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pl-11 pr-4 py-2 space-y-1">
                        {visibleSubItems?.map((subItem) => (
                          <button
                            key={subItem.id}
                            onClick={() => handleNavigate(() => setActiveTab(subItem.id))}
                            className={cn(
                              "w-full text-left px-4 py-2 rounded-lg text-xs font-medium transition-colors",
                              activeTab === subItem.id
                                ? "bg-primary/5 text-primary"
                                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            )}
                          >
                            {subItem.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/20">
        <div className="bg-white/40 backdrop-blur-md rounded-2xl p-4 flex items-center gap-3 border border-white/40">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shadow-inner">
            {currentUser?.name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{currentUser?.name || 'Kullanıcı'}</p>
            <p className="text-[10px] text-slate-500 truncate uppercase tracking-wider font-bold">{currentUser?.role?.replace('_', ' ') || 'GÖREV TANIMSIZ'}</p>
          </div>
          <button onClick={() => handleNavigate(onLogout)} className="text-slate-400 hover:text-primary transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
