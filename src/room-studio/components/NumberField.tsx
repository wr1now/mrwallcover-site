import { useEffect, useState } from 'react';
export default function NumberField({ label, value, onChange, min = 0, max = 50000, step = 1, suffix = 'mm' }: { label: string; value: number; onChange: (v: number)=>void; min?: number; max?: number; step?: number; suffix?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(()=>setText(String(value)),[value]);
  const commit = () => { const n=Number(text); if(text.trim() && Number.isFinite(n) && n>=min && n<=max) { const next=Math.round(n/step)*step; if(next!==value)onChange(next); else setText(String(value)); } else setText(String(value)); };
  return <label className="studio-field"><span>{label} <small>{suffix}</small></span><input type="number" inputMode="decimal" min={min} max={max} step={step} value={text} onChange={e=>setText(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.currentTarget.blur();}}}/></label>;
}
