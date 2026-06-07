import React, { useState, useEffect } from 'react';
import { Unit, User } from '../types';
import IntegrationWizard from './IntegrationWizard';
import WorkflowBuilder from './WorkflowBuilder';
import { TenantSettings } from '../components/settings/TenantSettings';
import { UnitManagement } from '../components/settings/UnitManagement';
import { UserManagement } from '../components/settings/UserManagement';
import { SubscriptionSettings } from '../components/settings/SubscriptionSettings';
import { PermissionSettings } from '../components/settings/PermissionSettings';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';

interface SettingsModuleProps {
  companyLogo: string | null;
  setCompanyLogo: (logo: string | null) => void;
  activeSubTab?: string;
  units: Unit[];
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  activeTenantId: string;
  setActiveTenantId: (id: string) => void;
}

const SettingsModule = ({
  companyLogo,
  setCompanyLogo,
  activeSubTab = 'company',
  units,
  setUnits,
  users,
  setUsers,
  activeTenantId,
  setActiveTenantId
}: SettingsModuleProps) => {
  const { currentUser } = useAuth();
  const [tenants, setTenants] = useState<any[]>([]);
  const [newTenantName, setNewTenantName] = useState('');
  const [subscription, setSubscription] = useState<any>(null);
  const [usage, setUsage] = useState<any[]>([]);

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'subscription') {
      fetchSubscriptionData();
    }
  }, [activeSubTab]);

  const fetchSubscriptionData = async () => {
    try {
      const [sub, use] = await Promise.all([
        apiService.getSubscription(),
        apiService.getUsage()
      ]);
      setSubscription(sub);
      setUsage(use);
    } catch (err) {
      console.error('Abonelik verileri yüklenemedi');
    }
  };

  const fetchTenants = async () => {
    try {
      const data = await apiService.getTenants();
      setTenants(data);
    } catch (err) {
      console.error('Şirketler yüklenemedi');
    }
  };

  const handleCreateTenant = async () => {
    if (!newTenantName) return;
    try {
      const tenant = await apiService.createTenant({ name: newTenantName });
      setTenants(prev => [...prev, tenant]);
      setNewTenantName('');
      alert('Şirket başarıyla tanımlandı.');
    } catch (err: any) {
      console.error('Tenant creation error:', err);
      alert('Şirket oluşturulamadı: ' + (err.message || 'Bilinmeyen hata'));
    }
  };

  const renderContent = () => {
    switch (activeSubTab) {
      case 'company':
        return (
          <TenantSettings
            companyLogo={companyLogo}
            setCompanyLogo={setCompanyLogo}
            activeTenantId={activeTenantId}
            setActiveTenantId={setActiveTenantId}
            tenants={tenants}
            newTenantName={newTenantName}
            setNewTenantName={setNewTenantName}
            handleCreateTenant={handleCreateTenant}
          />
        );
      case 'units':
        return (
          <UnitManagement
            units={units}
            setUnits={setUnits}
            activeTenantId={activeTenantId}
            users={users}
          />
        );
      case 'users':
        return (
          <UserManagement
            users={users}
            setUsers={setUsers}
            units={units}
            tenants={tenants}
            activeTenantId={activeTenantId}
            currentUser={currentUser}
          />
        );
      case 'subscription':
        return (
          <SubscriptionSettings
            subscription={subscription}
            usage={usage}
            currentUser={currentUser}
            fetchSubscriptionData={fetchSubscriptionData}
          />
        );
      case 'workflow':
        return <WorkflowBuilder units={units} />;
      case 'integrations':
        return (
          <div className="space-y-6">
            <div>
              <h4 className="text-xl font-bold text-slate-900">Entegrasyon Yönetimi</h4>
              <p className="text-sm text-slate-500 mb-6">T-Ecosystem modülleri ve harici servis bağlantılarını yapılandırın.</p>
            </div>
            <IntegrationWizard
              ncConfig={{ url: '', username: '', appPassword: '' }}
              setNcConfig={() => { }}
              exConfig={{ server: '', email: '', password: '' }}
              setExConfig={() => { }}
              waConfig={{ apiKey: '', phoneNumber: '' }}
              setWaConfig={() => { }}
            />
          </div>
        );
      case 'permissions':
        return (
          <PermissionSettings
            users={users}
            setUsers={setUsers}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 font-sans">Sistem Yapılandırması</h3>
          <p className="text-slate-500">Organizasyon yapısı, kullanıcılar ve birim bazlı yetkilendirme.</p>
        </div>
      </div>
      <div className="flex-1">
        {renderContent()}
      </div>
    </div>
  );
};

export default SettingsModule;
