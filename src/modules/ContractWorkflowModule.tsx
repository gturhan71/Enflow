import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Cpu, CheckSquare, PenTool, ArrowRightCircle,
  Plus, Trash2, AlertCircle, CheckCircle2,
  Upload, ChevronRight, ChevronDown, Star, Shield, Banknote,
  Building2, FileCheck, Tag, ClipboardList, Loader2, Calendar,
  TrendingUp, XCircle, BookOpen, Layers, Send, ExternalLink, ShoppingCart,
  UserCheck, UserX, Clock
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { apiService } from '../services/apiService';
import { useAIGate } from '../contexts/AIGateContext';
import { Opportunity, Proposal, LegalCase, LegalRequest } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ContractWorkflowDoc {
  id: string;
  workflowId: string;
  name: string;
  docType: string;
  description?: string;
  deadline?: string | null;
  status: string;
  fileUrl?: string | null;
  isRequired: boolean;
  isAiGenerated: boolean;
  sortOrder: number;
  notes?: string;
}

interface ContractWorkflow {
  id: string;
  title: string;
  opportunityId?: string | null;
  contractValue: number;
  tenderName?: string | null;
  tenderNo?: string | null;
  projectName?: string | null;
  contractText?: string | null;
  specText?: string | null;
  aiAnalysis?: string | null;
  status: string;
  signedDate?: string | null;
  deadline?: string | null;
  notes?: string | null;
  projectId?: string | null;
  procurementRequestId?: string | null;
  documents: ContractWorkflowDoc[];
  createdAt: string;
}

interface AiAnalysis {
  documents: { name: string; docType: string; description: string; deadline_priority: string; estimated_days: number; notes: string }[];
  tasks: { order: number; title: string; description: string; category: string; priority: string; estimated_days: number }[];
  key_clauses: { clause: string; impact: string; action_required: string }[];
  contract_summary: { project_name?: string; tender_no?: string; type: string; tax_obligations: string[]; key_deadlines: string[]; special_requirements: string[]; project_impacts: string[] };
}

interface Props {
  opportunities?: Opportunity[];
  proposals?: Proposal[];
  initialItemId?: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'context', label: 'Bağlam', icon: Layers },
  { id: 'analysis', label: 'Analiz', icon: Cpu },
  { id: 'documents', label: 'Evrak Takibi', icon: CheckSquare },
  { id: 'signing', label: 'İmzalama', icon: PenTool },
  { id: 'transfer', label: 'Proje Aktarımı', icon: ArrowRightCircle },
] as const;

type TabId = typeof TABS[number]['id'];

const DOC_TYPE_LABELS: Record<string, { label: string; icon: React.FC<{ className?: string }> }> = {
  TAX:       { label: 'Vergi', icon: TrendingUp },
  BANK:      { label: 'Banka', icon: Banknote },
  LEGAL:     { label: 'Hukuki', icon: Shield },
  FIRM_CERT: { label: 'Firma Belgesi', icon: Building2 },
  SPEC:      { label: 'Şartname', icon: BookOpen },
  ADMIN:     { label: 'İdari', icon: FileCheck },
  OTHER:     { label: 'Diğer', icon: Tag },
};

const DOC_STATUS_STYLES: Record<string, string> = {
  PENDING:     'bg-amber-500/20 text-amber-300 border-amber-500/30',
  IN_PROGRESS: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  UPLOADED:    'bg-purple-500/20 text-purple-300 border-purple-500/30',
  VERIFIED:    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  WAIVED:      'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const DOC_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor', IN_PROGRESS: 'Hazırlanıyor', UPLOADED: 'Yüklendi', VERIFIED: 'Onaylandı', WAIVED: 'Muaf',
};

const WORKFLOW_STATUS_STEPS = [
  { key: 'DRAFT',                      label: 'Taslak' },
  { key: 'ANALYSIS_DONE',              label: 'Analiz Tamam' },
  { key: 'PREPARATION',                label: 'Hazırlık' },
  { key: 'READY_TO_SIGN',              label: 'İmzaya Hazır' },
  { key: 'PENDING_SIGNATURE_APPROVAL', label: 'Onay Bekliyor' },
  { key: 'SIGNED',                     label: 'İmzalandı' },
  { key: 'TRANSFERRED',                label: 'Aktarıldı' },
];

// ── API helpers ────────────────────────────────────────────────────────────────

const BASE = '/contract-workflows';

async function apiFetch(path: string, init?: RequestInit) {
  return apiClient.fetchWithAuth(path, init);
}

// ── Component ──────────────────────────────────────────────────────────────────

const STATUS_RANK: Record<string, number> = { APPROVED: 4, ACCEPTED: 3, SENT: 2, PENDING_APPROVAL: 1, DRAFT: 0, REJECTED: -1 };

function bestProposalPrice(opportunityId: string, proposals: Proposal[]): number | null {
  let best: { rank: number; version: number; price: number } | null = null;
  for (const p of proposals) {
    if (p.opportunityId !== opportunityId || !p.totalPrice) continue;
    const rank = STATUS_RANK[p.status] ?? 0;
    const version = p.version ?? 0;
    if (!best || rank > best.rank || (rank === best.rank && version > best.version)) {
      best = { rank, version, price: p.totalPrice };
    }
  }
  return best?.price ?? null;
}

