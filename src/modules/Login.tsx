import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, User, ArrowRight, Settings, Loader2, Mail, ChevronLeft } from 'lucide-react';
import { APP_VERSION } from '../constants';
import { apiService } from '../services/apiService';

interface LoginProps {
  onLogin: (tenantId: string) => void;
}

const Login = ({ onLogin }: LoginProps) => {
  const [view, setView] = useState<'LOGIN' | 'FORGOT_PASSWORD'>('LOGIN');
  const [email, setEmail] = useState('gokhan@t-ecosystem.com');
  const [password, setPassword] = useState('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (view === 'LOGIN') {
        const data = await apiService.login(email);
        apiService.setAuth(data.user.tenantId, data.token);
        onLogin(data.user.tenantId);
      } else {
        const data = await apiService.forgotPassword(email);
        setSuccessMessage(data.message);
        setTimeout(() => {
          setView('LOGIN');
          setSuccessMessage('');
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || 'İşlem yapılamadı. Sunucunun açık olduğundan emin olun.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-50">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 blur-[120px]" />
        <div className="absolute top-[50%] -right-[10%] w-[40%] h-[40%] rounded-full bg-blue-500/20 blur-[120px]" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-200/50 mb-6">
            <Settings size={40} />
          </div>
          <h2 className="text-center text-3xl font-black text-slate-900 tracking-tight uppercase">
            {view === 'LOGIN' ? 'ENFLOW LOGIN' : 'ŞİFRE SIFIRLAMA'}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500 font-medium">
            {view === 'LOGIN' ? 'Uçtan Uca Kurumsal Süreç Yönetimi' : 'E-posta adresinize sıfırlama bağlantısı gönderelim.'}
          </p>
        </motion.div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white/70 backdrop-blur-xl py-10 px-4 shadow-2xl shadow-slate-200/50 sm:rounded-[40px] sm:px-12 border border-white/40">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2">E-posta Adresi</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="block w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-3xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    placeholder="E-posta adresiniz"
                  />
                </div>
              </div>

              {view === 'LOGIN' && (
                <div>
                  <div className="flex items-center justify-between ml-4 mb-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Şifre</label>
                    <button 
                      type="button" 
                      onClick={() => setView('FORGOT_PASSWORD')}
                      className="text-[10px] font-bold text-indigo-600 hover:underline"
                    >
                      Şifremi Unuttum?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <Lock size={18} />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="block w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-3xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold border border-red-100 flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-red-600" />
                  {error}
                </motion.div>
              )}

              {successMessage && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl text-xs font-bold border border-emerald-100 flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-emerald-600" />
                  {successMessage}
                </motion.div>
              )}

              <div className="space-y-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-3 py-4 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-3xl shadow-xl shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>{view === 'LOGIN' ? 'Giriş Yap' : 'Bağlantı Gönder'} <ArrowRight size={20} /></>
                  )}
                </button>

                {view === 'FORGOT_PASSWORD' && (
                  <button
                    type="button"
                    onClick={() => setView('LOGIN')}
                    className="w-full flex justify-center items-center gap-2 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <ChevronLeft size={14} /> Giriş Ekranına Dön
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
      <p className="mt-8 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Enflow • Built for Gökhan Turhan • {new Date().getFullYear()}</p>
    </div>
  );
};

export default Login;
