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
  FileCheck2,
  Save
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


const Header = ({ title, onLogout }: { title: string, onLogout: () => void }) => {
  const { hasUnsavedChanges, setHasUnsavedChanges, handleNavigate } = useUnsavedChanges();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setHasUnsavedChanges(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <header className="h-20 glass-header px-8 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <div className="h-6 w-px bg-slate-200 mx-2" />
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Clock size={16} />
          <span>8 Nisan 2026, 13:56</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={!hasUnsavedChanges && !saved}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
            saved
              ? 'bg-emerald-100 text-emerald-700'
              : hasUnsavedChanges
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {saved ? <CheckCircle2 size={18} /> : <Save size={18} />}
          {saved ? 'Kaydedildi' : 'Kaydet'}
        </button>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        <button 
          onClick={() => handleNavigate(onLogout)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-red-600 hover:bg-red-50 transition-all"
        >
          <LogOut size={18} />
          Çıkış Yap
        </button>
      </div>
    </header>
  );
};

// --- Modules ---

export default Header;
