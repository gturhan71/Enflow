import React from 'react';
import { apiService } from '../../services/apiService';

interface SubscriptionSettingsProps {
  subscription: any;
  usage: any[];
  currentUser: any;
  fetchSubscriptionData: () => void;
}

export const SubscriptionSettings = ({
  subscription,
  usage,
  currentUser,
  fetchSubscriptionData
}: SubscriptionSettingsProps) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h4 className="text-xl font-bold text-slate-900">Abonelik & Kullanım</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-3xl bg-white border border-slate-100 shadow-sm">
          <h5 className="font-bold text-slate-900 mb-2 font-sans">Mevcut Plan</h5>
          <p className="text-3xl font-black text-primary mb-4">{subscription?.plan || 'STARTER'}</p>

          {currentUser?.role === 'GENERAL_MANAGER' && (
            <div className="space-y-2">
              <select
                onChange={async (e) => {
                  try {
                    await apiService.updateTenantSubscription(currentUser.tenantId, e.target.value);
                    fetchSubscriptionData();
                    alert('Plan güncellendi.');
                  } catch (err) {
                    alert('Plan güncellenemedi.');
                  }
                }}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:border-primary"
                value={subscription?.plan || 'STARTER'}
              >
                <option value="STARTER">STARTER</option>
                <option value="PROFESSIONAL">PROFESSIONAL</option>
                <option value="ENTERPRISE">ENTERPRISE</option>
              </select>
            </div>
          )}
        </div>
        <div className="glass-panel p-6 rounded-3xl bg-white border border-slate-100 shadow-sm">
          <h5 className="font-bold text-slate-900 mb-2">Aylık Kullanım</h5>
          {usage.length > 0 ? usage.map((u: any) => (
            <div key={u.feature} className="flex justify-between text-sm py-1 border-b border-slate-50 last:border-0 font-sans">
              <span className="text-slate-500 font-medium">{u.feature}</span>
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
