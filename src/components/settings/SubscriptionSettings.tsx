import React from 'react';
import { Subscription, UsageMetric, User } from '../../types';

interface SubscriptionSettingsProps {
  subscription: Subscription | null;
  usage: UsageMetric[];
  currentUser: User;
}

export const SubscriptionSettings = ({
  subscription,
  usage,
  currentUser,
}: SubscriptionSettingsProps) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h4 className="text-xl font-bold text-slate-900">Abonelik & Kullanım</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-3xl bg-white border border-slate-100 shadow-sm">
          <h5 className="font-bold text-slate-900 mb-2 font-sans">Mevcut Plan</h5>
          <p className="text-3xl font-black text-primary mb-2">{subscription?.plan || 'STARTER'}</p>
          {(() => {
            const sub = subscription as (Subscription & { licenseModel?: string | null; licenseExpiryDate?: string | null }) | null;
            if (!sub) return null;
            const exp = sub.licenseExpiryDate ? new Date(sub.licenseExpiryDate) : null;
            const daysLeft = exp ? Math.ceil((exp.getTime() - Date.now()) / 86400000) : null;
            if (sub.licenseModel === 'TRIAL') {
              const expired = daysLeft !== null && daysLeft <= 0;
              return (
                <div className={`mb-4 px-3 py-2 rounded-xl text-xs font-bold ${expired ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  {expired ? '⚠ Deneme süresi doldu — lütfen lisans girin.' : `Deneme sürümü — kalan ${daysLeft} gün`}
                </div>
              );
            }
            if (exp && daysLeft !== null) {
              return <div className="mb-4 text-xs font-bold text-slate-500">Lisans bitiş: {exp.toLocaleDateString('tr-TR')} ({daysLeft} gün)</div>;
            }
            return null;
          })()}

          {currentUser?.role === 'GENERAL_MANAGER' && (
            <p className="text-xs text-slate-500 font-medium bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
              Plan doğrudan değiştirilemez — lisansınıza bağlıdır. Yükseltmek için Ayarlar → Lisans Planları'ndan yeni bir lisans anahtarı aktive edin.
            </p>
          )}
        </div>
        <div className="glass-panel p-6 rounded-3xl bg-white border border-slate-100 shadow-sm">
          <h5 className="font-bold text-slate-900 mb-2">Aylık Kullanım</h5>
          {usage.length > 0 ? usage.map((u) => (
            <div key={u.id} className="flex justify-between text-sm py-1 border-b border-slate-50 last:border-0 font-sans">
              <span className="text-slate-500 font-medium">{u.type}</span>
              <span className="font-bold text-slate-800">{u.count}</span>
            </div>
          )) : (
            <p className="text-sm text-slate-400 italic">Henüz kullanım verisi yok.</p>
          )}
        </div>
      </div>
    </div>
  );
};
