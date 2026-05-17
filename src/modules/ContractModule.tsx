import React, { useState } from 'react';
import { 
  FileText, 
  Archive, 
  CheckCircle2, 
  X, 
  MapPin, 
  Search, 
  Plus, 
  ArrowUpRight, 
  FileSignature, 
  Gavel, 
  Target,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { 
  MOCK_PROJECTS, 
  MOCK_DOCUMENTS, 
  MOCK_SYSTEM_USERS,
  MOCK_CONTRACT_DOCS,
} from '../constants';
import { 
  Contract,
  Project,
  TodoTask,
  Opportunity,
} from '../types';

import { TaskProgressTracker } from '../components/TaskProgressTracker';
import { workflowService } from '../services/workflowService';
import { useAuth } from '../contexts/AuthContext';
import { PermissionGate } from '../components/PermissionGate';

const ContractModule = ({ opportunities, contracts, setContracts, projects, setProjects, tasks, setTasks }: { 
  opportunities: Opportunity[], 
  contracts: Contract[], 
  setContracts: React.Dispatch<React.SetStateAction<Contract[]>>,
  projects: Project[],
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>,
  tasks?: TodoTask[],
  setTasks?: React.Dispatch<React.SetStateAction<TodoTask[]>>
}) => {
  const { currentUser } = useAuth();
  const [isHandingOff, setIsHandingOff] = useState(false);

  const generatedContracts = opportunities.filter(o => o.status === 'WON' && !contracts.some(c => c.opportunityId === o.id)).map(o => ({
    id: `contract-${o.id}`,
    opportunityId: o.id,
    projectId: undefined,
    status: 'DRAFT' as const,
    signedDate: undefined,
    guaranteeAmount: o.value * 0.1, // Example 10% guarantee
    guaranteeExpiry: '2026-12-31',
    endDate: '2027-12-31'
  }));

  const allContracts = [...contracts, ...generatedContracts];
  const [selectedContractId, setSelectedContractId] = useState<string | null>(() => {
    const unsigned = allContracts.find(c => c.status !== 'SIGNED');
    return unsigned ? unsigned.id : (allContracts[0]?.id || null);
  });
  const [showArchiveAccess, setShowArchiveAccess] = useState(false);
  const [pmToAssign, setPmToAssign] = useState('');
  const [showNewDocReqModal, setShowNewDocReqModal] = useState(false);
  const [newDocReq, setNewDocReq] = useState({
    name: '',
    description: '',
    dueDate: ''
  });
  
  const selectedContract = allContracts.find(c => c.id === selectedContractId);
  const project = MOCK_PROJECTS.find(p => p.id === selectedContract?.projectId);
  const opportunity = opportunities.find(o => o.id === selectedContract?.opportunityId);
  
  // Dynamic stateful tracking of documents
  const [docsList, setDocsList] = useState<any[]>([]);

  React.useEffect(() => {
    if (selectedContractId) {
      const currentContract = allContracts.find(c => c.id === selectedContractId);
      const initialDocs = currentContract?.opportunityId ? [
        { id: `doc-1-${selectedContractId}`, contractId: selectedContractId, name: 'Sözleşme Taslağı', status: 'PENDING', description: 'Satış Destek Birimi tarafından hazırlanacak ana taslak.' },
        { id: `doc-2-${selectedContractId}`, contractId: selectedContractId, name: 'Maliyet Analizi (Onaylı)', status: 'APPROVED', description: 'Sistemden otomatik aktarıldı.' },
        { id: `doc-3-${selectedContractId}`, contractId: selectedContractId, name: 'İmza Sirküleri', status: 'PENDING', description: 'Satış Destek tarafından temin edilecek imza beyannamesi.' },
        { id: `doc-4-${selectedContractId}`, contractId: selectedContractId, name: 'Ticaret Sicil Gazetesi', status: 'PENDING', description: 'Satış Destek tarafından arşivden/sistemden alınacak.' },
        { id: `doc-5-${selectedContractId}`, contractId: selectedContractId, name: 'SGK Borcu Yoktur', status: 'PENDING', description: 'Satış Destek tarafından e-devlet/SGK üzerinden temin edilecek.' }
      ] : MOCK_CONTRACT_DOCS.filter(doc => doc.contractId === selectedContractId).map(doc => ({
        id: doc.id,
        contractId: doc.contractId,
        name: (doc as any).name || 'Gerekli Evrak',
        status: doc.status === 'VERIFIED' ? 'APPROVED' : doc.status,
        description: (doc as any).description || 'Sözleşme için idari evrak.'
      }));
      setDocsList(initialDocs);
    } else {
      setDocsList([]);
    }
  }, [selectedContractId]);

  const handleToggleDocStatus = (docId: string) => {
    setDocsList(prev => prev.map(doc => {
      if (doc.id === docId) {
        return { ...doc, status: doc.status === 'APPROVED' ? 'PENDING' : 'APPROVED' };
      }
      return doc;
    }));
  };

  const allDocsApproved = docsList.length > 0 && docsList.every(d => d.status === 'APPROVED');

  const targetName = project?.name || opportunity?.title || 'Bilinmeyen';

  const handleSignAndTransfer = async () => {
    if (!selectedContract || !pmToAssign) return;
    
    setIsHandingOff(true);
    
    // 1. Update contract status
    const updatedContract = { ...selectedContract, status: 'SIGNED' as const, signedDate: new Date().toISOString().split('T')[0] };
    
    if (selectedContract.opportunityId && !contracts.find(c => c.id === selectedContract.id)) {
      setContracts([...contracts, updatedContract]);
    } else {
      setContracts(contracts.map(c => c.id === selectedContract.id ? updatedContract : c));
    }

    // 2. Create a new project
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: targetName,
      customerId: opportunity?.customerId || project?.customerId || 'c1',
      status: 'NOT_STARTED',
      totalValue: opportunity?.value || 0,
      avgMargin: 15,
      deadline: updatedContract.endDate || '2027-12-31',
      ownerId: 'cmp5lhehc000259w33zxhyy0p',
      managerId: pmToAssign,
      progress: 0,
      opportunityId: opportunity?.id
    };
    setProjects([...projects, newProject]);

    // 3. TRIGGER WORKFLOW HAND-OFF
    const pmUser = MOCK_SYSTEM_USERS.find(u => u.id === pmToAssign);
    await workflowService.triggerHandOff({
      itemId: newProject.id,
      itemTitle: newProject.name,
      fromUnit: 'SALES_SUPPORT',
      toUnit: 'PROJECT_MANAGEMENT',
      fromUser: currentUser,
      toUser: pmUser || currentUser,
      note: `Sözleşme imzalandı. Proje ${pmUser?.name} yöneticisine devredildi. Satın Alma süreci başlatılabilir.`
    });

    // Also notify Procurement
    const procurementUser = MOCK_SYSTEM_USERS.find(u => u.role === 'PROCUREMENT_MGR');
    if (procurementUser) {
      await workflowService.triggerHandOff({
        itemId: newProject.id,
        itemTitle: newProject.name,
        fromUnit: 'SALES_SUPPORT',
        toUnit: 'PROCUREMENT',
        fromUser: currentUser,
        toUser: procurementUser,
        note: `Yeni proje imzalandı. Satın Alma kalemleri onayınıza düşmüştür.`
      });
    }

    setIsHandingOff(false);
    setSelectedContractId(null); 

    // 4. Create parallel tasks for Project Management and Procurement
    const pmTask: TodoTask = {
      id: `task-pm-${Date.now()}`,
      title: `${targetName} - Proje Başlatma Planı (PM)`,
      description: `Sözleşme evrakları tamamlandı. Proje planı hazırlanmalı, PM süreci aktive edilmelidir.`,
      unitId: 'u4', // PM / İdari
      assignedBy: currentUser?.id || 'cmp5lhehc000259w33zxhyy0p',
      priority: 'HIGH',
      status: 'PENDING',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      relatedModule: 'PROJECT',
      relatedItemId: newProject.id
    };

    const procurementTask: TodoTask = {
      id: `task-proc-${Date.now()}`,
      title: `${targetName} - BoM Satınalma Başlatma`,
      description: `Sözleşme evrakları tamamlandı. Projenin BoM listesindeki donanım/lisans tedarik süreci başlatılmalıdır.`,
      unitId: 'u3', // Procurement / Satınalma
      assignedBy: currentUser?.id || 'cmp5lhehc000259w33zxhyy0p',
      priority: 'HIGH',
      status: 'PENDING',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      relatedModule: 'PROCUREMENT',
      relatedItemId: newProject.id
    };

    if (setTasks && tasks) {
      setTasks([...tasks, pmTask, procurementTask]);
    }

    alert('Sözleşme imzalandı, Proje oluşturuldu. Proje Yönetimi ve Satınalma birimlerine paralel işler atandı!');
  };

  const handleCreateDocReq = () => {
    setShowNewDocReqModal(false);
    setNewDocReq({ name: '', description: '', dueDate: '' });
  };

  if (!selectedContractId) {
    return (
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Sözleşmelerim</h3>
            <p className="text-slate-500">Aktif sözleşmeler ve geçerlilik süreleri.</p>
          </div>
        </div>

        <div className="glass-panel rounded-3xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">Sözleşme / Proje Adı</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">Durum</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">İmza Tarihi</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">Geçerlilik Süresi (Bitiş)</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allContracts.map(c => {
                const p = MOCK_PROJECTS.find(proj => proj.id === c.projectId);
                const o = opportunities.find(opp => opp.id === c.opportunityId);
                const name = p?.name || o?.title || c.id;
                return (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{name}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider",
                        c.status === 'SIGNED' ? "bg-emerald-100 text-emerald-700" : 
                        c.status === 'DRAFT' ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700"
                      )}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{c.signedDate || '-'}</td>
                    <td className="px-6 py-4 font-bold text-slate-700">{c.endDate || c.guaranteeExpiry || 'Belirtilmedi'}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedContractId(c.id)}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-bold"
                      >
                        Detay & İşlem
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Sözleşme Detayı</h3>
          <p className="text-slate-500">Kazanılan projelerin sözleşme süreçleri.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setSelectedContractId(null)}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
          >
            Listeye Dön
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <FileSignature size={20} className="text-indigo-600" />
                Sözleşme Evrakları Listesi
              </h4>
              <PermissionGate permission="CONTRACTS_EDIT">
                <button onClick={() => setShowNewDocReqModal(true)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                  <Plus size={14} /> Yeni Talep
                </button>
              </PermissionGate>
            </div>
            <div className="p-4 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold leading-relaxed px-6">
              📌 Bu evrakların toplanması ve doğrulanması için <strong className="text-indigo-900">Satış Destek Birimi</strong> görevlendirilmiştir. 
              Sözleşmenin imzalanıp devredilebilmesi için tüm evrakların onaylanması gerekmektedir.
            </div>
            <div className="divide-y divide-slate-100">
              {docsList.map((doc) => (
                <div key={doc.id} className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-900 text-sm">{doc.name}</h5>
                      <p className="text-xs text-slate-500">{doc.description || 'Gerekli evrak.'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider",
                      doc.status === 'APPROVED' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {doc.status}
                    </span>
                    <button
                      onClick={() => handleToggleDocStatus(doc.id)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                        doc.status === 'APPROVED' ? "bg-amber-50 text-amber-600 hover:bg-amber-100" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                      )}
                    >
                      {doc.status === 'APPROVED' ? 'Beklet' : 'Onayla'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-3xl shadow-sm">
            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Gavel size={20} className="text-amber-600" />
              Teminat & Devir
            </h4>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Teminat Tutarı</p>
                <p className="text-xl font-bold text-slate-900">${selectedContract?.guaranteeAmount?.toLocaleString() || 0}</p>
              </div>
              <PermissionGate permission="CONTRACTS_EDIT">
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-2">Proje Yöneticisi Ata</p>
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 mb-4"
                    value={pmToAssign}
                    onChange={(e) => setPmToAssign(e.target.value)}
                  >
                    <option value="">Seçiniz</option>
                    {MOCK_SYSTEM_USERS.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                  <button 
                    onClick={handleSignAndTransfer}
                    disabled={!pmToAssign || isHandingOff || selectedContract?.status === 'SIGNED' || !allDocsApproved}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isHandingOff ? 'Aktarılıyor...' : <><FileSignature size={18} /> Sözleşmeyi İmzala & Devret</>}
                  </button>
                  {!allDocsApproved && selectedContract?.status !== 'SIGNED' && (
                    <p className="text-red-500 text-[10px] font-black text-center mt-3 uppercase tracking-wider leading-relaxed">
                      ⚠️ Tüm evraklar onaylanmadan devir yapılamaz! (Satış Destek evrak tamamlama süreci aktif)
                    </p>
                  )}
                </div>
              </PermissionGate>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractModule;
