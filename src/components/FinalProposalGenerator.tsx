import React, { useState, useEffect } from 'react';
import { workflowService } from '../services/workflowService';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, Loader2, FileText } from 'lucide-react';

interface Props {
  entityId: string;
  onFinalized: () => void;
}

export const FinalProposalGenerator: React.FC<Props> = ({ entityId, onFinalized }) => {
  const [chain, setChain] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setChain(workflowService.getChainForEntity(entityId));
  }, [entityId]);

  const handleApprove = async (stageId: string) => {
    setLoading(true);
    // Assuming currentUser is 'admin' for demo purposes
    const updatedChain = workflowService.approveStage(entityId, stageId, 'user_admin', 'Onaylandı.');
    setChain(updatedChain);
    setLoading(false);
  };

  if (!chain) return <div className="p-4 text-sm text-slate-500">Onay süreci henüz başlatılmamış.</div>;

  return (
    <div className="glass-panel p-6 rounded-2xl bg-white space-y-4">
      <h3 className="font-bold text-lg">Yönetici Onay Paneli</h3>
      <div className="space-y-2">
        {chain.stages.map((stage: any) => (
          <div key={stage.id} className="flex justify-between items-center p-3 border rounded-lg">
            <span>{stage.role}</span>
            {stage.status === 'APPROVED' ? (
              <span className="text-emerald-500 flex items-center gap-1 font-bold text-xs"><CheckCircle2 size={14}/> Onaylandı</span>
            ) : (
              <button 
                onClick={() => handleApprove(stage.id)}
                disabled={loading}
                className="bg-primary text-white px-3 py-1 rounded text-xs font-bold"
              >
                Onayla
              </button>
            )}
          </div>
        ))}
      </div>
      
      {chain.status === 'COMPLETED' ? (
        <button 
          onClick={onFinalized}
          className="w-full mt-4 bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
        >
          <FileText size={18} /> PDF Oluştur & Gönder
        </button>
      ) : (
        <div className="text-xs text-amber-600 font-bold mt-4">Tüm onaylar tamamlanmalıdır.</div>
      )}
    </div>
  );
};
