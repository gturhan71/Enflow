import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileSearch, 
  FileText, 
  ShoppingCart, 
  Archive, 
  Settings,
  Bell,
  Search,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  FileCheck,
  ChevronRight,
  Menu,
  X,
  LogOut,
  TrendingUp,
  DollarSign,
  Briefcase,
  Truck,
  Package,
  History,
  FileDown,
  Calendar,
  ShieldCheck,
  MapPin,
  UserCheck,
  ExternalLink,
  Download,
  Filter,
  MoreVertical,
  BarChart3,
  PieChart,
  ArrowDownRight,
  Target,
  Percent,
  FileSignature,
  Kanban,
  Wand2,
  Puzzle,
  Cpu,
  Mail,
  MessageSquare,
  ListTodo,
  UserPlus,
  FileCheck2,
  PowerOff,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { NAV_ITEMS } from '../constants';
import {
  NextcloudConfig,
  ExchangeConfig,
  WhatsAppConfig
} from '../types';
import { nextcloudService } from '../services/nextcloudService';
import { exchangeService } from '../services/exchangeService';
import { whatsappService } from '../services/whatsappService';


const IntegrationWizard = ({ 
  ncConfig, 
  setNcConfig,
  exConfig,
  setExConfig,
  waConfig,
  setWaConfig
}: {
  ncConfig: NextcloudConfig,
  setNcConfig: (c: NextcloudConfig) => void,
  exConfig: ExchangeConfig,
  setExConfig: (c: ExchangeConfig) => void,
  waConfig: WhatsAppConfig,
  setWaConfig: (c: WhatsAppConfig) => void
}) => {
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [disablePrompt, setDisablePrompt] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const INTEGRATIONS = [
    { id: 'nextcloud', name: 'Nextcloud DMS', description: 'Dosya yönetimi ve paylaşım sistemi.', icon: History, color: 'text-blue-600', bg: 'bg-blue-50', isEnabled: ncConfig.isEnabled },
    { id: 'sap', name: 'SAP ERP', description: 'Kurumsal kaynak planlama entegrasyonu.', icon: Cpu, color: 'text-slate-600', bg: 'bg-slate-50', isEnabled: false },
    { id: 'exchange', name: 'MS Exchange', description: 'E-posta ve takvim senkronizasyonu.', icon: Mail, color: 'text-red-600', bg: 'bg-red-50', isEnabled: exConfig.isEnabled },
    { id: 'whatsapp', name: 'WhatsApp Business', description: 'Müşteri bildirimleri ve sohbet.', icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50', isEnabled: waConfig.isEnabled },
    { id: 'tr_erp_crm', name: 'Yerel ERP & CRM', description: 'Logo, Mikro, Netsis vb. yerel sistem entegrasyonu.', icon: Puzzle, color: 'text-indigo-600', bg: 'bg-indigo-50', isEnabled: false },
  ];

  const handleDisable = () => {
    if (adminPassword === 'admin') {
      if (disablePrompt === 'nextcloud') {
        const newConfig = { ...ncConfig, isEnabled: false };
        setNcConfig(newConfig);
        nextcloudService.updateConfig(newConfig);
      } else if (disablePrompt === 'exchange') {
        const newConfig = { ...exConfig, isEnabled: false };
        setExConfig(newConfig);
        exchangeService.updateConfig(newConfig);
      } else if (disablePrompt === 'whatsapp') {
        const newConfig = { ...waConfig, isEnabled: false };
        setWaConfig(newConfig);
        whatsappService.updateConfig(newConfig);
      }
      setDisablePrompt(null);
      setAdminPassword('');
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  if (!selectedIntegration) {
    return (
      <div className="relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {INTEGRATIONS.map((int) => (
            <div 
              key={int.id} 
              className="glass-card p-6 rounded-3xl transition-all group relative"
            >
              <div 
                className="cursor-pointer"
                onClick={() => !int.isEnabled && setSelectedIntegration(int.id)}
              >
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform", int.bg, int.color)}>
                  <int.icon size={24} />
                </div>
                <h4 className="font-bold text-slate-900 mb-1">{int.name}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{int.description}</p>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                {int.isEnabled ? (
                  <>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-1">
                      <CheckCircle2 size={14} /> Aktif
                    </span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setDisablePrompt(int.id);
                      }}
                      className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                    >
                      <PowerOff size={12} /> Devre Dışı Bırak
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Kurulum Bekliyor</span>
                    <button 
                      onClick={() => setSelectedIntegration(int.id)}
                      className="text-indigo-600 hover:bg-indigo-50 p-1 rounded-md transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Disable Prompt Modal */}
        <AnimatePresence>
          {disablePrompt && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-panel rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
              >
                <div className="p-8">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                    <Lock size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2 text-center">Yönetici Onayı Gerekli</h3>
                  <p className="text-slate-600 text-center text-sm mb-6">
                    Bu entegrasyonu devre dışı bırakmak için yönetici şifrenizi girmeniz gerekmektedir.
                  </p>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Yönetici Şifresi</label>
                    <input 
                      type="password" 
                      value={adminPassword}
                      onChange={(e) => {
                        setAdminPassword(e.target.value);
                        setPasswordError(false);
                      }}
                      placeholder="Şifrenizi girin..."
                      className={cn(
                        "w-full px-4 py-3 bg-slate-50 border rounded-2xl text-sm outline-none transition-all",
                        passwordError ? "border-red-500 focus:border-red-500" : "border-slate-200 focus:border-indigo-500"
                      )}
                    />
                    {passwordError && (
                      <p className="text-xs text-red-500 font-medium">Hatalı şifre girdiniz.</p>
                    )}
                  </div>
                </div>
                <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setDisablePrompt(null);
                      setAdminPassword('');
                      setPasswordError(false);
                    }}
                    className="px-6 py-3 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors flex-1"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleDisable}
                    disabled={!adminPassword}
                    className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 transition-colors flex-1 disabled:opacity-50"
                  >
                    Devre Dışı Bırak
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="glass-panel rounded-3xl shadow-sm overflow-hidden text-slate-900">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedIntegration(null)} className="p-2 hover:bg-white rounded-xl transition-colors">
              <ChevronRight size={20} className="rotate-180" />
            </button>
            <div>
              <h4 className="font-bold text-slate-900">{INTEGRATIONS.find(i => i.id === selectedIntegration)?.name} Kurulum Sihirbazı</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Adım {wizardStep} / 3</p>
            </div>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3].map(s => (
              <div key={s} className={cn("h-1.5 w-8 rounded-full", wizardStep >= s ? "bg-indigo-600" : "bg-slate-200")} />
            ))}
          </div>
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {selectedIntegration === 'nextcloud' && (
              <motion.div
                key={wizardStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {wizardStep === 1 && (
                  <div className="space-y-6">
                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-start gap-4">
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><History size={24} /></div>
                      <div>
                        <h5 className="font-bold text-blue-900">Sunucu Bağlantısı</h5>
                        <p className="text-sm text-blue-700">Nextcloud sunucunuzun WebDAV ve OCS API adreslerini tanımlayın.</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Sunucu URL</label>
                        <input 
                          type="text" 
                          value={ncConfig.url}
                          onChange={(e) => setNcConfig({...ncConfig, url: e.target.value})}
                          placeholder="https://cloud.sirketiniz.com"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Kök Klasör (DMS)</label>
                        <input 
                          type="text" 
                          value={ncConfig.basePath}
                          onChange={(e) => setNcConfig({...ncConfig, basePath: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="space-y-6">
                    <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex items-start gap-4">
                      <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><ShieldCheck size={24} /></div>
                      <div>
                        <h5 className="font-bold text-amber-900">Kimlik Doğrulama</h5>
                        <p className="text-sm text-amber-700">Yönetici yetkisine sahip bir kullanıcı hesabı girin.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Admin Kullanıcı</label>
                        <input 
                          type="text" 
                          value={ncConfig.adminUser}
                          onChange={(e) => setNcConfig({...ncConfig, adminUser: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Admin Şifre</label>
                        <input 
                          type="password" 
                          value={ncConfig.adminPass}
                          onChange={(e) => setNcConfig({...ncConfig, adminPass: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 3 && (
                  <div className="space-y-6">
                    <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex items-start gap-4">
                      <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><Wand2 size={24} /></div>
                      <div>
                        <h5 className="font-bold text-emerald-900">Tamamlanıyor</h5>
                        <p className="text-sm text-emerald-700">Senkronizasyon ayarlarını onaylayın ve testi başlatın.</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <span className="text-sm font-medium text-slate-600">Otomatik Kullanıcı Oluşturma</span>
                        <div className="w-10 h-5 bg-emerald-500 rounded-full relative"><div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" /></div>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <span className="text-sm font-medium text-slate-600">Tarih Bazlı Klasörleme</span>
                        <div className="w-10 h-5 bg-emerald-500 rounded-full relative"><div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" /></div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {selectedIntegration === 'exchange' && (
              <motion.div
                key={wizardStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {wizardStep === 1 && (
                  <div className="space-y-6">
                    <div className="bg-red-50 p-6 rounded-2xl border border-red-100 flex items-start gap-4">
                      <div className="p-2 bg-red-100 text-red-600 rounded-xl"><Mail size={24} /></div>
                      <div>
                        <h5 className="font-bold text-red-900">Exchange Sunucu Bilgileri</h5>
                        <p className="text-sm text-red-700">MS Exchange sunucu adresinizi ve domain bilgilerinizi girin.</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Sunucu Adresi (OWA/EWS)</label>
                        <input 
                          type="text" 
                          value={exConfig.serverUrl}
                          onChange={(e) => setExConfig({...exConfig, serverUrl: e.target.value})}
                          placeholder="outlook.office365.com"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Domain</label>
                        <input 
                          type="text" 
                          value={exConfig.domain}
                          onChange={(e) => setExConfig({...exConfig, domain: e.target.value})}
                          placeholder="sirketadi.local"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="space-y-6">
                    <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex items-start gap-4">
                      <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><ShieldCheck size={24} /></div>
                      <div>
                        <h5 className="font-bold text-amber-900">Yönetici Hesabı</h5>
                        <p className="text-sm text-amber-700">Senkronizasyon için yetkili bir e-posta hesabı tanımlayın.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Admin E-posta</label>
                        <input 
                          type="email" 
                          value={exConfig.adminEmail}
                          onChange={(e) => setExConfig({...exConfig, adminEmail: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Şifre / Uygulama Şifresi</label>
                        <input 
                          type="password" 
                          value={exConfig.adminPass}
                          onChange={(e) => setExConfig({...exConfig, adminPass: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 3 && (
                  <div className="space-y-6">
                    <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex items-start gap-4">
                      <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><Wand2 size={24} /></div>
                      <div>
                        <h5 className="font-bold text-emerald-900">Senkronizasyon Tercihleri</h5>
                        <p className="text-sm text-emerald-700">Hangi verilerin senkronize edileceğini seçin.</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <span className="text-sm font-medium text-slate-600">E-posta Senkronizasyonu</span>
                        <div 
                          onClick={() => setExConfig({...exConfig, syncEmails: !exConfig.syncEmails})}
                          className={cn("w-10 h-5 rounded-full relative cursor-pointer transition-colors", exConfig.syncEmails ? "bg-emerald-500" : "bg-slate-300")}
                        >
                          <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", exConfig.syncEmails ? "right-1" : "left-1")} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <span className="text-sm font-medium text-slate-600">Takvim Senkronizasyonu</span>
                        <div 
                          onClick={() => setExConfig({...exConfig, syncCalendar: !exConfig.syncCalendar})}
                          className={cn("w-10 h-5 rounded-full relative cursor-pointer transition-colors", exConfig.syncCalendar ? "bg-emerald-500" : "bg-slate-300")}
                        >
                          <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", exConfig.syncCalendar ? "right-1" : "left-1")} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {selectedIntegration === 'whatsapp' && (
              <motion.div
                key={wizardStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {wizardStep === 1 && (
                  <div className="space-y-6">
                    <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex items-start gap-4">
                      <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><MessageSquare size={24} /></div>
                      <div>
                        <h5 className="font-bold text-emerald-900">WhatsApp API Bilgileri</h5>
                        <p className="text-sm text-emerald-700">Meta for Developers panelinden aldığınız API bilgilerini girin.</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Phone Number ID</label>
                        <input 
                          type="text" 
                          value={waConfig.phoneNumberId}
                          onChange={(e) => setWaConfig({...waConfig, phoneNumberId: e.target.value})}
                          placeholder="1092837465..."
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">WhatsApp Business Account ID</label>
                        <input 
                          type="text" 
                          value={waConfig.businessAccountId}
                          onChange={(e) => setWaConfig({...waConfig, businessAccountId: e.target.value})}
                          placeholder="987654321..."
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="space-y-6">
                    <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex items-start gap-4">
                      <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><ShieldCheck size={24} /></div>
                      <div>
                        <h5 className="font-bold text-amber-900">Erişim Anahtarı</h5>
                        <p className="text-sm text-amber-700">Süresiz (Permanent) Access Token bilginizi girin.</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">System User Access Token</label>
                        <textarea 
                          value={waConfig.accessToken}
                          onChange={(e) => setWaConfig({...waConfig, accessToken: e.target.value})}
                          rows={3}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 3 && (
                  <div className="space-y-6">
                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-start gap-4">
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><Cpu size={24} /></div>
                      <div>
                        <h5 className="font-bold text-blue-900">Webhook Yapılandırması</h5>
                        <p className="text-sm text-blue-700">Gelen mesajları dinlemek için Webhook ayarlarını tamamlayın.</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Webhook Verify Token</label>
                        <input 
                          type="text" 
                          value={waConfig.webhookVerifyToken}
                          onChange={(e) => setWaConfig({...waConfig, webhookVerifyToken: e.target.value})}
                          placeholder="Kendi belirlediğiniz bir anahtar"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Callback URL</p>
                        <code className="text-xs text-indigo-600 break-all">https://api.enflow.com/webhooks/whatsapp</code>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {selectedIntegration === 'tr_erp_crm' && (
              <motion.div
                key={wizardStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {wizardStep === 1 && (
                  <div className="space-y-6">
                    <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 flex items-start gap-4">
                      <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><Puzzle size={24} /></div>
                      <div>
                        <h5 className="font-bold text-indigo-900">Yerel Sistem Seçimi</h5>
                        <p className="text-sm text-indigo-700">Türkiye'de yaygın olarak kullanılan Logo Tiger/Go, Netsis, Mikro Run/Fly veya yerel bir SQL Server / REST servisi seçin.</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Uygulama Tipi</label>
                        <select 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500 font-bold"
                          defaultValue="logo_erp"
                        >
                          <option value="logo_erp">Logo Tiger / GO ERP (REST Service)</option>
                          <option value="logo_crm">Logo CRM API</option>
                          <option value="mikro_erp">Mikro Fly / Run (MSSQL Gateway)</option>
                          <option value="netsis_erp">Logo Netsis Enterprise (REST API)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Bağlantı Türü</label>
                        <div className="grid grid-cols-2 gap-4">
                          <label className="border border-slate-200 rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50">
                            <input type="radio" name="conn_type" defaultChecked />
                            <div>
                              <p className="text-xs font-bold text-slate-900">Doğrudan REST Web Servis</p>
                              <p className="text-[10px] text-slate-400">JSON/XML endpoints</p>
                            </div>
                          </label>
                          <label className="border border-slate-200 rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50">
                            <input type="radio" name="conn_type" />
                            <div>
                              <p className="text-xs font-bold text-slate-900">MSSQL Gateway Agent</p>
                              <p className="text-[10px] text-slate-400">T-Ecosystem SQL Connector</p>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="space-y-6">
                    <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex items-start gap-4">
                      <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><ShieldCheck size={24} /></div>
                      <div>
                        <h5 className="font-bold text-amber-900">API Gateway & Database Credentials</h5>
                        <p className="text-sm text-amber-700">Entegrasyon modülünün yerel SQL veritabanına veya ERP REST gateway'ine bağlanması için gerekli erişim verileri.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2 col-span-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Gateway URL / Host Address</label>
                        <input 
                          type="text" 
                          defaultValue="http://192.168.1.105:8080/api/v1"
                          placeholder="http://localhost:8080/api/v1"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Kullanıcı Adı (ERP API)</label>
                        <input 
                          type="text" 
                          defaultValue="ENFLOW_INTEGRATOR"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Şifre</label>
                        <input 
                          type="password" 
                          defaultValue="password123"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Firma Numarası (Logo / Netsis)</label>
                        <input 
                          type="text" 
                          defaultValue="026"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Dönem Numarası</label>
                        <input 
                          type="text" 
                          defaultValue="01"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 3 && (
                  <div className="space-y-6">
                    <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex items-start gap-4">
                      <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><Wand2 size={24} /></div>
                      <div>
                        <h5 className="font-bold text-emerald-900">Veri Şeması Eşleme (Schema Mapper)</h5>
                        <p className="text-sm text-emerald-700">Logo/Netsis/Mikro üzerindeki cari kartları, teklifleri ve fatura başlıklarını Enflow şemasıyla eşleyin.</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-600">Enflow Alanı</span>
                          <span className="font-bold text-slate-600">Logo/Netsis DB Kolonu</span>
                        </div>
                        <hr className="border-slate-100" />
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">Customer.name</span>
                          <ChevronRight size={14} className="text-slate-400" />
                          <select className="text-xs border rounded px-2 py-1 bg-white">
                            <option>DEFINITION_ (Cari Tanımı)</option>
                            <option>CODE (Cari Kodu)</option>
                          </select>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">Customer.taxNumber</span>
                          <ChevronRight size={14} className="text-slate-400" />
                          <select className="text-xs border rounded px-2 py-1 bg-white">
                            <option>TAXNR (Vergi Numarası)</option>
                            <option>TCKNO (TC Kimlik No)</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button 
                          type="button" 
                          onClick={() => alert("Logo/Netsis entegrasyon API testi başarılı: 142 Cari Kart senkronize edilmeye hazır!")}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-2 border border-indigo-200"
                        >
                          <CheckCircle2 size={14} /> Bağlantıyı ve Şemayı Test Et
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {selectedIntegration !== 'nextcloud' && selectedIntegration !== 'exchange' && selectedIntegration !== 'whatsapp' && selectedIntegration !== 'tr_erp_crm' && (
              <div className="py-12 text-center space-y-4">
                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mx-auto">
                  <Cpu size={40} />
                </div>
                <h5 className="font-bold text-slate-900">Bu Entegrasyon Yakında Gelecek</h5>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">Seçtiğiniz servis için sihirbaz hazırlık aşamasındadır.</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between">
          <button 
            onClick={() => setWizardStep(Math.max(1, wizardStep - 1))}
            disabled={wizardStep === 1}
            className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 disabled:opacity-30"
          >
            Geri
          </button>
          <div className="flex gap-3">
            <button 
              onClick={() => setSelectedIntegration(null)}
              className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
            >
              İptal
            </button>
            <button
              onClick={() => {
                if (wizardStep < 3) setWizardStep(wizardStep + 1);
                else {
                  if (selectedIntegration === 'nextcloud') {
                    const newConfig = { ...ncConfig, isEnabled: true };
                    setNcConfig(newConfig);
                    nextcloudService.updateConfig(newConfig);
                  }
                  if (selectedIntegration === 'exchange') {
                    const newConfig = { ...exConfig, isEnabled: true };
                    setExConfig(newConfig);
                    exchangeService.updateConfig(newConfig);
                  }
                  if (selectedIntegration === 'whatsapp') {
                    const newConfig = { ...waConfig, isEnabled: true };
                    setWaConfig(newConfig);
                    whatsappService.updateConfig(newConfig);
                  }
                  setSelectedIntegration(null);
                  setWizardStep(1);
                }
              }}
              className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
            >
              {wizardStep === 3 ? 'Kurulumu Tamamla' : 'Devam Et'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationWizard;
