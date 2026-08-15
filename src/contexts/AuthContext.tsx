import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { apiService } from '../services/apiService';

// Kayıtlı kullanıcı yoksa (tutarsız durum) → İZİNSİZ misafir. ASLA GM'e düşme:
// eski davranış MOCK_SYSTEM_USERS[0] (GM superuser) idi ve her girişte tüm
// modülleri açıyordu. Misafir hiçbir izne sahip değil → boş arayüz (güvenli).
const guestUser = (tenantId: string): User => ({
  id: '', name: '', email: '', role: 'NONE', permissions: [], status: 'ACTIVE', tenantId,
});

interface AuthContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  hasPermission: (permission: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children, tenantId }: { children: ReactNode, tenantId: string }) => {
  const [currentUser, setCurrentUserState] = useState<User>(() => {
    const saved = localStorage.getItem(`enflow_current_user_${tenantId}`);
    return saved ? JSON.parse(saved) : guestUser(tenantId);
  });

  useEffect(() => {
    localStorage.setItem(`enflow_current_user_${tenantId}`, JSON.stringify(currentUser));
  }, [currentUser, tenantId]);

  // currentUser eskiden yalnız girişte localStorage'a yazılıp bir daha hiç
  // tazelenmiyordu — bir GM Yetkiler'den bu kullanıcının izinlerini/rolünü
  // değiştirse bile, oturum çıkış yapılmadan bu asla yansımıyordu. Uygulama
  // her açıldığında (sayfa yenileme dahil) sunucudan GÜNCEL kaydı çekip
  // üzerine yazıyoruz — misafirde no-op, ağ hatasında sessizce eski (cache'li)
  // veriyle devam edilir.
  useEffect(() => {
    if (!currentUser.id) return;
    let cancelled = false;
    apiService.getCurrentUser()
      .then((fresh) => { if (!cancelled && fresh?.id) setCurrentUserState(fresh); })
      .catch(() => { /* sessizce cache'li veriyle devam et */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const hasPermission = (permission: string) => {
    if (!currentUser) return false;
    // GENERAL_MANAGER is superuser
    if (currentUser.role === 'GENERAL_MANAGER') return true;
    return currentUser.permissions?.includes(permission) || false;
  };

  const setCurrentUser = (user: User) => {
    setCurrentUserState(user);
  };

  const logout = () => {
    localStorage.removeItem(`enflow_current_user_${tenantId}`);
    // Additional logout logic if needed
  };

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, hasPermission, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
