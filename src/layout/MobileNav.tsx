import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  ListTodo, 
  FileSignature,
  CreditCard
} from 'lucide-react';
import { cn } from '../lib/utils';

const MobileNav = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (id: string) => void }) => {
  const items = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Panel' },
    { id: 'crm', icon: Users, label: 'CRM' },
    { id: 'todo', icon: ListTodo, label: 'Görevler' },
    { id: 'contract', icon: FileSignature, label: 'Sözleşme' },
    { id: 'subscription', icon: CreditCard, label: 'Lisans' }
  ];

  return (
    <div className="lg:hidden fixed bottom-6 left-6 right-6 z-50">
      <div className="glass-panel rounded-[32px] p-2 flex items-center justify-between shadow-2xl">
        {items.map((item) => {
          const isActive = activeTab === item.id || (item.id === 'crm' && activeTab.startsWith('crm-'));
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-center gap-1 flex-1 py-3 transition-all relative",
                isActive ? "text-primary" : "text-white/70"
              )}
            >
              <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} className={cn(
                "transition-transform",
                isActive && "scale-110"
              )} />
              <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
              {isActive && (
                <div className="absolute -top-1 w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_rgba(0,245,155,1)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileNav;
