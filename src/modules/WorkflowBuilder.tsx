import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  GitBranch, 
  ArrowRight, 
  Plus, 
  Trash2, 
  Settings2, 
  Activity,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Unit } from '../types';

interface WorkflowStep {
  id: string;
  unitId: string;
  nextStepId: string | null;
  type: 'AUTO' | 'MANUAL';
  description: string;
}

const WorkflowBuilder = ({ units }: { units: Unit[] }) => {
  const [steps, setSteps] = useState<WorkflowStep[]>([
    { id: '1', unitId: units[0]?.id || 'u1', nextStepId: '2', type: 'AUTO', description: 'Şartname Analizi' },
    { id: '2', unitId: units[1]?.id || 'u2', nextStepId: null, type: 'MANUAL', description: 'Maliyetlendirme' },
  ]);

  const addStep = () => {
    const newId = (steps.length + 1).toString();
    const lastStep = steps[steps.length - 1];
    
    if (lastStep) {
      const updatedSteps = steps.map(s => s.id === lastStep.id ? { ...s, nextStepId: newId } : s);
      setSteps([...updatedSteps, { id: newId, unitId: units[0]?.id, nextStepId: null, type: 'AUTO', description: 'Yeni Adım' }]);
    } else {
      setSteps([{ id: newId, unitId: units[0]?.id, nextStepId: null, type: 'AUTO', description: 'Başlangıç Adımı' }]);
    }
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id).map(s => {
      if (s.nextStepId === id) return { ...s, nextStepId: null };
      return s;
    }));
  };

  const updateStep = (id: string, data: Partial<WorkflowStep>) => {
    setSteps(steps.map(s => s.id === id ? { ...s, ...data } : s));
  };

  return (
    <div className="space-y-8 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xl font-bold text-slate-900">Operasyonel İş Akışı</h4>
          <p className="text-sm text-slate-500">Birimler arası otomatik iş devir kurallarını tasarlayın.</p>
        </div>
        <button 
          onClick={addStep}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
        >
          <Plus size={20} /> Yeni Akış Adımı
        </button>
      </div>

      <div className="relative flex flex-wrap gap-12 items-start pt-12 pb-24">
        {steps.map((step, index) => {
          const unit = units.find(u => u.id === step.unitId);
          return (
            <React.Fragment key={step.id}>
              <motion.div 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative group"
              >
                <div className="w-72 glass-panel p-6 rounded-[32px] bg-white border border-slate-100 shadow-xl shadow-slate-100/50 hover:border-indigo-400 transition-all">
                  {/* Step Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                      <span className="font-black text-sm">{index + 1}</span>
                    </div>
                    <button 
                      onClick={() => removeStep(step.id)}
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Step Body */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Birim</label>
                      <select 
                        value={step.unitId}
                        onChange={(e) => updateStep(step.id, { unitId: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">İşlem Tanımı</label>
                      <input 
                        type="text" 
                        value={step.description}
                        onChange={(e) => updateStep(step.id, { description: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <Activity size={12} />
                        {step.type === 'AUTO' ? 'OTOMATİK DEVİR' : 'MANUEL ONAY'}
                      </span>
                      <button 
                        onClick={() => updateStep(step.id, { type: step.type === 'AUTO' ? 'MANUAL' : 'AUTO' })}
                        className="text-[10px] text-indigo-600 font-bold hover:underline"
                      >
                        Değiştir
                      </button>
                    </div>
                  </div>
                </div>

                {/* Connection Line */}
                {step.nextStepId && (
                  <div className="absolute top-1/2 -right-12 translate-y-1/2 w-12 h-px bg-slate-200 hidden lg:block">
                    <div className="absolute -right-1 -top-1">
                      <ArrowRight size={10} className="text-slate-300" />
                    </div>
                  </div>
                )}
              </motion.div>
            </React.Fragment>
          );
        })}

        {steps.length === 0 && (
          <div className="w-full py-20 text-center text-slate-400 flex flex-col items-center border-2 border-dashed border-slate-100 rounded-[40px]">
            <GitBranch size={48} className="mb-4 opacity-10" />
            <p className="font-medium">Henüz bir iş akışı tanımlanmadı.</p>
            <button onClick={addStep} className="mt-4 text-indigo-600 font-bold text-sm hover:underline">İlk adımı ekle</button>
          </div>
        )}
      </div>

      {/* Workflow Summary */}
      <div className="bg-slate-900 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full" />
        <div className="relative z-10">
          <h5 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Settings2 size={20} className="text-indigo-400" />
            Akış Simülasyonu
          </h5>
          <div className="flex flex-wrap items-center gap-3">
            {steps.map((s, i) => (
              <React.Fragment key={s.id}>
                <div className="px-4 py-2 bg-white/10 rounded-xl border border-white/5 backdrop-blur-md">
                  <p className="text-[10px] text-indigo-300 font-bold uppercase">{units.find(u => u.id === s.unitId)?.name}</p>
                  <p className="text-xs font-medium text-white">{s.description}</p>
                </div>
                {i < steps.length - 1 && <ArrowRight size={16} className="text-white/20" />}
              </React.Fragment>
            ))}
          </div>
          <div className="mt-8 pt-8 border-t border-white/10 flex items-start gap-4">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl"><CheckCircle2 size={20} /></div>
            <div>
              <p className="text-sm font-bold text-emerald-400">Akış Geçerli</p>
              <p className="text-xs text-slate-400 mt-1">Tanımlanan adımlar arası geçişlerde ilgili personellere otomatik WhatsApp ve Email bildirimleri tanımlandı.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowBuilder;
