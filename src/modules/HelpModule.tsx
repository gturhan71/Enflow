import React, { useEffect, useMemo, useState } from 'react';
import { Search, HelpCircle, ExternalLink, BookOpen } from 'lucide-react';
import { NAV_ITEMS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { HELP_ARTICLES, getHelpArticle } from '../content/helpArticles';
import { cn } from '../lib/utils';

interface EntitlementRow { plugin: { key: string }; active: boolean }

// tabId, alt-menü öğesiyse (ör. 'crm-opportunities') üst modülünü ('crm') döndürür.
const resolveTopLevelModuleId = (tabId?: string | null): string | undefined => {
  if (!tabId) return undefined;
  for (const item of NAV_ITEMS) {
    if (item.id === tabId) return item.id;
    if (item.subItems?.some((s) => s.id === tabId)) return item.id;
  }
  return undefined;
};

// "**kalın**" işaretini basitçe <b> olarak render eder — ayrı bir markdown
// bağımlılığı gerekmeyecek kadar sade içerik (bkz. wiki/build.mjs'teki aynı prensip).
const renderInline = (text: string): React.ReactNode => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <b key={i}>{part.slice(2, -2)}</b>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );
};

const HelpModule = ({ contextModuleId }: { contextModuleId?: string | null }) => {
  const { hasPermission } = useAuth();
  const [entitled, setEntitled] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let active = true;
    apiService.getPluginEntitlements()
      .then((rows: EntitlementRow[]) => { if (active) setEntitled(new Set((rows || []).filter(r => r.active).map(r => r.plugin.key))); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Sidebar'la BİREBİR aynı görünürlük mantığı — kullanıcı Yardım'da tam
  // olarak kendi sidebar'ında gördüğü modülleri görür.
  const visibleModules = useMemo(() => {
    return NAV_ITEMS
      .filter((item) => {
        const ent = (item as { requiredEntitlement?: string }).requiredEntitlement;
        if (ent && !entitled.has(ent)) return false;
        return hasPermission(item.requiredPermission);
      })
      .map((item) => ({ id: item.id, label: item.label, icon: item.icon }))
      .filter((m) => getHelpArticle(m.id));
  }, [entitled, hasPermission]);

  const resolvedContext = useMemo(() => resolveTopLevelModuleId(contextModuleId), [contextModuleId]);

  const [selectedId, setSelectedId] = useState<string | undefined>(() =>
    (resolvedContext && visibleModules.some((m) => m.id === resolvedContext))
      ? resolvedContext
      : visibleModules[0]?.id
  );

  const filteredModules = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr');
    if (!q) return visibleModules;
    return visibleModules.filter((m) => {
      const article = getHelpArticle(m.id);
      const haystack = [m.label, article?.summary, ...(article?.sections.map((s) => `${s.heading} ${s.body}`) || [])]
        .join(' ').toLocaleLowerCase('tr');
      return haystack.includes(q);
    });
  }, [visibleModules, searchQuery]);

  const selected = HELP_ARTICLES.find((a) => a.moduleId === selectedId);
  const selectedNav = NAV_ITEMS.find((n) => n.id === selectedId);
  const SelectedIcon = selectedNav?.icon;

  return (
    <div className="p-8 space-y-6 h-full overflow-y-auto pb-24 font-sans bg-slate-50/30 custom-scrollbar">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none flex items-center gap-3">
            <HelpCircle size={28} className="text-primary" /> Yardım
          </h3>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Şu an baktığınız ekranı nasıl kullanacağınıza dair adım adım kılavuz.
          </p>
        </div>
        <a
          href="/wiki"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-primary hover:shadow-md transition-all shrink-0"
        >
          <BookOpen size={16} /> Enflow'u Sıfırdan Öğren — Wiki <ExternalLink size={12} />
        </a>
      </div>

      <div className="relative group max-w-md">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
        <input
          type="text"
          placeholder="Modül veya konu ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-14 pr-6 py-3.5 bg-white border border-slate-100 rounded-[20px] text-sm font-bold shadow-sm focus:ring-4 focus:ring-primary/10 outline-none w-full transition-all"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 glass-panel rounded-[28px] p-3 bg-white border border-slate-100 h-fit max-h-[65vh] overflow-y-auto custom-scrollbar">
          {filteredModules.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-8">Eşleşen konu yok.</p>
          ) : (
            filteredModules.map((m) => {
              const Icon = m.icon;
              const active = m.id === selectedId;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left text-xs font-black uppercase tracking-wide transition-all mb-1',
                    active ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  {Icon && <Icon size={16} className="shrink-0" />}
                  <span className="truncate">{m.label}</span>
                </button>
              );
            })
          )}
        </div>

        <div className="lg:col-span-3 glass-panel rounded-[28px] p-8 bg-white border border-slate-100">
          {!selected ? (
            <p className="text-sm text-slate-400 italic text-center py-16">Soldan bir modül seçin.</p>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
                {SelectedIcon && (
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <SelectedIcon size={26} />
                  </div>
                )}
                <div>
                  <h4 className="text-2xl font-black text-slate-900 tracking-tight">{selectedNav?.label}</h4>
                  <p className="text-slate-500 text-sm mt-1">{selected.summary}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Kimler kullanır: {selected.audience}</p>
                </div>
              </div>

              <div className="space-y-6">
                {selected.sections.map((s, i) => (
                  <div key={i}>
                    <h5 className="text-[11px] font-black text-primary uppercase tracking-widest mb-2">{s.heading}</h5>
                    <p className="text-sm text-slate-700 leading-relaxed">{renderInline(s.body)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HelpModule;
