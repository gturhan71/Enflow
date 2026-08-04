import type { ReactNode } from 'react';
import {
  Clock, Activity, CheckCircle2, AlertTriangle, Ban, Target, Package, Truck, Wrench,
  Code2, CheckSquare, ShieldCheck, Receipt, Banknote, Flag,
} from 'lucide-react';
import { ProjectType, ProjectStatus, MilestoneStatus, CostCategory } from '../../types';

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  HARDWARE: 'Donanım', SOFTWARE: 'Yazılım', SERVICE: 'Hizmet', MIXED: 'Karma',
};
export const PROJECT_TYPE_COLOR: Record<ProjectType, string> = {
  HARDWARE: 'bg-blue-100 text-blue-700',
  SOFTWARE: 'bg-purple-100 text-purple-700',
  SERVICE: 'bg-emerald-100 text-emerald-700',
  MIXED: 'bg-amber-100 text-amber-700',
};
export const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
  PLANNING:    { label: 'Planlama',     color: 'text-slate-600',  bg: 'bg-slate-100'  },
  IN_PROGRESS: { label: 'Devam Ediyor', color: 'text-blue-700',   bg: 'bg-blue-100'   },
  ON_HOLD:     { label: 'Beklemede',    color: 'text-amber-700',  bg: 'bg-amber-100'  },
  COMPLETED:   { label: 'Tamamlandı',   color: 'text-green-700',  bg: 'bg-green-100'  },
  CANCELLED:   { label: 'İptal',        color: 'text-red-700',    bg: 'bg-red-100'    },
};
export const MS_STATUS_CONFIG: Record<MilestoneStatus, { label: string; color: string; icon: ReactNode }> = {
  NOT_STARTED: { label: 'Başlamadı',   color: 'text-slate-400',  icon: <Clock size={14} /> },
  IN_PROGRESS: { label: 'Devam Ediyor',color: 'text-blue-500',   icon: <Activity size={14} /> },
  COMPLETED:   { label: 'Tamamlandı',  color: 'text-green-500',  icon: <CheckCircle2 size={14} /> },
  BLOCKED:     { label: 'Engellendi',  color: 'text-red-500',    icon: <AlertTriangle size={14} /> },
  CANCELLED:   { label: 'İptal',       color: 'text-slate-400',  icon: <Ban size={14} /> },
};
export const MS_TYPE_ICON: Record<string, ReactNode> = {
  PLANNING:     <Target size={14} />,
  PROCUREMENT:  <Package size={14} />,
  SHIPMENT:     <Truck size={14} />,
  INSTALLATION: <Wrench size={14} />,
  DEVELOPMENT:  <Code2 size={14} />,
  TESTING:      <CheckSquare size={14} />,
  ACCEPTANCE:   <ShieldCheck size={14} />,
  WARRANTY:     <ShieldCheck size={14} />,
  INVOICING:    <Receipt size={14} />,
  COLLECTION:   <Banknote size={14} />,
  CUSTOM:       <Flag size={14} />,
};
export const COST_CAT_LABEL: Record<CostCategory, string> = {
  PROCUREMENT: 'Satınalma', TRAVEL: 'Seyahat/Lojistik',
  EXTERNAL_SERVICE: 'Harici Hizmet', OTHER: 'Diğer',
};
export const COST_CAT_COLOR: Record<CostCategory, string> = {
  PROCUREMENT: 'bg-blue-100 text-blue-700',
  TRAVEL: 'bg-amber-100 text-amber-700',
  EXTERNAL_SERVICE: 'bg-purple-100 text-purple-700',
  OTHER: 'bg-slate-100 text-slate-600',
};

// ── Proje Devir Paketi (Faz 2) — ContractWorkflowDoc pattern'inin klonu ───────
// Tip burada lokal tanımlı (types.ts'e taşınmaz) — ContractWorkflowDoc/
// ContractWorkflow'un ContractWorkflowModule.tsx'te lokal tanımlanma konvansiyonuna uyar.
export interface ProjectHandoverDoc {
  id: string;
  projectId: string;
  name: string;
  docType: string;
  description?: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'UPLOADED' | 'VERIFIED' | 'WAIVED';
  fileUrl?: string | null;
  isRequired: boolean;
  sortOrder: number;
  notes?: string | null;
}

export const HANDOVER_STATUS_BADGE: Record<ProjectHandoverDoc['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  UPLOADED: 'bg-emerald-100 text-emerald-700',
  VERIFIED: 'bg-emerald-600 text-white',
  WAIVED: 'bg-slate-200 text-slate-500',
};

export const HANDOVER_STATUS_LABEL: Record<ProjectHandoverDoc['status'], string> = {
  PENDING: 'Bekliyor',
  IN_PROGRESS: 'Devam Ediyor',
  UPLOADED: 'Yüklendi',
  VERIFIED: 'Onaylandı',
  WAIVED: 'Muaf',
};
