import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Lock, User, ArrowRight, Settings, Building2 } from 'lucide-react';
import { APP_VERSION, MOCK_TENANTS } from '../constants';

interface LoginProps {
  onLogin: (tenantId: string) => void;
}

const Login = ({ onLogin }: LoginProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState(MOCK_TENANTS[0].id);
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const logo = localStorage.getItem(`enflow_company_logo_${tenantId}`);
    setCurrentLogo(logo);
  }, [tenantId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple mock authentication
    if (username === 'admin' && password === 'admin') {
      onLogin(tenantId);
    } else {
      setError('Geçersiz kullanıcı adı veya şifre. (İpucu: admin / admin)');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-100/50 blur-3xl" />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[60%] rounded-full bg-blue-100/50 blur-3xl" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center"
        >
          {currentLogo ? (
            <img src={currentLogo} alt="Company Logo" className="h-24 w-auto object-contain mb-6 drop-shadow-sm" />
          ) : (
            <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 mb-6">
              <Settings size={40} />
            </div>
          )}
          <h2 className="text-center text-3xl font-extrabold text-slate-900 tracking-tight">
            ENFLOW'a Giriş Yapın
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Kurumsal Süreç Yönetim Sistemi
          </p>
        </motion.div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white py-8 px-4 shadow-2xl shadow-slate-200/50 sm:rounded-3xl sm:px-10 border border-slate-100"
        >
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="company" className="block text-sm font-bold text-slate-700">
                Şirket (Tenant)
              </label>
              <div className="mt-2 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-slate-400" />
                </div>
                <select
                  id="company"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all outline-none bg-slate-50 focus:bg-white appearance-none"
                >
                  {MOCK_TENANTS.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-bold text-slate-700">
                Kullanıcı Adı
              </label>
              <div className="mt-2 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all outline-none bg-slate-50 focus:bg-white"
                  placeholder="Kullanıcı adınızı girin"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-slate-700">
                Şifre
              </label>
              <div className="mt-2 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all outline-none bg-slate-50 focus:bg-white"
                  placeholder="Şifrenizi girin"
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 font-medium"
              >
                {error}
              </motion.div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-700">
                  Beni hatırla
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-bold text-indigo-600 hover:text-indigo-500">
                  Şifremi unuttum
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-200 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
              >
                Giriş Yap
                <ArrowRight size={18} />
              </button>
            </div>
          </form>
        </motion.div>
        
        <div className="mt-8 text-center">
          <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">
            Versiyon {APP_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
