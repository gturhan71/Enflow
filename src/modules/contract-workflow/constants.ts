import type { FC } from 'react';
import {
  Layers, Cpu, CheckSquare, PenTool, ArrowRightCircle,
  TrendingUp, Banknote, Shield, Building2, BookOpen, FileCheck, Tag,
} from 'lucide-react';

export const TABS = [
  { id: 'context', label: 'Bağlam', icon: Layers },
  { id: 'analysis', label: 'Analiz', icon: Cpu },
  { id: 'documents', label: 'Evrak Takibi', icon: CheckSquare },
  { id: 'signing', label: 'İmzalama', icon: PenTool },
  { id: 'transfer', label: 'Proje Aktarımı', icon: ArrowRightCircle },
] as const;

export type TabId = typeof TABS[number]['id'];

export const DOC_TYPE_LABELS: Record<string, { label: string; icon: FC<{ className?: string }> }> = {
  TAX:       { label: 'Vergi', icon: TrendingUp },
  BANK:      { label: 'Banka', icon: Banknote },
  LEGAL:     { label: 'Hukuki', icon: Shield },
  FIRM_CERT: { label: 'Firma Belgesi', icon: Building2 },
  SPEC:      { label: 'Şartname', icon: BookOpen },
  ADMIN:     { label: 'İdari', icon: FileCheck },
  OTHER:     { label: 'Diğer', icon: Tag },
};

export const DOC_STATUS_STYLES: Record<string, string> = {
  PENDING:     'bg-amber-500/20 text-amber-300 border-amber-500/30',
  IN_PROGRESS: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  UPLOADED:    'bg-purple-500/20 text-purple-300 border-purple-500/30',
  VERIFIED:    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  WAIVED:      'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

export const DOC_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor', IN_PROGRESS: 'Hazırlanıyor', UPLOADED: 'Yüklendi', VERIFIED: 'Onaylandı', WAIVED: 'Muaf',
};

export const WORKFLOW_STATUS_STEPS = [
  { key: 'DRAFT',                      label: 'Taslak' },
  { key: 'ANALYSIS_DONE',              label: 'Analiz Tamam' },
  { key: 'PREPARATION',                label: 'Hazırlık' },
  { key: 'READY_TO_SIGN',              label: 'İmzaya Hazır' },
  { key: 'PENDING_SIGNATURE_APPROVAL', label: 'Onay Bekliyor' },
  { key: 'SIGNED',                     label: 'İmzalandı' },
  { key: 'TRANSFERRED',                label: 'Aktarıldı' },
];

// B-01 — durum makinesi terminal çıkışları (adım çubuğunda gösterilmez, ayrı banner ile gösterilir)
export const TERMINAL_STATUS_LABELS: Record<string, string> = { CANCELLED: 'İptal Edildi', TERMINATED: 'Feshedildi' };
// B-14 — bu geçişleri yalnız bu roller yapabilir (backend TRANSITION_ROLES ile birebir)
export const CANCEL_TERMINATE_ROLES = ['GENERAL_MANAGER', 'KSU_MGR', 'LEGAL_MGR'];

// ── Hukuk Görünümü (Faz 6b) ─────────────────────────────────────────────────────
export const LEGAL_TYPE_LABELS: Record<string, string> = {
  CONTRACT_REVIEW: 'Sözleşme İncelemesi', LEGAL_OPINION: 'Hukuki Görüş',
  DISPUTE: 'Uyuşmazlık', LITIGATION: 'Dava', OTHER: 'Diğer',
};
export const LEGAL_STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-700 border-amber-200',
  IN_REVIEW: 'bg-blue-100 text-blue-700 border-blue-200',
  RESPONDED: 'bg-purple-100 text-purple-700 border-purple-200',
  ESCALATED: 'bg-red-100 text-red-700 border-red-200',
  CLOSED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};
export const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'text-slate-500', MEDIUM: 'text-amber-600', HIGH: 'text-red-600',
};
