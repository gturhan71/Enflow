import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MOCK_SYSTEM_USERS } from '../constants';
import { User } from '../types';

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
    return saved ? JSON.parse(saved) : MOCK_SYSTEM_USERS[0];
  });

  useEffect(() => {
    localStorage.setItem(`enflow_current_user_${tenantId}`, JSON.stringify(currentUser));
  }, [currentUser, tenantId]);

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
