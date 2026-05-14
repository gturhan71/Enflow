import React, { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface PermissionGateProps {
  children: ReactNode;
  permission: string;
  fallback?: ReactNode;
  showIfNoPermission?: boolean; // If true, renders children but maybe disabled
}

export const PermissionGate = ({ 
  children, 
  permission, 
  fallback = null,
  showIfNoPermission = false 
}: PermissionGateProps) => {
  const { hasPermission } = useAuth();

  if (hasPermission(permission)) {
    return <>{children}</>;
  }

  if (showIfNoPermission) {
    // We could clone children and add disabled prop if it's a button, 
    // but for simplicity we return fallback or null
    return <div className="opacity-50 grayscale pointer-events-none cursor-not-allowed">{children}</div>;
  }

  return <>{fallback}</>;
};
