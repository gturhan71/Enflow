import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, User, GitBranch } from 'lucide-react';

interface HandOffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { toUnit: string; toUser: { id: string; name: string }; note: string }) => void;
  itemTitle: string;
}

// Mock units and users for selection
const MOCK_UNITS = [{ id: 'unit_sales', name: 'Satış' }, { id: 'unit_technical', name: 'Teknik' }, { id: 'unit_procurement', name: 'Satın Alma' }];
const MOCK_USERS = [{ id: 'user_1', name: 'Ahmet Yılmaz' }, { id: 'user_2', name: 'Ayşe Demir' }];

export const HandOffModal: React.FC<HandOffModalProps> = ({ isOpen, onClose, onConfirm, itemTitle }) => {
  const [toUnit, setToUnit] = useState(MOCK_UNITS[0].id);
  const [toUser, setToUser] = useState(MOCK_USERS[0]);
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-panel w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h4 className="text-xl font-bold text-white italic uppercase tracking-tighter">İş Akışı Aktarımı</h4>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white">
            <X size={20} />
          </button>
        </div>
        <div className="p-8 space-y-6">
          <p className="text-sm text-slate-400">
            <span className="font-bold text-white">{itemTitle}</span> projesini aşağıdaki birime ve personele aktarmak üzeresiniz.
          </p>
          <div className="space-y-4">
            <select 
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white outline-none focus:border-primary"
              onChange={(e) => setToUnit(e.target.value)}
              value={toUnit}
            >
              {MOCK_UNITS.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select 
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white outline-none focus:border-primary"
              onChange={(e) => setToUser(MOCK_USERS.find(u => u.id === e.target.value) || MOCK_USERS[0])}
              value={toUser.id}
            >
              {MOCK_USERS.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <textarea 
              rows={3}
              placeholder="Aktarım notu..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white outline-none focus:border-primary resize-none"
              onChange={(e) => setNote(e.target.value)}
              value={note}
            />
          </div>
        </div>
        <div className="p-6 bg-white/5 border-t border-white/10 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-400 hover:text-white">İptal</button>
          <button 
            onClick={() => onConfirm({ toUnit, toUser, note })}
            className="px-8 py-2 bg-primary text-white rounded-xl text-sm font-bold shadow-lg hover:bg-primary/90 transition-all flex items-center gap-2"
          >
            Aktar <ArrowRight size={16} />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
