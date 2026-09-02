import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiService } from '../services/apiService';
import { useAIGate } from '../contexts/AIGateContext';
import { useAuth } from '../contexts/AuthContext';
import { Tender } from '../types/tender';
import { ContractWorkflow, ContractWorkflowDoc, AiAnalysis, Props } from './contract-workflow/types';
import { TabId } from './contract-workflow/constants';
import { BASE, apiFetch, resolveWorkflowCurrency } from './contract-workflow/helpers';
import WorkflowListPanel, { WorkflowFormState } from './contract-workflow/WorkflowListPanel';
import DetailHeader from './contract-workflow/DetailHeader';
import ContextTab from './contract-workflow/ContextTab';
import AnalysisTab from './contract-workflow/AnalysisTab';
import DocumentsTab from './contract-workflow/DocumentsTab';
import SigningTab from './contract-workflow/SigningTab';
import TransferTab from './contract-workflow/TransferTab';
import CancelModal from './contract-workflow/CancelModal';
import LegalView from './contract-workflow/LegalView';

export function ContractWorkflowModule({ opportunities = [], proposals = [], initialItemId }: Props) {
  const { currentUser } = useAuth();
  const [mode, setMode] = useState<'contracts' | 'legal'>('contracts');
  const [tab, setTab] = useState<TabId>('context');
  const [workflows, setWorkflows] = useState<ContractWorkflow[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [selected, setSelected] = useState<ContractWorkflow | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferProject, setTransferProject] = useState<{ code?: string; name?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cancelModalTarget, setCancelModalTarget] = useState<'CANCELLED' | 'TERMINATED' | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Form states
  const [form, setForm] = useState<WorkflowFormState>({ title: '', opportunityId: '', contractValue: '', deadline: '', notes: '', tenderName: '', tenderNo: '' });
  const [contractText, setContractText] = useState('');
  const [specText, setSpecText] = useState('');
  const [signedDate, setSignedDate] = useState('');
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analysisUsedAI, setAnalysisUsedAI] = useState<boolean | null>(null);
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
  // Sözleşmeye Hazır İşler formunda fırsat seçilince İhale adı/İKN otomatik dolabilsin diye
  // (bkz. WorkflowListPanel.tsx) — yalnız WON ihaleler eşleştirilir.
  useEffect(() => {
    apiService.getTenders({ status: 'WON' }).then(t => setTenders(t as Tender[])).catch(() => setTenders([]));
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

  const handleTenderNameBlur = async (value: string) => {
    if (!selected) return;
    const wf = await apiFetch(`${BASE}/${selected.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenderName: value }),
    });
    selectWorkflow(wf);
  };

  const handleTenderNoBlur = async (val: string) => {
    if (!selected) return;
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
  };

  const handleContractValueBlur = async (value: string) => {
    if (!selected) return;
    const val = parseFloat(value);
    if (!isNaN(val)) {
      const wf = await apiFetch(`${BASE}/${selected.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractValue: val }),
      });
      selectWorkflow(wf);
    }
  };

  const handleDeadlineBlur = async (value: string) => {
    if (!selected) return;
    const wf = await apiFetch(`${BASE}/${selected.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deadline: value }),
    });
    selectWorkflow(wf);
  };

  const handleNotesBlur = async (value: string) => {
    if (!selected) return;
    await apiFetch(`${BASE}/${selected.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: value }),
    });
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
      setAnalysisUsedAI(Boolean(result.usedAI));
      selectWorkflow(result.workflow);
      setWorkflows(prev => prev.map(w => w.id === result.workflow.id ? result.workflow : w));
      notify(result.usedAI ? 'AI analizi tamamlandı. Evrak listesi oluşturuldu.' : 'YZ çağrısı başarısız oldu — örnek (standart) evrak listesi gösteriliyor. Ayarlar → Entegrasyonlar\'ı kontrol edin.');
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

  // Faz — tüm zorunlu evraklar UPLOADED/VERIFIED/WAIVED olduğunda READY_TO_SIGN'a otomatik
  // geçiş; hem manuel dosya yüklemesinden hem de arşivden otomatik alınan evraktan sonra
  // aynı kural geçerli olmalı (bkz. handleFileUpload + handleFetchFromArchive).
  const maybeAutoMarkReady = async (updatedDocs: ContractWorkflowDoc[]) => {
    if (!selected) return;
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
  };

  const handleFetchFromArchive = async (docId: string) => {
    if (!selected) return;
    setUploadingDocId(docId);
    try {
      const doc = await apiFetch(`${BASE}/${selected.id}/documents/${docId}/from-archive`, { method: 'POST' });
      const updatedDocs = selected.documents.map(d => d.id === doc.id ? doc : d);
      setSelected(prev => prev ? { ...prev, documents: updatedDocs } : prev);
      notify('Şirket Evrakları arşivinden otomatik alındı.');
      await maybeAutoMarkReady(updatedDocs);
    } catch (e) { notify((e as Error).message, true); }
    finally { setUploadingDocId(null); }
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

      await maybeAutoMarkReady(updatedDocs);
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

  // B-06 düzeltmesi: transfer ucu, AI analizi görev üretmişse (normal durum) gerçek
  // bir unitId zorunlu tutuyor — eskiden her iki çağrı da hep unitId:null gönderdiği
  // için bu durumda 400 ile sessizce (yalnız toast) başarısız oluyor, sözleşme SIGNED'da
  // takılı kalıyordu. Görevler proje devrinin parçası olduğundan hedef birim PROJECT_MGR'ın
  // gerçek birimine çözülür; PROJECT_MGR/birimi tanımlı değilse backend zaten (görev varsa)
  // açık bir hata döner — sessiz bir fallback icat edilmiyor.
  const resolveProjectMgrUnitId = async (): Promise<string | null> => {
    try {
      const list = await apiService.getUsersByRole('PROJECT_MGR') as { unitId: string | null }[];
      return list.find(u => u.unitId)?.unitId ?? null;
    } catch { return null; }
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
      const targetUnitId = await resolveProjectMgrUnitId();
      const result = await apiFetch(`${BASE}/${selected.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId: targetUnitId, assignedById: null }),
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

  const handleCancelTerminate = async () => {
    if (!selected || !cancelModalTarget) return;
    if (!cancelReasonInput.trim()) { notify('İptal/fesih gerekçesi zorunludur.', true); return; }
    setCancelling(true);
    try {
      const wf = await apiFetch(`${BASE}/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: cancelModalTarget, cancelReason: cancelReasonInput.trim() }),
      });
      selectWorkflow(wf);
      setWorkflows(prev => prev.map(w => w.id === wf.id ? wf : w));
      notify(cancelModalTarget === 'CANCELLED' ? 'Sözleşme süreci iptal edildi.' : 'Sözleşme feshedildi.', true);
      setCancelModalTarget(null);
      setCancelReasonInput('');
    } catch (e) { notify((e as Error).message, true); }
    finally { setCancelling(false); }
  };

  // ── Transfer Tab ──────────────────────────────────────────────────────────────

  const handleTransfer = async () => {
    if (!selected) return;
    if (selected.status !== 'SIGNED') { notify('Sözleşme önce imzalanmalı.', true); return; }
    setTransferring(true);
    try {
      const targetUnitId = await resolveProjectMgrUnitId();
      const result = await apiFetch(`${BASE}/${selected.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId: targetUnitId, assignedById: null }),
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
      <WorkflowListPanel
        form={form}
        setForm={setForm}
        opportunities={opportunities}
        proposals={proposals}
        tenders={tenders}
        onCreate={handleCreate}
        loading={loading}
        workflows={workflows}
        selectedId={selected?.id}
        onSelectWorkflow={(wf) => { selectWorkflow(wf); setTab('context'); }}
      />

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
                error ? 'bg-red-100 border-red-200 text-red-700' : 'bg-emerald-100 border-emerald-200 text-emerald-700'
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
            <DetailHeader
              selected={selected}
              currency={resolveWorkflowCurrency(selected, opportunities)}
              currentUserRole={currentUser?.role}
              onCancelClick={() => setCancelModalTarget(selected.status === 'SIGNED' ? 'TERMINATED' : 'CANCELLED')}
              tab={tab}
              setTab={setTab}
            />

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
                  {tab === 'context' && (
                    <ContextTab
                      selected={selected}
                      opportunities={opportunities}
                      onTenderNameBlur={handleTenderNameBlur}
                      onTenderNoBlur={handleTenderNoBlur}
                      onContractValueBlur={handleContractValueBlur}
                      onDeadlineBlur={handleDeadlineBlur}
                      onNotesBlur={handleNotesBlur}
                      onGoToAnalysis={() => setTab('analysis')}
                    />
                  )}

                  {tab === 'analysis' && (
                    <AnalysisTab
                      contractText={contractText}
                      setContractText={setContractText}
                      specText={specText}
                      setSpecText={setSpecText}
                      onSaveTexts={handleSaveTexts}
                      loading={loading}
                      onAnalyse={handleAnalyse}
                      analysing={analysing}
                      aiConfigured={aiConfigured}
                      analysisUsedAI={analysisUsedAI}
                      analysis={analysis}
                    />
                  )}

                  {tab === 'documents' && (
                    <DocumentsTab
                      selected={selected}
                      expandedDoc={expandedDoc}
                      setExpandedDoc={setExpandedDoc}
                      uploadingDocId={uploadingDocId}
                      fileInputRefs={fileInputRefs}
                      onFileSelect={handleFileUpload}
                      onAddDoc={handleAddDoc}
                      onDeleteDoc={handleDeleteDoc}
                      onDocStatusChange={handleDocStatus}
                      onDocFieldUpdate={handleDocFieldUpdate}
                      onMarkReadyAndSign={() => { setTab('signing'); handleMarkReadyToSign(); }}
                      onFetchFromArchive={handleFetchFromArchive}
                    />
                  )}

                  {tab === 'signing' && (
                    <SigningTab
                      selected={selected}
                      signedDate={signedDate}
                      setSignedDate={setSignedDate}
                      onMarkReadyToSign={handleMarkReadyToSign}
                      onSendForApproval={handleSendForApproval}
                      loading={loading}
                      onRejectSignature={handleRejectSignature}
                      onApproveSignature={handleApproveSignature}
                      transferring={transferring}
                    />
                  )}

                  {tab === 'transfer' && (
                    <TransferTab
                      selected={selected}
                      transferProject={transferProject}
                      analysis={analysis}
                      transferring={transferring}
                      onTransfer={handleTransfer}
                      onHandoffProcurement={handleHandoffProcurement}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
      </div>
      )}

      <CancelModal
        target={cancelModalTarget}
        reasonInput={cancelReasonInput}
        setReasonInput={setCancelReasonInput}
        cancelling={cancelling}
        onClose={() => { setCancelModalTarget(null); setCancelReasonInput(''); }}
        onConfirm={handleCancelTerminate}
      />
    </div>
  );
}

export default ContractWorkflowModule;
