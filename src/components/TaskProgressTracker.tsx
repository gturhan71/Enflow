import React, { useState } from 'react';
import { Calendar, Briefcase, ListTodo, MessageSquare, Plus } from 'lucide-react';
import { TodoTask } from '../types';
import { MOCK_UNITS } from '../constants';
import { cn } from '../lib/utils';

interface Props {
  tasks: TodoTask[];
  setTasks: React.Dispatch<React.SetStateAction<TodoTask[]>>;
  relatedModule: string;
  relatedItemId: string;
}

export const TaskProgressTracker: React.FC<Props> = ({ tasks, setTasks, relatedModule, relatedItemId }) => {
  const relatedTasks = tasks.filter(t => t.relatedModule === relatedModule && t.relatedItemId === relatedItemId);
  const [newNote, setNewNote] = useState<{ [taskId: string]: string }>({});

  const handleStatusChange = (taskId: string, status: TodoTask['status']) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status } : t));
  };

  const handleAddNote = (taskId: string) => {
    const noteText = newNote[taskId];
    if (!noteText?.trim()) return;

    const note = {
      date: new Date().toISOString().split('T')[0],
      note: noteText,
      author: 'Mevcut Kullanıcı' // Mock user
    };

    setTasks(tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          progressNotes: [...(t.progressNotes || []), note]
        };
      }
      return t;
    }));

    setNewNote({ ...newNote, [taskId]: '' });
  };

  if (relatedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
        <ListTodo size={32} className="mb-2 opacity-20" />
        <p className="text-sm font-medium">Bu kayda ait iş emri bulunmuyor.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {relatedTasks.map(task => (
        <div key={task.id} className="p-4 rounded-2xl glass-card flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <h5 className="font-bold text-slate-900">{task.title}</h5>
              <p className="text-xs text-slate-500 mt-1">{task.description}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Calendar size={12} /> Termin: {task.dueDate}
                </span>
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Briefcase size={12} /> {MOCK_UNITS.find(u => u.id === task.unitId)?.name}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(task.id, e.target.value as TodoTask['status'])}
                className={cn(
                  "text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wide outline-none border-r-8 border-transparent cursor-pointer",
                  task.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-700" :
                  task.status === 'IN_PROGRESS' ? "bg-amber-100 text-amber-700" :
                  task.status === 'CANCELLED' ? "bg-slate-200 text-slate-700" : "bg-blue-100 text-blue-700"
                )}
              >
                <option value="PENDING">Bekliyor</option>
                <option value="IN_PROGRESS">Devam Ediyor</option>
                <option value="COMPLETED">Tamamlandı</option>
                <option value="CANCELLED">İptal</option>
              </select>
            </div>
          </div>

          {/* Progress Notes Section */}
          <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-3">
            <h6 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <MessageSquare size={14} /> İlerleme Raporları
            </h6>
            
            {task.progressNotes && task.progressNotes.length > 0 ? (
              <div className="space-y-2">
                {task.progressNotes.map((note, idx) => (
                  <div key={idx} className="bg-slate-50 p-3 rounded-lg text-xs">
                    <p className="text-slate-700">{note.note}</p>
                    <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400 font-bold">
                      <span>{note.author}</span>
                      <span>{note.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Henüz bir ilerleme raporu girilmemiş.</p>
            )}

            <div className="flex gap-2 mt-2">
              <input
                type="text"
                placeholder="İlerleme durumu veya rapor notu ekle..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500"
                value={newNote[task.id] || ''}
                onChange={(e) => setNewNote({ ...newNote, [task.id]: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote(task.id)}
              />
              <button
                onClick={() => handleAddNote(task.id)}
                className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1"
              >
                <Plus size={14} /> Ekle
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
