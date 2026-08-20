import { Search, FileSpreadsheet, Plus, Building, Mail, Phone, MapPin, Trophy, AlertTriangle, BarChart2, ChevronRight, Users, GitBranch, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { Customer, CustomerHealthReport } from '../../types';
import { CustomerHealthCard } from '../../components/HealthCards';
import { PermissionGate } from '../../components/PermissionGate';
import InfoTooltip from '../../components/InfoTooltip';
import { CustomerStats } from './helpers';

export default function CustomersView({
  filteredCustomers, totalCount, searchQuery, setSearchQuery, customerHealth, customersById,
  onImport, onNewCustomer, getStats, onOpenReport, onOpenContacts, onEditCustomer, onDeleteCustomer, canDeleteCustomer,
}: {
  filteredCustomers: Customer[];
  totalCount: number;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  customerHealth: CustomerHealthReport | null;
  customersById: Map<string, Customer>;
  onImport: () => void;
  onNewCustomer: () => void;
  getStats: (customerId: string) => CustomerStats;
  onOpenReport: (customer: Customer) => void;
  onOpenContacts: (customer: Customer) => void;
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customer: Customer) => void;
  canDeleteCustomer: boolean;
}) {
  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 custom-scrollbar min-h-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Müşteriler</h3>
          <p className="text-slate-400 text-sm font-medium mt-1">{totalCount} kayıtlı müşteri</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Müşteri ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-56"
            />
          </div>
          <PermissionGate permission="CRM_EDIT">
            <button
              onClick={onImport}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-3 rounded-2xl text-xs font-black hover:bg-slate-50 transition-all active:scale-95"
            >
              <FileSpreadsheet size={15} /> Excel'den Aktar
            </button>
            <button
              onClick={onNewCustomer}
              className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl text-xs font-black shadow-lg hover:bg-primary/90 transition-all active:scale-95"
            >
              <Plus size={16} /> Yeni Müşteri Ekle
            </button>
          </PermissionGate>
        </div>
      </div>

      {customerHealth && customerHealth.summary.total > 0 && <CustomerHealthCard c={customerHealth} className="" />}

      {filteredCustomers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <Building size={48} className="mb-4 opacity-30" />
          <p className="font-black text-sm uppercase tracking-widest">Müşteri bulunamadı</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCustomers.map(customer => {
          const children = [...customersById.values()].filter(c => c.parentId === customer.id);
          return (
            <motion.div
              layout
              key={customer.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-7 rounded-[28px] hover:shadow-xl transition-all group border border-white/60 bg-gradient-to-br from-white/80 to-white/40"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Building size={22} className="text-primary" />
                </div>
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border",
                  customer.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                )}>
                  {customer.status === 'ACTIVE' ? 'Aktif' : 'Pasif'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <h4 className="font-black text-slate-900 text-base leading-snug">{customer.name}</h4>
                {(() => {
                  if (children.length === 0) return null;
                  return (
                    <span className="flex items-center gap-1 shrink-0">
                      <InfoTooltip text={children.map(c => c.name).join('\n')} />
                      <span className="text-[9px] font-black text-primary uppercase tracking-widest">{children.length} şube</span>
                    </span>
                  );
                })()}
              </div>
              {customer.parentId && customersById.get(customer.parentId) && (
                <p className="flex items-center gap-1 text-[10px] text-slate-400 font-bold mt-0.5">
                  <GitBranch size={10} /> {customersById.get(customer.parentId)!.name}
                </p>
              )}
              {customer.shortName && <p className="text-xs text-primary font-bold mt-0.5">{customer.shortName}</p>}
              {customer.industry && <p className="text-xs text-slate-500 font-medium mt-1">{customer.industry}</p>}
              <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-4">
                {customer.email && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Mail size={12} className="shrink-0" />{customer.email}
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Phone size={12} className="shrink-0" />{customer.phone}
                  </div>
                )}
                {customer.city && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <MapPin size={12} className="shrink-0" />{customer.city}{customer.country ? `, ${customer.country}` : ''}
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Kredi Limiti</span>
                <span className="font-black text-slate-700">
                  {customer.creditLimit?.toLocaleString('tr-TR')} {customer.currency}
                </span>
              </div>

              {/* Won / Lost Stats */}
              {(() => {
                const stats = getStats(customer.id);
                const hasAny = stats.wonOpps.length > 0 || stats.lostOpps.length > 0;
                return (
                  <button
                    onClick={() => onOpenReport(customer)}
                    className={cn(
                      "w-full mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-left group/stat",
                      hasAny ? "cursor-pointer hover:opacity-80 transition-opacity" : "cursor-default"
                    )}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-emerald-600">
                        <Trophy size={11} className="shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Kazanılan</span>
                      </div>
                      <p className="text-sm font-black text-slate-900">
                        {stats.wonOpps.length} <span className="text-[10px] font-medium text-slate-400">proje</span>
                      </p>
                      {stats.wonValue > 0 && (
                        <p className="text-[10px] font-bold text-emerald-600">
                          {stats.wonValue >= 1_000_000
                            ? `${(stats.wonValue / 1_000_000).toFixed(1)}M`
                            : stats.wonValue >= 1_000
                            ? `${(stats.wonValue / 1_000).toFixed(0)}K`
                            : stats.wonValue.toLocaleString('tr-TR')} {customer.currency}
                        </p>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-red-400">
                        <AlertTriangle size={11} className="shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Kaybedilen</span>
                      </div>
                      <p className="text-sm font-black text-slate-900">
                        {stats.lostOpps.length} <span className="text-[10px] font-medium text-slate-400">fırsat</span>
                      </p>
                      {stats.lostValue > 0 && (
                        <p className="text-[10px] font-bold text-red-400">
                          {stats.lostValue >= 1_000_000
                            ? `${(stats.lostValue / 1_000_000).toFixed(1)}M`
                            : stats.lostValue >= 1_000
                            ? `${(stats.lostValue / 1_000).toFixed(0)}K`
                            : stats.lostValue.toLocaleString('tr-TR')} {customer.currency}
                        </p>
                      )}
                    </div>
                    {hasAny && (
                      <div className="col-span-2 flex items-center justify-end gap-1 text-[9px] font-black text-primary uppercase tracking-widest opacity-0 group-hover/stat:opacity-100 transition-opacity">
                        <BarChart2 size={10} /> Detay Rapor <ChevronRight size={10} />
                      </div>
                    )}
                  </button>
                );
              })()}

              <button
                onClick={() => onOpenContacts(customer)}
                className="w-full mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 hover:text-primary transition-colors"
              >
                <span className="flex items-center gap-1.5 font-bold">
                  <Users size={12} /> Kişiler
                </span>
                <span className="font-black">{customer.contacts?.length || 0}</span>
              </button>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                <PermissionGate permission="CRM_EDIT">
                  <button
                    onClick={() => onEditCustomer(customer)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary hover:bg-primary/5 rounded-xl transition-colors"
                  >
                    <Pencil size={12} /> Düzenle
                  </button>
                </PermissionGate>
                {canDeleteCustomer && (
                  <button
                    onClick={() => onDeleteCustomer(customer)}
                    disabled={children.length > 0}
                    title={children.length > 0 ? 'Önce alt birimlerini silin veya taşıyın.' : undefined}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <Trash2 size={12} /> Sil
                  </button>
                )}
              </div>
            </motion.div>
          );
          })}
        </div>
      )}
    </div>
  );
}
