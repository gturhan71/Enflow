import { useEffect, useRef, useState } from 'react';
import { formatMoneyInput, parseMoneyInput } from '../lib/format';

// Native <input type="number"> ondalık ayırıcıyı tarayıcı/OS locale'ine göre dayatır —
// yanındaki döviz seçiminden bağımsız çalıştığı için kafa karıştırıyordu. Bu bileşen
// repo genelindeki tr-TR yazım biçimini (virgül ondalık, nokta binlik — bkz. format.ts)
// her zaman kabul eder; odakta değilken dışarıdan gelen `value` ile senkron kalır,
// yazarken imleci/karakterleri bozmaz (yalnız blur'da yeniden biçimlendirir).
export default function MoneyInput({
  value, onChange, placeholder, className,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(() => formatMoneyInput(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(formatMoneyInput(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      className={className}
      value={text}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.,]/g, '');
        setText(raw);
        onChange(parseMoneyInput(raw));
      }}
      onBlur={() => {
        focused.current = false;
        setText(formatMoneyInput(value));
      }}
    />
  );
}
