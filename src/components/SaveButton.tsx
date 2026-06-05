import React from 'react';
import { Save, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface SaveButtonProps {
  onClick: () => void;
  loading?: boolean;
  label?: string;
  className?: string;
}

export const SaveButton = ({ onClick, loading, label = "Kaydet", className }: SaveButtonProps) => (
  <button 
    onClick={onClick}
    disabled={loading}
    className={cn(
      "bg-primary text-white px-8 py-3 rounded-2xl text-xs font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 uppercase tracking-widest active:scale-95 disabled:opacity-50",
      className
    )}
  >
    {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
    {label}
  </button>
);