export function ContractWorkflowModule({ opportunities = [], proposals = [], initialItemId }: Props) {
  const [mode, setMode] = useState<'contracts' | 'legal'>('contracts');
  const [tab, setTab] = useState<TabId>('context');
  const [workflows, setWorkflows] = useState<ContractWorkflow[]>([]);
  const [selected, setSelected] = useState<ContractWorkflow | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferProject, setTransferProject] = useState<{ code?: string; name?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [form, setForm] = useState({ title: '', opportunityId: '', contractValue: '', deadline: '', notes: '', tenderName: '', tenderNo: '' });
  const [contractText, setContractText] = useState('');
  const [specText, setSpecText] = useState('');
  const [signedDate, setSignedDate] = useState('');
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const { requireAI } = useAIGate();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const notify = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(null), 5000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); }
  };

  const loadWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(BASE);
      setWorkflows(data);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWorkflows(); }, [loadWorkflows]);
  useEffect(() => {
    apiService.getAIStatus().then(s => setAiConfigured(s.configured)).catch(() => setAiConfigured(false));
  }, []);

  const selectWorkflow = (wf: ContractWorkflow) => {
    setSelected(wf);
    setContractText(wf.contractText || '');
    setSpecText(wf.specText || '');
    setSignedDate(wf.signedDate ? wf.signedDate.slice(0, 10) : '');
    if (wf.aiAnalysis) {
      try { setAnalysis(JSON.parse(wf.aiAnalysis)); } catch { /* ignore */ }
    } else {
      setAnalysis(null);
    }
  };

  // Deep-link: bildirim/görev "Git" ile gelen sözleşme akışını otomatik aç.
  useEffect(() => {
    if (!initialItemId) return;
    const wf = workflows.find(w => w.id === initialItemId);
    if (wf && selected?.id !== wf.id) { setMode('contracts'); selectWorkflow(wf); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialItemId, workflows]);

  // ── Context Tab ──────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.title.trim() && !form.tenderName.trim()) { notify('İhale adı veya başlık zorunlu.', true); return; }
    setLoading(true);
    try {
      // Auto-compose title: "İhale Adı — İKN: XXXXX" veya sadece başlık
      const autoTitle = [
        form.tenderName.trim() || form.title.trim(),
        form.tenderNo.trim() ? `İKN: ${form.tenderNo.trim()}` : null,
      ].filter(Boolean).join(' — ');

      const wf = await apiFetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: autoTitle || form.title,
          opportunityId: form.opportunityId || null,
          contractValue: parseFloat(form.contractValue) || 0,
          deadline: form.deadline || null,
          notes: form.notes || null,
          tenderName: form.tenderName || null,
          tenderNo: form.tenderNo || null,
        }),
      });
      setWorkflows(prev => [wf, ...prev]);
      selectWorkflow(wf);
      notify('Sözleşme süreci oluşturuldu.');
      setForm({ title: '', opportunityId: '', contractValue: '', deadline: '', notes: '', tenderName: '', tenderNo: '' });
      setTab('analysis');
    } catch (e) { notify((e as Error).message, true); }
    finally { setLoading(false); }
  };

  // ── Analysis Tab ─────────────────────────────────────────────────────────────

  const handleSaveTexts = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const wf = await apiFetch(`${BASE}/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractText, specText }),
      });
      setSelected(wf);
      setWorkflows(prev => prev.map(w => w.id === wf.id ? wf : w));
      notify('Metinler kaydedildi.');
    } catch (e) { notify((e as Error).message, true); }
    finally { setLoading(false); }
  };

  const handleAnalyse = async () => {
    if (!selected) return;
    // YZ kapısı — entegre YZ yoksa popup açılır + Entegrasyonlar'a yönlendirir.
    if (!(await requireAI('Sözleşme analizi'))) return;
    setAnalysing(true);
    try {
      await apiFetch(`${BASE}/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractText, specText }),
      });
      const result = await apiFetch(`${BASE}/${selected.id}/analyze`, { method: 'POST' });
      setAnalysis(result.analysis);
      selectWorkflow(result.workflow);
      setWorkflows(prev => prev.map(w => w.id === result.workflow.id ? result.workflow : w));
      notify('AI analizi tamamlandı. Evrak listesi oluşturuldu.');
      setTab('documents');
    } catch (e) { notify((e as Error).message, true); }
    finally { setAnalysing(false); }
  };

  // ── Documents Tab ─────────────────────────────────────────────────────────────

  const handleDocStatus = async (docId: string, status: string) => {
    if (!selected) return;
    try {
      const doc = await apiFetch(`${BASE}/${selected.id}/documents/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setSelected(prev => prev ? { ...prev, documents: prev.documents.map(d => d.id === doc.id ? doc : d) } : prev);
    } catch (e) { notify((e as Error).message, true); }
  };

  const handleAddDoc = async () => {
    if (!selected) return;
    try {
      const doc = await apiFetch(`${BASE}/${selected.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Yeni Belge', docType: 'OTHER', isRequired: true }),
      });
      setSelected(prev => prev ? { ...prev, documents: [...prev.documents, doc] } : prev);
    } catch (e) { notify((e as Error).message, true); }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!selected) return;
    try {
      await apiFetch(`${BASE}/${selected.id}/documents/${docId}`, { method: 'DELETE' });
      setSelected(prev => prev ? { ...prev, documents: prev.documents.filter(d => d.id !== docId) } : prev);
    } catch (e) { notify((e as Error).message, true); }
  };

  const handleFileUpload = async (docId: string, file: File) => {
    if (!selected) return;
    setUploadingDocId(docId);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const effectiveTenantId = localStorage.getItem('enflow_active_tenant_id') || '';
      const effectiveToken = localStorage.getItem('enflow_auth_token') || 'mock-token';

      const res = await fetch(`/api/contract-workflows/${selected.id}/documents/${docId}/upload`, {
        method: 'POST',
        headers: {
          'x-tenant-id': effectiveTenantId,
          'Authorization': `Bearer ${effectiveToken}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
      }

      const result = await res.json();
      const updatedDocs = selected.documents.map(d => d.id === result.doc.id ? result.doc : d);
      setSelected(prev => prev ? { ...prev, documents: updatedDocs } : prev);

      const location = result.nextcloudUrl
        ? 'Nextcloud\'a yüklendi'
        : `Lokale kaydedildi (${result.folder})`;
      notify(`${file.name} — ${location}`);

      // Auto-mark ready to sign when all required docs are uploaded
      const allDone = updatedDocs
        .filter(d => d.isRequired)
        .every(d => ['UPLOADED', 'VERIFIED', 'WAIVED'].includes(d.status));
      if (allDone && !['READY_TO_SIGN', 'SIGNED', 'TRANSFERRED'].includes(selected.status)) {
        try {
          const wf = await apiFetch(`${BASE}/${selected.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'READY_TO_SIGN' }),
          });
          setSelected(wf);
          setWorkflows(prev => prev.map(w => w.id === wf.id ? wf : w));
          notify('Tüm belgeler yüklendi — otomatik olarak İmzaya Hazır\'a alındı.');
          setTab('signing');
        } catch { /* ignore auto-mark failure */ }
      }
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setUploadingDocId(null);
    }
  };

  const handleDocFieldUpdate = async (docId: string, field: string, value: string) => {
    if (!selected) return;
    try {
      const doc = await apiFetch(`${BASE}/${selected.id}/documents/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      setSelected(prev => prev ? { ...prev, documents: prev.documents.map(d => d.id === doc.id ? doc : d) } : prev);
    } catch (e) { notify((e as Error).message, true); }
  };

  // ── Signing Tab ───────────────────────────────────────────────────────────────

  const handleMarkReadyToSign = async () => {
    if (!selected) return;
    const allDone = selected.documents.filter(d => d.isRequired).every(d => ['VERIFIED', 'UPLOADED', 'WAIVED'].includes(d.status));
    if (!allDone) { notify('Zorunlu tüm belgeler tamamlanmadan imzaya hazır işaretlenemez.', true); return; }
    try {
      const wf = await apiFetch(`${BASE}/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'READY_TO_SIGN' }),
      });
      selectWorkflow(wf);
      setWorkflows(prev => prev.map(w => w.id === wf.id ? wf : w));
      notify('İmzaya hazır olarak işaretlendi.');
    } catch (e) { notify((e as Error).message, true); }
  };

  const handleSendForApproval = async () => {
    if (!selected || !signedDate) { notify('Devam etmeden önce imza tarihini giriniz.', true); return; }
    setLoading(true);
    try {
      const wf = await apiFetch(`${BASE}/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PENDING_SIGNATURE_APPROVAL', signedDate }),
      });
      selectWorkflow(wf);
      setWorkflows(prev => prev.map(w => w.id === wf.id ? wf : w));
      notify('Sözleşme imza onayı için birim yöneticisine gönderildi.');
    } catch (e) { notify((e as Error).message, true); }
    finally { setLoading(false); }
  };

  const handleApproveSignature = async () => {
    if (!selected) return;
    setTransferring(true);
    try {
      await apiFetch(`${BASE}/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SIGNED' }),
      });
      const result = await apiFetch(`${BASE}/${selected.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId: null, assignedById: null }),
      });
      const finalWf = await apiFetch(`${BASE}/${selected.id}`);
      selectWorkflow(finalWf);
      setWorkflows(prev => prev.map(w => w.id === finalWf.id ? finalWf : w));
      if (result.project) setTransferProject({ code: result.project.code, name: result.project.name });
      notify(`Sözleşme onaylandı — ${result.project?.code ? `Proje ${result.project.code} oluşturuldu, ` : ''}${result.tasksCreated} görev Proje Yönetimine aktarıldı.`);
      setTab('transfer');
    } catch (e) { notify((e as Error).message, true); }
    finally { setTransferring(false); }
  };

  const handleRejectSignature = async () => {
    if (!selected) return;
    try {
      const wf = await apiFetch(`${BASE}/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'READY_TO_SIGN' }),
      });
      selectWorkflow(wf);
      setWorkflows(prev => prev.map(w => w.id === wf.id ? wf : w));
      notify('Onay reddedildi — sözleşme İmzaya Hazır durumuna geri döndü.', true);
    } catch (e) { notify((e as Error).message, true); }
  };

  // ── Transfer Tab ──────────────────────────────────────────────────────────────

  const handleTransfer = async () => {
    if (!selected) return;
    if (selected.status !== 'SIGNED') { notify('Sözleşme önce imzalanmalı.', true); return; }
    setTransferring(true);
    try {
      const result = await apiFetch(`${BASE}/${selected.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId: null, assignedById: null }),
      });
      const wf = await apiFetch(`${BASE}/${selected.id}`);
      selectWorkflow(wf);
      setWorkflows(prev => prev.map(w => w.id === wf.id ? wf : w));
      if (result.project) setTransferProject({ code: result.project.code, name: result.project.name });
      notify(`${result.project?.code ? `Proje ${result.project.code} oluşturuldu — ` : ''}${result.tasksCreated} görev Proje Yönetimi modülüne aktarıldı.`);
    } catch (e) { notify((e as Error).message, true); }
    finally { setTransferring(false); }
  };

  const handleHandoffProcurement = async () => {
    if (!selected) return;
    if (!['SIGNED', 'TRANSFERRED'].includes(selected.status)) { notify('Sözleşme önce imzalanmalı.', true); return; }
    if (selected.procurementRequestId) { notify('Bu sözleşme zaten Satınalmaya aktarıldı.', true); return; }
    setTransferring(true);
    try {
      const result = await apiFetch(`${BASE}/${selected.id}/handoff-procurement`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      const wf = await apiFetch(`${BASE}/${selected.id}`);
      selectWorkflow(wf);
      setWorkflows(prev => prev.map(w => w.id === wf.id ? wf : w));
      const n = result.purchaseRequest?.items?.length ?? 0;
      notify(`Satınalmaya aktarıldı — ${n} kalemlik satınalma talebi (referans alış fiyatlarıyla) oluşturuldu.`);
    } catch (e) { notify((e as Error).message, true); }
    finally { setTransferring(false); }
  };

  // ── Status badge ──────────────────────────────────────────────────────────────

  const stepIndex = (status: string) => WORKFLOW_STATUS_STEPS.findIndex(s => s.key === status);

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      {/* Mod geçişi: Sözleşmeler ↔ Hukuk (Faz 6b) */}
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => setMode('contracts')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
            mode === 'contracts' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100'
          }`}>
          <FileText className="w-4 h-4" /> Sözleşmeler
        </button>
        <button
          onClick={() => setMode('legal')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
            mode === 'legal' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100'
          }`}>
          <Shield className="w-4 h-4" /> Hukuk
        </button>
      </div>

      {mode === 'legal' ? <LegalView /> : (
      <div className="flex flex-1 min-h-0 gap-4">
      {/* Left Panel — Workflow List */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3">
        <div className="glass-card p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            Sözleşme Süreçleri
            <span className="ml-auto text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">TEST</span>
          </h2>

          {/* New workflow form */}
          <div className="space-y-2 mb-4 pb-4 border-b border-white/10">
            <input
              className="input-glass w-full text-sm"
              placeholder="Sözleşme başlığı..."
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
            <select
              className="input-glass w-full text-sm"
              value={form.opportunityId}
              onChange={e => {
                const oppId = e.target.value;
                const price = oppId ? bestProposalPrice(oppId, proposals) : null;
                setForm(f => ({
                  ...f,
                  opportunityId: oppId,
                  ...(price !== null && { contractValue: String(price) }),
                }));
              }}
            >
              <option value="">Fırsat seçin (opsiyonel)</option>
              {opportunities.filter(o => o.status === 'WON').map(o => (
                <option key={o.id} value={o.id}>{o.title}</option>
              ))}
            </select>
            <input
              className="input-glass w-full text-sm"
              placeholder="İhale adı (idari şartnamedeki resmi ad)..."
              value={form.tenderName}
              onChange={e => setForm(f => ({ ...f, tenderName: e.target.value }))}
            />
            <input
              className="input-glass w-full text-sm"
              placeholder="İKN (İhale Kayıt No) — örn: 2024/123456"
              value={form.tenderNo}
              onChange={e => setForm(f => ({ ...f, tenderNo: e.target.value }))}
            />
            <input
              className="input-glass w-full text-sm"
              placeholder="Sözleşme bedeli (₺) — fırsat seçince otomatik dolar"
              type="number"
              value={form.contractValue}
              onChange={e => setForm(f => ({ ...f, contractValue: e.target.value }))}
            />
            <input
              className="input-glass w-full text-sm"
              type="date"
              title="İmza son tarihi"
              value={form.deadline}
              onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
            />
            <button
              onClick={handleCreate}
              disabled={loading}
              className="btn-primary w-full text-sm flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Yeni Süreç
            </button>
          </div>

          {/* Workflow list */}
          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-380px)]">
            {loading && workflows.length === 0 && (
              <div className="flex items-center justify-center py-4 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Yükleniyor...
              </div>
            )}
            {workflows.map(wf => (
              <button
                key={wf.id}
                onClick={() => { selectWorkflow(wf); setTab('context'); }}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selected?.id === wf.id
                    ? 'border-blue-500/60 bg-blue-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className="text-sm font-medium text-slate-200 truncate">{wf.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${DOC_STATUS_STYLES[wf.status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                    {WORKFLOW_STATUS_STEPS.find(s => s.key === wf.status)?.label || wf.status}
                  </span>
                  <span className="text-xs text-slate-500">{wf.documents.length} belge</span>
                </div>
                {wf.contractValue > 0 && (
                  <div className="text-xs text-emerald-400 mt-1">
                    ₺{wf.contractValue.toLocaleString('tr-TR')}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Detail */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toast */}
        <AnimatePresence>
          {(error || success) && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className={`mb-3 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 border ${
                error ? 'bg-red-500/15 border-red-500/30 text-red-300' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              }`}
            >
              {error ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
              {error || success}
            </motion.div>
          )}
        </AnimatePresence>

        {!selected ? (
          <div className="glass-card flex-1 flex items-center justify-center text-slate-500">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Sol panelden bir süreç seçin ya da yeni oluşturun</p>
            </div>
          </div>
        ) : (
          <div className="glass-card flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-lg font-semibold text-white">{selected.title}</h1>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {selected.contractValue > 0 && (
                      <span className="text-sm text-emerald-400 font-medium">₺{selected.contractValue.toLocaleString('tr-TR')}</span>
                    )}
                    {selected.deadline && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Son: {new Date(selected.deadline).toLocaleDateString('tr-TR')}
                      </span>
                    )}
                  </div>
                </div>
                {/* Status progress */}
                <div className="hidden lg:flex items-center gap-1">
                  {WORKFLOW_STATUS_STEPS.map((step, i) => {
                    const current = stepIndex(selected.status);
                    const done = i <= current;
                    return (
                      <React.Fragment key={step.key}>
                        <div className={`text-xs px-2 py-1 rounded border transition-colors ${
                          done ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/5 border-white/10 text-slate-500'
                        }`}>{step.label}</div>
                        {i < WORKFLOW_STATUS_STEPS.length - 1 && (
                          <ChevronRight className={`w-3 h-3 ${done && i < current ? 'text-blue-400' : 'text-slate-600'}`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mt-3">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                      tab === t.id
                        ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    <t.icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >

                  {/* ── CONTEXT TAB ─────────────────────────────────────────── */}
                  {tab === 'context' && (
                    <div className="space-y-5">

                      {/* Fırsat bağlantısı */}
                      {selected.opportunityId && (
                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                          <div>
                            <span className="font-medium">Kazanılan Fırsat:</span>{' '}
                            {opportunities.find(o => o.id === selected.opportunityId)?.title || selected.opportunityId}
                          </div>
                        </div>
                      )}

                      {/* İhale bilgileri */}
                      <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-3">
                        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5" /> İhale Bilgileri
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-slate-400 mb-1 block">İhale / Proje Adı</label>
                            <input
                              key={`tenderName-${selected.id}`}
                              className="input-glass w-full text-sm"
                              defaultValue={selected.tenderName || ''}
                              placeholder="İdari şartnamenin resmi adı..."
                              onBlur={async e => {
                                const wf = await apiFetch(`${BASE}/${selected.id}`, {
                                  method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ tenderName: e.target.value }),
                                });
                                selectWorkflow(wf);
                              }}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 mb-1 block">İKN (İhale Kayıt No)</label>
                            <input
                              key={`tenderNo-${selected.id}`}
                              className="input-glass w-full text-sm"
                              defaultValue={selected.tenderNo || ''}
                              placeholder="Örn: 2024/123456"
                              onBlur={async e => {
                                const val = e.target.value.trim();
                                const wf = await apiFetch(`${BASE}/${selected.id}`, {
                                  method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    tenderNo: val,
                                    // İKN girilince başlığı güncelle
                                    title: [
                                      selected.tenderName || selected.title,
                                      val ? `İKN: ${val}` : null,
                                    ].filter(Boolean).join(' — '),
                                  }),
                                });
                                selectWorkflow(wf);
                                setWorkflows(prev => prev.map(w => w.id === wf.id ? wf : w));
                              }}
                            />
                          </div>
                        </div>
                        {selected.projectName && (
                          <div className="text-xs text-slate-400 flex items-center gap-1.5">
                            <Cpu className="w-3 h-3 text-purple-400" />
                            AI çıkardı: <span className="text-purple-300 font-medium">{selected.projectName}</span>
                          </div>
                        )}
                      </div>

                      {/* Sözleşme bedeli ve tarih */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Sözleşme Bedeli (₺)</label>
                          <input
                            key={`val-${selected.id}`}
                            className="input-glass w-full"
                            type="number"
                            defaultValue={selected.contractValue}
                            onBlur={async e => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) {
                                const wf = await apiFetch(`${BASE}/${selected.id}`, {
                                  method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ contractValue: val }),
                                });
                                selectWorkflow(wf);
                              }
                            }}
                          />
                          {selected.contractValue > 0 && (
                            <p className="text-xs text-emerald-400 mt-1">
                              ₺{selected.contractValue.toLocaleString('tr-TR')} — kazanılan tekliften
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">İmza Son Tarihi</label>
                          <input
                            className="input-glass w-full"
                            type="date"
                            defaultValue={selected.deadline?.slice(0, 10)}
                            onBlur={async e => {
                              const wf = await apiFetch(`${BASE}/${selected.id}`, {
                                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ deadline: e.target.value }),
                              });
                              selectWorkflow(wf);
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Notlar</label>
                        <textarea
                          className="input-glass w-full h-20 resize-none"
                          defaultValue={selected.notes || ''}
                          placeholder="Sözleşme ile ilgili önemli notlar..."
                          onBlur={async e => {
                            await apiFetch(`${BASE}/${selected.id}`, {
                              method: 'PUT', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ notes: e.target.value }),
                            });
                          }}
                        />
                      </div>

                      <div className="flex justify-end">
                        <button onClick={() => setTab('analysis')} className="btn-primary flex items-center gap-2">
                          Analize Geç <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── ANALYSIS TAB ─────────────────────────────────────────── */}
                  {tab === 'analysis' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1">
                            <FileText className="w-3 h-3" /> Sözleşme Metni
                          </label>
                          <textarea
                            className="input-glass w-full h-56 resize-none font-mono text-xs"
                            placeholder="Sözleşme metnini buraya yapıştırın..."
                            value={contractText}
                            onChange={e => setContractText(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1">
                            <BookOpen className="w-3 h-3" /> İdari Şartname
                          </label>
                          <textarea
                            className="input-glass w-full h-56 resize-none font-mono text-xs"
                            placeholder="İdari şartname metnini buraya yapıştırın..."
                            value={specText}
                            onChange={e => setSpecText(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button onClick={handleSaveTexts} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
                          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          Kaydet
                        </button>
                        <button
                          onClick={handleAnalyse}
                          disabled={analysing || (!contractText.trim() && !specText.trim())}
                          className="btn-primary flex items-center gap-2 text-sm"
                        >
                          {analysing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5" />}
                          {analysing ? 'AI Analiz Yapıyor...' : 'AI ile Analiz Et'}
                        </button>
                        {aiConfigured === false && (
                          <span className="text-xs text-amber-400 flex items-center gap-1 ml-auto">
                            <AlertCircle className="w-3 h-3" /> YZ yapılandırılmadı (Ayarlar → Entegrasyonlar) — örnek çıktı gösterilecek
                          </span>
                        )}
                      </div>

                      {/* Analysis results */}
                      {analysis && (
                        <div className="space-y-4 mt-2">
                          {/* Summary card */}
                          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                            <h3 className="text-sm font-semibold text-blue-300 mb-3 flex items-center gap-2">
                              <Star className="w-4 h-4" /> Sözleşme Özeti
                            </h3>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="text-slate-400">Tür:</span>
                                <span className="text-slate-200 ml-2">{analysis.contract_summary?.type}</span>
                              </div>
                              {analysis.contract_summary?.tax_obligations?.length > 0 && (
                                <div>
                                  <span className="text-slate-400 block mb-1">Vergi Yükümlülükleri:</span>
                                  {analysis.contract_summary.tax_obligations.map((t, i) => (
                                    <span key={i} className="block text-amber-300">• {t}</span>
                                  ))}
                                </div>
                              )}
                              {analysis.contract_summary?.project_impacts?.length > 0 && (
                                <div className="col-span-2">
                                  <span className="text-slate-400 block mb-1">Proje Etkileri:</span>
                                  {analysis.contract_summary.project_impacts.map((p, i) => (
                                    <span key={i} className="block text-slate-300">• {p}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Key clauses */}
                          {analysis.key_clauses?.length > 0 && (
                            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                              <h3 className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> Önemli Maddeler
                              </h3>
                              <div className="space-y-2">
                                {analysis.key_clauses.map((c, i) => (
                                  <div key={i} className="text-xs border border-white/10 rounded-lg p-3">
                                    <div className="font-medium text-slate-200">{c.clause}</div>
                                    <div className="text-slate-400 mt-1">Etki: {c.impact}</div>
                                    <div className="text-amber-300 mt-1">↗ {c.action_required}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Tasks preview */}
                          {analysis.tasks?.length > 0 && (
                            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                              <h3 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
                                <ClipboardList className="w-4 h-4" /> Yapılacaklar ({analysis.tasks.length} görev)
                              </h3>
                              <div className="space-y-1.5">
                                {analysis.tasks.map((t, i) => (
                                  <div key={i} className="flex items-start gap-2 text-xs">
                                    <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                      t.priority === 'HIGH' ? 'bg-red-400' : t.priority === 'LOW' ? 'bg-slate-400' : 'bg-amber-400'
                                    }`} />
                                    <span className="text-slate-300">{t.order}. {t.title}</span>
                                    <span className="ml-auto text-slate-500 whitespace-nowrap">~{t.estimated_days}g</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── DOCUMENTS TAB ─────────────────────────────────────────── */}
                  {tab === 'documents' && (
                    <div className="space-y-3">
                      {/* Progress summary */}
                      {selected.documents.length > 0 && (() => {
                        const req = selected.documents.filter(d => d.isRequired);
                        const uploaded = req.filter(d => ['UPLOADED', 'VERIFIED', 'WAIVED'].includes(d.status));
                        const pct = req.length > 0 ? Math.round((uploaded.length / req.length) * 100) : 0;
                        const allUploaded = pct === 100;
                        return (
                          <div className="space-y-2">
                            <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-4">
                              <div className="flex-1">
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-slate-400">Zorunlu belge yükleme</span>
                                  <span className={allUploaded ? 'text-emerald-400' : 'text-slate-300'}>{uploaded.length}/{req.length}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-white/10">
                                  <div
                                    className={`h-full rounded-full transition-all ${allUploaded ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                              <span className={`text-lg font-bold ${allUploaded ? 'text-emerald-400' : 'text-blue-400'}`}>{pct}%</span>
                            </div>
                            {allUploaded && selected.status !== 'READY_TO_SIGN' && selected.status !== 'SIGNED' && selected.status !== 'TRANSFERRED' && (
                              <button
                                onClick={() => { setTab('signing'); handleMarkReadyToSign(); }}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
                              >
                                <Shield className="w-4 h-4" /> Tüm belgeler yüklendi — İmzaya Hazır İşaretle
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400">{selected.documents.length} belge</span>
                        <button onClick={handleAddDoc} className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300">
                          <Plus className="w-3.5 h-3.5" /> Manuel Ekle
                        </button>
                      </div>

                      {selected.documents.length === 0 ? (
                        <div className="py-12 text-center text-slate-500">
                          <CheckSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Henüz belge yok.</p>
                          <p className="text-xs mt-1">Analiz sekmesinde AI ile belge listesini otomatik oluşturun.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selected.documents.map(doc => {
                            const TypeIcon = DOC_TYPE_LABELS[doc.docType]?.icon || Tag;
                            const isExpanded = expandedDoc === doc.id;
                            const isUploading = uploadingDocId === doc.id;
                            const hasFile = !!doc.fileUrl;
                            return (
                              <div key={doc.id} className="border border-white/10 rounded-xl overflow-hidden bg-white/3">
                                <div className="flex items-center gap-3 p-3">
                                  <TypeIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />

                                  {/* Name + meta */}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm text-slate-200 truncate">{doc.name}</div>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                      <span className="text-xs text-slate-500">{DOC_TYPE_LABELS[doc.docType]?.label || doc.docType}</span>
                                      {doc.isAiGenerated && (
                                        <span className="text-xs text-purple-400 flex items-center gap-0.5">
                                          <Cpu className="w-2.5 h-2.5" /> AI
                                        </span>
                                      )}
                                      {doc.isRequired && <span className="text-xs text-red-400">Zorunlu</span>}
                                      {hasFile && (
                                        <a
                                          href={doc.fileUrl!.startsWith('http') ? doc.fileUrl! : `http://localhost:3002${doc.fileUrl}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5 max-w-[180px] truncate"
                                        >
                                          <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                                          {doc.fileUrl!.split('/').pop()}
                                        </a>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right: upload action or status badge */}
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {doc.status === 'WAIVED' ? (
                                      <span className="text-xs px-2 py-0.5 rounded border bg-slate-500/20 text-slate-400 border-slate-500/30">Muaf</span>
                                    ) : doc.status === 'VERIFIED' ? (
                                      <span className="text-xs px-2 py-0.5 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/30 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Onaylandı
                                      </span>
                                    ) : hasFile ? (
                                      <div className="flex items-center gap-1.5">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                        <button
                                          onClick={() => fileInputRefs.current[doc.id]?.click()}
                                          disabled={isUploading}
                                          className="text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                                        >
                                          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Değiştir'}
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => fileInputRefs.current[doc.id]?.click()}
                                        disabled={isUploading}
                                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                                      >
                                        {isUploading
                                          ? <><Loader2 className="w-3 h-3 animate-spin" /> Yükleniyor...</>
                                          : <><Upload className="w-3 h-3" /> Yükle</>
                                        }
                                      </button>
                                    )}

                                    <button
                                      onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
                                      className="text-slate-600 hover:text-slate-400 transition-colors"
                                    >
                                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </button>
                                  </div>

                                  {/* Hidden file input */}
                                  <input
                                    ref={el => { fileInputRefs.current[doc.id] = el; }}
                                    type="file"
                                    className="hidden"
                                    onChange={e => {
                                      const file = e.target.files?.[0];
                                      if (file) handleFileUpload(doc.id, file);
                                      e.target.value = '';
                                    }}
                                  />
                                </div>

                                {/* Expanded: status/date/notes/delete */}
                                {isExpanded && (
                                  <div className="px-3 pb-3 border-t border-white/10 space-y-2 pt-3">
                                    {doc.description && <p className="text-xs text-slate-400">{doc.description}</p>}
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Durum</label>
                                        <select
                                          className="input-glass w-full text-xs"
                                          value={doc.status}
                                          onChange={e => handleDocStatus(doc.id, e.target.value)}
                                        >
                                          {Object.entries(DOC_STATUS_LABELS).map(([v, l]) => (
                                            <option key={v} value={v}>{l}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Son Tarih</label>
                                        <input
                                          className="input-glass w-full text-xs"
                                          type="date"
                                          defaultValue={doc.deadline?.slice(0, 10) || ''}
                                          onBlur={e => handleDocFieldUpdate(doc.id, 'deadline', e.target.value)}
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-500 mb-1 block">Notlar</label>
                                      <input
                                        className="input-glass w-full text-xs"
                                        defaultValue={doc.notes || ''}
                                        placeholder="Belge hakkında not..."
                                        onBlur={e => handleDocFieldUpdate(doc.id, 'notes', e.target.value)}
                                      />
                                    </div>
                                    <div className="flex justify-end">
                                      <button
                                        onClick={() => handleDeleteDoc(doc.id)}
                                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                                      >
                                        <Trash2 className="w-3 h-3" /> Sil
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── SIGNING TAB ─────────────────────────────────────────── */}
                  {tab === 'signing' && (
                    <div className="space-y-6 max-w-lg">
                      {/* Pre-signing checklist */}
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-slate-300">İmzalama Öncesi Kontrol</h3>
                        {[
                          { label: 'AI analizi yapıldı', ok: !!selected.aiAnalysis },
                          { label: 'Zorunlu belgeler tamamlandı', ok: selected.documents.filter(d => d.isRequired).every(d => ['VERIFIED', 'UPLOADED', 'WAIVED'].includes(d.status)) },
                          { label: 'Sözleşme bedeli girildi', ok: selected.contractValue > 0 },
                        ].map((item, i) => (
                          <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${
                            item.ok ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-white/5'
                          }`}>
                            {item.ok
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                              : <XCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                            <span className={`text-sm ${item.ok ? 'text-slate-200' : 'text-slate-500'}`}>{item.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* STEP 1 — mark ready (if not already past this stage) */}
                      {!['READY_TO_SIGN', 'PENDING_SIGNATURE_APPROVAL', 'SIGNED', 'TRANSFERRED'].includes(selected.status) && (
                        <button
                          onClick={handleMarkReadyToSign}
                          className="btn-secondary w-full text-sm flex items-center justify-center gap-2"
                        >
                          <Shield className="w-4 h-4" /> İmzaya Hazır İşaretle
                        </button>
                      )}

                      {/* STEP 2 — send for approval (READY_TO_SIGN) */}
                      {selected.status === 'READY_TO_SIGN' && (
                        <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 space-y-4">
                          <h3 className="text-sm font-semibold text-blue-300 flex items-center gap-2">
                            <PenTool className="w-4 h-4" /> Sözleşme İmzalama
                          </h3>
                          <div>
                            <label className="text-xs text-slate-400 mb-1 block">İmzalanma Tarihi</label>
                            <input
                              className="input-glass w-full"
                              type="date"
                              value={signedDate}
                              onChange={e => setSignedDate(e.target.value)}
                            />
                          </div>
                          <button
                            onClick={handleSendForApproval}
                            disabled={loading || !signedDate}
                            className="btn-primary w-full flex items-center justify-center gap-2"
                          >
                            {loading
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <UserCheck className="w-4 h-4" />}
                            Birim Yöneticisinin Onayına Gönder
                          </button>
                        </div>
                      )}

                      {/* STEP 3 — pending approval (PENDING_SIGNATURE_APPROVAL) */}
                      {selected.status === 'PENDING_SIGNATURE_APPROVAL' && (
                        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-4">
                          <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
                            <div>
                              <h3 className="text-sm font-semibold text-amber-300">Birim Yöneticisi Onayı Bekleniyor</h3>
                              {selected.signedDate && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                  İmza tarihi: {new Date(selected.signedDate).toLocaleDateString('tr-TR')}
                                </p>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-slate-400">
                            Onaylandığında sözleşme imzalanmış olarak kaydedilecek ve görevler otomatik olarak Proje Yönetimine aktarılacak.
                          </p>
                          <div className="flex gap-3">
                            <button
                              onClick={handleRejectSignature}
                              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 text-sm transition-colors"
                            >
                              <UserX className="w-4 h-4" /> Reddet
                            </button>
                            <button
                              onClick={handleApproveSignature}
                              disabled={transferring}
                              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              {transferring
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <UserCheck className="w-4 h-4" />}
                              Onayla &amp; Aktar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* STEP 4 — signed/transferred */}
                      {(selected.status === 'SIGNED' || selected.status === 'TRANSFERRED') && (
                        <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-emerald-300">Sözleşme İmzalandı</p>
                            {selected.signedDate && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                {new Date(selected.signedDate).toLocaleDateString('tr-TR')}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── TRANSFER TAB ─────────────────────────────────────────── */}
                  {tab === 'transfer' && (
                    <div className="space-y-6 max-w-lg">

                      {/* Status banner */}
                      {selected.status === 'TRANSFERRED' ? (
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                          <p className="text-sm text-emerald-300 font-medium">Süreç tamamlandı</p>
                          <p className="text-xs text-slate-400 mt-1">
                            Görevler Proje Yönetimi modülünde görünür.
                            {selected.signedDate && ` · İmzalandı: ${new Date(selected.signedDate).toLocaleDateString('tr-TR')}`}
                          </p>
                          {selected.projectId && (
                            <p className="text-xs text-emerald-300 font-bold mt-2">
                              ✓ Proje kaydı oluşturuldu{transferProject?.code ? `: ${transferProject.code}${transferProject.name ? ` — ${transferProject.name}` : ''}` : ''} (Proje Yönetimi modülünde)
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className={`p-4 rounded-xl border ${
                          selected.status === 'SIGNED'
                            ? 'border-amber-500/30 bg-amber-500/10'
                            : 'border-white/10 bg-white/5'
                        }`}>
                          <div className="flex items-center gap-3">
                            {selected.status === 'SIGNED'
                              ? <AlertCircle className="w-5 h-5 text-amber-400" />
                              : <AlertCircle className="w-5 h-5 text-slate-500" />}
                            <span className="text-sm font-medium text-slate-200">
                              {selected.status === 'SIGNED'
                                ? 'İmzalandı ama henüz aktarılmadı'
                                : 'Aktarım için önce sözleşmenin onaylanması gerekiyor'}
                            </span>
                          </div>
                          {selected.status === 'SIGNED' && (
                            <button
                              onClick={handleTransfer}
                              disabled={transferring}
                              className="btn-primary w-full flex items-center justify-center gap-2 mt-4"
                            >
                              {transferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              {transferring ? 'Aktarılıyor...' : 'Proje Yönetimine Aktar'}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Satınalmaya Aktar — BoM + referans alış fiyatları */}
                      {(selected.status === 'SIGNED' || selected.status === 'TRANSFERRED') && (
                        <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                          {selected.procurementRequestId ? (
                            <div className="flex items-center gap-3">
                              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-emerald-300">Satınalmaya aktarıldı</p>
                                <p className="text-xs text-slate-400 mt-0.5">BoM ve referans alış fiyatları Satınalma Talebi olarak iletildi (Satın Alma modülünde DRAFT).</p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-3 mb-3">
                                <ShoppingCart className="w-5 h-5 text-blue-400" />
                                <span className="text-sm font-medium text-slate-200">İşi Satınalmaya devret — BoM + üretici/distribütör alış fiyatlarıyla</span>
                              </div>
                              <button onClick={handleHandoffProcurement} disabled={transferring}
                                className="btn-primary w-full flex items-center justify-center gap-2">
                                {transferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                                {transferring ? 'Aktarılıyor...' : 'Satınalmaya Aktar'}
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {/* Task list */}
                      {analysis?.tasks && analysis.tasks.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-purple-400" />
                            {selected.status === 'TRANSFERRED' ? 'Aktarılan Görevler' : 'Aktarılacak Görevler'} ({analysis.tasks.length})
                          </h3>
                          <div className="space-y-2">
                            {analysis.tasks.map((t, i) => (
                              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-white/10 bg-white/3 text-sm">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                  t.priority === 'HIGH' ? 'bg-red-500/30 text-red-300' :
                                  t.priority === 'LOW' ? 'bg-slate-500/30 text-slate-400' :
                                  'bg-amber-500/30 text-amber-300'
                                }`}>{t.order}</span>
                                <div className="flex-1">
                                  <div className="text-slate-200">[Sözleşme] {t.title}</div>
                                  <div className="text-xs text-slate-500 mt-0.5">{t.description}</div>
                                </div>
                                <span className="text-xs text-slate-500 whitespace-nowrap">~{t.estimated_days}g</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
      </div>
      )}
    </div>
  );
}

// ── Hukuk Görünümü (Faz 6b) ─────────────────────────────────────────────────────

const LEGAL_TYPE_LABELS: Record<string, string> = {
  CONTRACT_REVIEW: 'Sözleşme İncelemesi', LEGAL_OPINION: 'Hukuki Görüş',
  DISPUTE: 'Uyuşmazlık', LITIGATION: 'Dava', OTHER: 'Diğer',
};
const LEGAL_STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-700 border-amber-200',
  IN_REVIEW: 'bg-blue-100 text-blue-700 border-blue-200',
  RESPONDED: 'bg-purple-100 text-purple-700 border-purple-200',
  ESCALATED: 'bg-red-100 text-red-700 border-red-200',
  CLOSED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};
const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'text-slate-500', MEDIUM: 'text-amber-600', HIGH: 'text-red-600',
};

function LegalView() {
  const [view, setView] = useState<'requests' | 'cases'>('cases');
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [requests, setRequests] = useState<LegalRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, r] = await Promise.all([apiService.getLegalCases(), apiService.getLegalRequests()]);
      setCases(c as LegalCase[]); setRequests(r as LegalRequest[]);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const convertToCase = async (req: LegalRequest) => {
    await apiService.createLegalCase({
      title: req.title, type: 'CONTRACT_REVIEW', priority: req.priority || 'MEDIUM',
      summary: req.description, sourceTaskId: req.id, categoryCode: 'HUK',
    });
    setMsg('Talep hukuki vakaya dönüştürüldü.');
    setView('cases');
    load();
  };

  const pendingRequests = requests.filter(r => !r.converted);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setView('cases')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${view === 'cases' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100'}`}>
            Hukuki Vakalar <span className="ml-1 text-xs opacity-70">({cases.length})</span>
          </button>
          <button onClick={() => setView('requests')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${view === 'requests' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100'}`}>
            Gelen Talepler <span className="ml-1 text-xs opacity-70">({pendingRequests.length})</span>
          </button>
        </div>
        {view === 'cases' && (
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Yeni Vaka
          </button>
        )}
      </div>

      {msg && <div className="glass-card p-3 text-sm text-emerald-600 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {msg}</div>}
      {loading && <p className="text-sm text-slate-400 italic px-1">Yükleniyor...</p>}

      {view === 'requests' && (
        pendingRequests.length === 0
          ? <div className="glass-card p-12 text-center text-slate-400 italic">Bekleyen hukuk talebi yok. (Görevler modülünde "Hukuk / Şirket Avukatı" modülüyle görev oluşturulduğunda burada görünür.)</div>
          : <div className="space-y-3">
              {pendingRequests.map(r => (
                <div key={r.id} className="glass-card p-4 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-slate-900">{r.title}</h4>
                    {r.description && <p className="text-xs text-slate-600 mt-1">{r.description}</p>}
                    <p className="text-xs text-slate-500 mt-1">Öncelik: <span className={PRIORITY_STYLES[r.priority] || 'text-slate-400'}>{r.priority}</span> · {r.status}</p>
                  </div>
                  <button onClick={() => convertToCase(r)} className="btn-secondary text-xs flex items-center gap-1 whitespace-nowrap">
                    <ArrowRightCircle className="w-3.5 h-3.5" /> Vakaya Dönüştür
                  </button>
                </div>
              ))}
            </div>
      )}

      {view === 'cases' && (
        cases.length === 0
          ? <div className="glass-card p-12 text-center text-slate-400 italic">Henüz hukuki vaka yok. Sözleşme incelemesi, hukuki görüş veya uyuşmazlık kaydı ekleyin.</div>
          : <div className="space-y-3">
              {cases.map(c => (
                <div key={c.id} className="glass-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-slate-900">{c.title}</h4>
                        <span className="text-xs text-slate-500">{LEGAL_TYPE_LABELS[c.type] || c.type}</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg border ${LEGAL_STATUS_STYLES[c.status] || ''}`}>{c.status}</span>
                        <span className={`text-[10px] font-bold uppercase ${PRIORITY_STYLES[c.priority]}`}>{c.priority}</span>
                        {c.docNumber && <span className="text-[10px] font-mono text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-lg">{c.docNumber}</span>}
                      </div>
                      {c.summary && <p className="text-xs text-slate-600">{c.summary}</p>}
                      {c.opinion && <p className="text-xs text-slate-600"><span className="font-bold">Görüş:</span> {c.opinion}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.status !== 'CLOSED' && (
                        <button onClick={async () => { await apiService.updateLegalCase(c.id, { status: 'CLOSED' }); load(); }}
                          className="text-xs text-emerald-600 hover:underline">Kapat</button>
                      )}
                      <button onClick={async () => { await apiService.deleteLegalCase(c.id); load(); }}
                        className="text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
      )}

      <AnimatePresence>
        {showForm && <LegalCaseForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      </AnimatePresence>
    </div>
  );
}

function LegalCaseForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Record<string, string>>({ type: 'CONTRACT_REVIEW', priority: 'MEDIUM' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      if (!f.title) throw new Error('Başlık zorunlu.');
      await apiService.createLegalCase({ ...f, categoryCode: f.categoryCode || 'HUK' });
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Kaydetme hatası.'); setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="glass-card p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Yeni Hukuki Vaka</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><XCircle className="w-5 h-5" /></button>
        </div>
        <input className="input-glass w-full text-sm" placeholder="Başlık" value={f.title || ''} onChange={e => set('title', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <select className="input-glass w-full text-sm" value={f.type} onChange={e => set('type', e.target.value)}>
            {Object.entries(LEGAL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input-glass w-full text-sm" value={f.priority} onChange={e => set('priority', e.target.value)}>
            {['LOW', 'MEDIUM', 'HIGH'].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <textarea className="input-glass w-full text-sm resize-none" rows={2} placeholder="Özet / durum" value={f.summary || ''} onChange={e => set('summary', e.target.value)} />
        <textarea className="input-glass w-full text-sm resize-none" rows={2} placeholder="Hukuki görüş (opsiyonel)" value={f.opinion || ''} onChange={e => set('opinion', e.target.value)} />
        <input className="input-glass w-full text-sm" placeholder="Doküman Kategori Kodu (vars. HUK)" value={f.categoryCode || ''} onChange={e => set('categoryCode', e.target.value.toUpperCase())} />
        {err && <p className="text-xs text-red-400 font-bold">{err}</p>}
        <button onClick={save} disabled={saving} className="btn-primary w-full text-sm disabled:opacity-50">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
      </motion.div>
    </motion.div>
  );
}

export default ContractWorkflowModule;
