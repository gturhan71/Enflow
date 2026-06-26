// Enflow — Modül-bazlı YZ kapısı (AI gate)
// ─────────────────────────────────────────────────────────────────────────────
// Herhangi bir modülde YZ gerektiren bir işlem tetiklendiğinde, sisteme entegre
// bir YZ API anahtarı yoksa: işlemi durdurur, bir popup gösterir ve kullanıcıyı
// "Ayarlar → Entegrasyonlar" YZ sayfasına yönlendirir (gereklilik gözlemlensin).
//
// Kullanım: const { requireAI } = useAIGate();
//           if (!(await requireAI())) return;  // YZ yoksa popup açılır, false döner

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cpu, ArrowRight, X } from 'lucide-react';
import { apiService } from '../services/apiService';

interface AIGateContextType {
  /** YZ yapılandırılmışsa true döner; değilse popup açar ve false döner. */
  requireAI: (featureLabel?: string) => Promise<boolean>;
}

const AIGateContext = createContext<AIGateContextType | undefined>(undefined);

export const AIGateProvider = ({
  children,
  onNavigateToIntegrations,
}: {
  children: ReactNode;
  onNavigateToIntegrations: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [feature, setFeature] = useState<string>('');

  const requireAI = useCallback(async (featureLabel?: string): Promise<boolean> => {
    try {
      const { configured } = await apiService.getAIStatus();
      if (configured) return true;
    } catch {
      // Durum okunamadıysa da kapıyı göster (güvenli taraf).
    }
    setFeature(featureLabel || '');
    setOpen(true);
    return false;
  }, []);

  const goIntegrations = () => {
    setOpen(false);
    onNavigateToIntegrations();
  };

  return (
    <AIGateContext.Provider value={{ requireAI }}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="glass-card w-full max-w-md rounded-2xl p-6 relative"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                aria-label="Kapat"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
                <Cpu className="w-6 h-6 text-indigo-500" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-1">Yapay Zeka (YZ) Entegrasyonu Gerekli</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {feature ? <><span className="font-semibold text-slate-700">{feature}</span> işlemi için </> : 'Bu işlem için '}
                sisteme entegre bir YZ bulunamadı. Devam etmek için istediğiniz YZ sağlayıcısının
                API anahtarını <span className="font-semibold text-slate-700">Ayarlar → Entegrasyonlar</span>
                {' '}bölümünden bağlayın.
              </p>

              <div className="flex items-center gap-3 mt-6">
                <button onClick={goIntegrations} className="btn-primary text-sm flex items-center gap-2">
                  Entegrasyona Git <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setOpen(false)} className="btn-secondary text-sm">
                  Vazgeç
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AIGateContext.Provider>
  );
};

export const useAIGate = (): AIGateContextType => {
  const ctx = useContext(AIGateContext);
  if (!ctx) {
    // Provider yoksa güvenli no-op: işlemi engellemez (geliştirme kolaylığı).
    return { requireAI: async () => true };
  }
  return ctx;
};
