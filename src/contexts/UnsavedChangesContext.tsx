import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface UnsavedChangesContextType {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  handleNavigate: (action: () => void) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType | undefined>(undefined);

export const useUnsavedChanges = () => {
  const context = useContext(UnsavedChangesContext);
  if (!context) throw new Error('Must be used within UnsavedChangesProvider');
  return context;
};

export const UnsavedChangesProvider = ({ children }: { children: ReactNode }) => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const handleInput = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        if (target.getAttribute('type') !== 'search') {
          setHasUnsavedChanges(true);
        }
      }
    };
    
    // Capture phase to ensure we catch all inputs before they might stop propagation
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleInput, true);

    return () => {
      document.removeEventListener('input', handleInput, true);
      document.removeEventListener('change', handleInput, true);
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleNavigate = (action: () => void) => {
    if (hasUnsavedChanges) {
      setPendingAction(() => action);
      setShowConfirm(true);
    } else {
      action();
    }
  };

  const confirmNavigation = () => {
    setShowConfirm(false);
    setHasUnsavedChanges(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const cancelNavigation = () => {
    setShowConfirm(false);
    setPendingAction(null);
  };

  return (
    <UnsavedChangesContext.Provider value={{ hasUnsavedChanges, setHasUnsavedChanges, handleNavigate }}>
      {children}
      {showConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-8">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2 text-center">Kaydedilmemiş Değişiklikler</h3>
              <p className="text-slate-600 text-center text-sm">
                Sayfada yaptığınız bazı değişiklikleri henüz kaydetmediniz. Çıkmak istediğinize emin misiniz? Değişiklikleriniz kaybolabilir.
              </p>
            </div>
            <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-3">
              <button
                onClick={cancelNavigation}
                className="px-6 py-3 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors flex-1"
              >
                İptal ve Dön
              </button>
              <button
                onClick={confirmNavigation}
                className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 transition-colors flex-1"
              >
                Yine de Çık
              </button>
            </div>
          </div>
        </div>
      )}
    </UnsavedChangesContext.Provider>
  );
};
