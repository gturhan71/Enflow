import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, User, Clock, AlertCircle, ChevronRight, Play, Pause, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { Workflow, ApprovalStage } from '../types';

interface SimulationStep {
  id: string;
  title: string;
  unit: string;
  assignee: string;
  role: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approver?: string;
  note?: string;
}

const MOCK_SIMULATION: SimulationStep[] = [
  { id: '1', title: 'CRM & Fırsat Oluşturma', unit: 'Satış', assignee: 'Ali Veli', role: 'Satış Temsilcisi', status: 'APPROVED', approver: 'Ali Veli' },
  { id: '2', title: 'Presales Analizi', unit: 'Teknik', assignee: 'Göktuğ Turhan', role: 'Presales Mühendisi', status: 'APPROVED', approver: 'Göktuğ Turhan' },
  { id: '3', title: 'Maliyet & Marj Onayı', unit: 'Yönetim', assignee: 'Gökhan Turhan', role: 'Genel Müdür', status: 'PENDING' },
  { id: '4', title: 'Sözleşme & İmza', unit: 'Hukuk', assignee: 'Zeynep Avukat', role: 'Hukuk Danışmanı', status: 'PENDING' },
];

export const WorkflowSimulation: React.FC = () => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  useEffect(() => {
    if (isAutoPlaying) {
      const timer = setInterval(() => {
        setCurrentStepIndex(prev => (prev < MOCK_SIMULATION.length - 1 ? prev + 1 : 0));
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [isAutoPlaying]);

  return (
    <div className="glass-panel p-8 rounded-[32px] bg-white border border-slate-100 shadow-xl space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black uppercase italic tracking-tighter">İş Akışı Onay Simülasyonu</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsAutoPlaying(!isAutoPlaying)} 
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all",
              isAutoPlaying ? "bg-amber-500 text-white" : "bg-primary text-white"
            )}
          >
            {isAutoPlaying ? <Pause size={14}/> : <Play size={14}/>} 
            {isAutoPlaying ? 'Süreci Duraklat' : 'Adım Adım Başlat'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {MOCK_SIMULATION.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isCompleted = index < currentStepIndex;

          return (
            <motion.div 
              key={step.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-6 rounded-2xl border-2 transition-all duration-300",
                isActive ? "border-primary bg-primary/5 scale-[1.02] shadow-lg" : 
                isCompleted ? "border-emerald-200 bg-emerald-50/30" : "border-slate-100 bg-white"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center font-black text-sm",
                    isActive ? "bg-primary text-white shadow-lg" : 
                    isCompleted ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                  )}>
                    {isCompleted ? <CheckCircle2 size={24}/> : index + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{step.title}</h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Birim: <span className="font-bold text-slate-700">{step.unit}</span> • 
                      Sorumlu: <span className="font-bold text-slate-700">{step.assignee}</span> ({step.role})
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full",
                    isActive ? "bg-primary text-white" : 
                    isCompleted ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                  )}>
                    {isActive ? 'Aktif İşlem' : isCompleted ? 'Onaylandı' : 'Beklemede'}
                  </span>
                  {step.approver && (
                    <p className="text-[10px] text-slate-400 mt-1 font-bold">
                      {isCompleted ? `Onaylayan: ${step.approver}` : 'Henüz onaylanmadı'}
                    </p>
                  )}
                </div>
              </div>
              
              {isActive && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="mt-4 pt-4 border-t border-primary/20 text-xs text-slate-600 font-medium"
                >
                  <p><strong>Açıklama:</strong> {MOCK_SIMULATION[currentStepIndex].role} şu an bu adımı işliyor. Onay beklendiği için sistem kilitli durumda.</p>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
