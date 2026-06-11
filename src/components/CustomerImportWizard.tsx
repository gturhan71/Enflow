import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import {
  Upload,
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Customer } from '../types';
import { apiService } from '../services/apiService';

type CustomerFieldKey = keyof Omit<Customer, 'id' | 'tenantId' | 'opportunities' | 'contracts'>;

interface FieldMapping {
  excelColumn: string;
  customerField: CustomerFieldKey | '';
}

interface ParsedRow {
  [key: string]: string | number | undefined;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

const CUSTOMER_FIELDS: { key: CustomerFieldKey; label: string; required?: boolean }[] = [
  { key: 'name', label: 'Müşteri Adı', required: true },
  { key: 'shortName', label: 'Kısa Ad' },
  { key: 'industry', label: 'Sektör' },
  { key: 'email', label: 'E-posta' },
  { key: 'phone', label: 'Telefon' },
  { key: 'website', label: 'Web Sitesi' },
  { key: 'address', label: 'Adres' },
  { key: 'city', label: 'Şehir' },
  { key: 'country', label: 'Ülke' },
  { key: 'taxOffice', label: 'Vergi Dairesi' },
  { key: 'taxNumber', label: 'Vergi No' },
  { key: 'creditLimit', label: 'Kredi Limiti' },
  { key: 'riskScore', label: 'Risk Skoru' },
  { key: 'currency', label: 'Para Birimi' },
  { key: 'techStack', label: 'Teknoloji Altyapısı' },
  { key: 'notes', label: 'Notlar' },
  { key: 'status', label: 'Durum' },
];

const AUTO_MATCH: Record<string, CustomerFieldKey> = {
  'müşteri adı': 'name', 'musteri adi': 'name', 'ad': 'name', 'name': 'name', 'firma': 'name', 'şirket': 'name',
  'kısa ad': 'shortName', 'kisa ad': 'shortName',
  'sektör': 'industry', 'sektor': 'industry', 'industry': 'industry',
  'e-posta': 'email', 'eposta': 'email', 'email': 'email', 'mail': 'email',
  'telefon': 'phone', 'tel': 'phone', 'phone': 'phone',
  'web': 'website', 'website': 'website', 'site': 'website',
  'adres': 'address', 'address': 'address',
  'şehir': 'city', 'sehir': 'city', 'city': 'city',
  'ülke': 'country', 'ulke': 'country', 'country': 'country',
  'vergi dairesi': 'taxOffice', 'vergi daire': 'taxOffice',
  'vergi no': 'taxNumber', 'vergi numarası': 'taxNumber', 'vkn': 'taxNumber',
  'kredi limiti': 'creditLimit', 'limit': 'creditLimit',
  'risk': 'riskScore', 'risk skoru': 'riskScore',
  'para birimi': 'currency', 'döviz': 'currency', 'currency': 'currency',
  'teknoloji': 'techStack', 'tech stack': 'techStack',
  'notlar': 'notes', 'not': 'notes', 'notes': 'notes',
  'durum': 'status', 'status': 'status',
};

const STEPS = ['Dosya Yükle', 'Alan Eşleştir', 'Önizle & İçe Aktar'];

interface Props {
  onClose: () => void;
  onImported: (customers: Customer[]) => void;
}

export const CustomerImportWizard = ({ onClose, onImported }: Props) => {
  const [step, setStep] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: '' });

        if (!json.length) return;

        const cols = Object.keys(json[0]);
        const autoMappings: FieldMapping[] = cols.map((col) => {
          const normalized = col.toLowerCase().trim();
          return { excelColumn: col, customerField: AUTO_MATCH[normalized] ?? '' };
        });

        setFileName(file.name);
        setColumns(cols);
        setRows(json);
        setMappings(autoMappings);
        setStep(1);
      } catch {
        alert('Dosya okunamadı. Lütfen geçerli bir .xlsx veya .csv dosyası yükleyin.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const updateMapping = (index: number, field: CustomerFieldKey | '') => {
    setMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, customerField: field } : m))
    );
  };

  const previewRows = rows.slice(0, 5);

  const buildCustomerFromRow = (row: ParsedRow): Partial<Customer> => {
    const customer: Partial<Customer> = {
      status: 'ACTIVE',
      currency: 'TRY',
      riskScore: 0,
      creditLimit: 0,
    };
    mappings.forEach(({ excelColumn, customerField }) => {
      if (!customerField) return;
      const rawVal = row[excelColumn];
      if (rawVal === undefined || rawVal === '') return;
      if (customerField === 'creditLimit' || customerField === 'riskScore') {
        (customer as Record<string, unknown>)[customerField] = Number(rawVal) || 0;
      } else {
        (customer as Record<string, unknown>)[customerField] = String(rawVal);
      }
    });
    return customer;
  };

  const handleImport = async () => {
    setImporting(true);
    const errors: string[] = [];
    const imported: Customer[] = [];

    for (let i = 0; i < rows.length; i++) {
      const partial = buildCustomerFromRow(rows[i]);
      if (!partial.name) {
        errors.push(`Satır ${i + 2}: Müşteri adı boş — atlandı.`);
        continue;
      }
      try {
        const saved = await apiService.createCustomer(partial as Omit<Customer, 'id'>);
        imported.push(saved);
      } catch (err) {
        errors.push(`Satır ${i + 2} (${partial.name}): ${err instanceof Error ? err.message : 'Hata'}`);
      }
    }

    setResult({ success: imported.length, failed: errors.length, errors });
    setImporting(false);
    if (imported.length) onImported(imported);
    setStep(2);
  };

  const mappedCount = mappings.filter((m) => m.customerField).length;
  const hasName = mappings.some((m) => m.customerField === 'name');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-3xl rounded-[40px] shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">
              Excel'den Müşteri Aktar
            </h4>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              .xlsx veya .csv dosyasından müşteri listesi içe aktarın
            </p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Step indicators */}
        <div className="px-8 pt-6 shrink-0">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black transition-all",
                  step === i ? 'bg-primary text-white' : step > i ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                )}>
                  {step > i ? <CheckCircle size={14} /> : <span className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center text-[10px]">{i + 1}</span>}
                  {s}
                </div>
                {i < STEPS.length - 1 && <div className={cn("flex-1 h-0.5 rounded-full", step > i ? 'bg-emerald-400' : 'bg-slate-200')} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <AnimatePresence mode="wait">
            {/* Step 0: File Upload */}
            {step === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-[28px] p-16 flex flex-col items-center justify-center gap-6 cursor-pointer transition-all",
                    dragging ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-primary/40 hover:bg-slate-50'
                  )}
                >
                  <div className={cn("w-20 h-20 rounded-3xl flex items-center justify-center transition-all", dragging ? 'bg-primary/20' : 'bg-slate-100')}>
                    <FileSpreadsheet size={36} className={dragging ? 'text-primary' : 'text-slate-400'} />
                  </div>
                  <div className="text-center">
                    <p className="font-black text-slate-700 text-base">Dosyayı sürükle bırak veya tıkla</p>
                    <p className="text-sm text-slate-400 mt-1">.xlsx, .xls, .csv formatları desteklenir</p>
                  </div>
                  <div className="px-6 py-3 bg-primary/10 text-primary rounded-2xl text-xs font-black uppercase tracking-widest">
                    Dosya Seç
                  </div>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
                </div>

                <div className="mt-6 p-5 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="text-xs font-black text-blue-700 mb-2">İpuçları</p>
                  <ul className="text-xs text-blue-600 space-y-1 font-medium">
                    <li>• İlk satır sütun başlıklarını içermeli</li>
                    <li>• "Müşteri Adı" sütunu zorunludur</li>
                    <li>• Türkçe ve İngilizce sütun adları otomatik eşleştirilir</li>
                    <li>• Durum sütunu: ACTIVE veya PASSIVE değerlerini alabilir</li>
                  </ul>
                </div>
              </motion.div>
            )}

            {/* Step 1: Field Mapping */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-black text-slate-700">{fileName}</p>
                    <p className="text-xs text-slate-400 font-medium">{rows.length} satır, {columns.length} sütun bulundu · {mappedCount} alan eşleştirildi</p>
                  </div>
                  <button onClick={() => { setStep(0); setFileName(''); }} className="text-xs text-primary font-black flex items-center gap-1 hover:underline">
                    <RefreshCw size={12} /> Değiştir
                  </button>
                </div>

                {!hasName && (
                  <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold text-amber-700">
                    <AlertCircle size={16} className="shrink-0" />
                    "Müşteri Adı" alanı eşleştirilmedi. İçe aktarma için zorunludur.
                  </div>
                )}

                <div className="space-y-3">
                  {mappings.map((mapping, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="w-40 shrink-0">
                        <p className="text-xs font-black text-slate-700 truncate">{mapping.excelColumn}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">Excel sütunu</p>
                      </div>
                      <ArrowRight size={16} className="text-slate-300 shrink-0" />
                      <select
                        value={mapping.customerField}
                        onChange={(e) => updateMapping(i, e.target.value as CustomerFieldKey | '')}
                        className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        <option value="">— Yoksay —</option>
                        {CUSTOMER_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}{f.required ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Preview */}
                {previewRows.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Önizleme (ilk 5 satır)</p>
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            {columns.map((col) => (
                              <th key={col} className="px-4 py-3 text-left font-black text-slate-500 whitespace-nowrap">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {previewRows.map((row, i) => (
                            <tr key={i}>
                              {columns.map((col) => (
                                <td key={col} className="px-4 py-3 text-slate-600 whitespace-nowrap max-w-[160px] truncate">{String(row[col] ?? '')}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 2: Result */}
            {step === 2 && result && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="flex-1 p-6 bg-emerald-50 border border-emerald-100 rounded-2xl text-center">
                    <CheckCircle size={32} className="text-emerald-500 mx-auto mb-2" />
                    <p className="text-3xl font-black text-emerald-700">{result.success}</p>
                    <p className="text-xs font-bold text-emerald-500 mt-1">Başarıyla İçe Aktarıldı</p>
                  </div>
                  {result.failed > 0 && (
                    <div className="flex-1 p-6 bg-red-50 border border-red-100 rounded-2xl text-center">
                      <AlertCircle size={32} className="text-red-400 mx-auto mb-2" />
                      <p className="text-3xl font-black text-red-600">{result.failed}</p>
                      <p className="text-xs font-bold text-red-400 mt-1">Başarısız</p>
                    </div>
                  )}
                </div>

                {result.errors.length > 0 && (
                  <div className="p-5 bg-red-50 border border-red-100 rounded-2xl space-y-2">
                    <p className="text-xs font-black text-red-600 uppercase tracking-widest mb-3">Hatalar</p>
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-500 font-medium">{err}</p>
                    ))}
                  </div>
                )}

                <p className="text-sm text-slate-500 font-medium">
                  İçe aktarma tamamlandı. Müşteri listeniz güncellenmiştir.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button
            onClick={step === 0 ? onClose : () => setStep(s => s - 1)}
            disabled={importing || step === 2}
            className="flex items-center gap-2 px-6 py-3 text-xs font-black text-slate-500 hover:bg-slate-100 rounded-2xl transition-all disabled:opacity-40"
          >
            {step > 0 && step < 2 ? <><ArrowLeft size={14} /> Geri</> : 'İptal'}
          </button>

          {step === 0 && (
            <p className="text-xs text-slate-400 font-medium">Bir dosya yükleyerek başlayın</p>
          )}

          {step === 1 && (
            <button
              onClick={handleImport}
              disabled={!hasName || importing}
              className="flex items-center gap-2 bg-primary text-white px-10 py-4 rounded-2xl text-xs font-black shadow-lg hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-40"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : null}
              {importing ? 'Aktarılıyor...' : `${rows.length} Müşteriyi İçe Aktar`}
            </button>
          )}

          {step === 2 && (
            <button
              onClick={onClose}
              className="flex items-center gap-2 bg-primary text-white px-10 py-4 rounded-2xl text-xs font-black shadow-lg hover:bg-primary/90 transition-all active:scale-95"
            >
              <CheckCircle size={16} /> Kapat
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
