import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
export const ACCENT_COLORS = [
  { color: '#FFFFFF', name: 'Beyaz' },
  { color: '#3b82f6', name: 'Mavi' },
  { color: '#10b981', name: 'Yeşil' },
  { color: '#f59e0b', name: 'Sarı' },
  { color: '#8b5cf6', name: 'Mor' },
  { color: '#f43f5e', name: 'Kırmızı' },
  { color: '#06b6d4', name: 'Cyan' },
  { color: '#ec4899', name: 'Pembe' }
];

export const THEMES = [
  { id: 'space-black', label: 'OLED Siyah' },
  { id: 'deep-space', label: 'Gece Mavisi' },
  { id: 'slate-dark', label: 'Koyu Slate' },
  { id: 'forest-mint', label: 'Orman Yeşili' },
  { id: 'sunset-orange', label: 'Günbatımı Kızılı' },
  { id: 'midnight-purple', label: 'Gece Yarısı Moru' },
  { id: 'nordic-frost', label: 'Kutup Esintisi' },
  { id: 'rose-gold', label: 'Sakura Pembesi' },
  { id: 'crimson-tide', label: 'Kozmik Kızıl' },
  { id: 'ocean-abyss', label: 'Okyanus Derinliği' }
];

export const UPDATE_OPTIONS = [
  { value: 6, label: '6 Saat' },
  { value: 12, label: '12 Saat' },
  { value: 24, label: '1 Gün' },
  { value: 168, label: '7 Gün' }
] as const;

export const fieldStyle = 'h-9 w-full md:w-64 rounded-lg border border-white/5 bg-white/[0.02] px-3 text-xs text-white outline-none transition-all placeholder:text-neutral-600 focus:border-[var(--accent-color)] focus:bg-white/[0.04]';
export const labelStyle = 'text-[13px] font-bold text-neutral-100 tracking-wide';
const helpStyle = 'text-xs leading-relaxed text-neutral-400 mt-1 font-light';
export const primaryButton = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-color)] px-4 text-xs font-black uppercase tracking-wider text-black transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer';
export const secondaryButton = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.02] px-4 text-xs font-bold uppercase tracking-wider text-neutral-200 transition-all hover:bg-white/[0.06] hover:text-white active:scale-[0.98] disabled:opacity-50 cursor-pointer';
export const dangerButton = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-red-500/15 bg-red-950/15 px-3 text-xs font-bold uppercase tracking-wider text-red-300 transition-all hover:bg-red-900/20 active:scale-[0.98] cursor-pointer';
export const EMPTY_ARRAY: never[] = [];

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export function CustomSelect({ value, onChange, options, className = '' }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative w-full md:w-64 select-none ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 pr-9 text-xs text-white outline-none flex items-center justify-between transition-all hover:bg-white/[0.04] hover:border-white/20 active:scale-[0.98] text-left"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown size={14} className={`text-neutral-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-[100] max-h-60 overflow-y-auto rounded-lg border border-white/10 bg-neutral-950 p-1 backdrop-blur-xl shadow-2xl animate-fade-in scrollbar-thin">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs font-semibold rounded-md transition-colors flex items-center justify-between ${
                  isSelected
                    ? 'bg-[var(--accent-color)] text-black font-black'
                    : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="truncate pr-2">{option.label}</span>
                {isSelected && <Check size={12} strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6 border-b border-white/5 pb-4">
      <h2 className="text-lg font-black tracking-tight text-white">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-neutral-400 font-medium">{description}</p>
    </div>
  );
}

export function SettingRow({
  title,
  description,
  children,
  vertical = false
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  vertical?: boolean;
}) {
  if (vertical) {
    return (
      <div className="flex flex-col gap-3 py-5 border-b border-white/[0.04] last:border-b-0">
        <div>
          <div className={labelStyle}>{title}</div>
          {description && <p className={helpStyle}>{description}</p>}
        </div>
        <div className="w-full mt-1">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-5 border-b border-white/[0.04] last:border-b-0">
      <div className="max-w-xl">
        <div className={labelStyle}>{title}</div>
        {description && <p className={helpStyle}>{description}</p>}
      </div>
      <div className="w-full md:w-auto shrink-0 flex justify-end">
        {children}
      </div>
    </div>
  );
}

export function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.01] p-3 text-center hover:bg-white/[0.02] transition-all duration-200 select-none">
      <div className="text-xl font-black text-white leading-none tracking-tight">{value}</div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-neutral-500">{label}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; description: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.01] p-6 text-center">
      <div className="p-3 rounded-full bg-white/[0.02] border border-white/5 text-neutral-500 mb-3">
        <Icon size={20} />
      </div>
      <div className="text-xs font-bold text-neutral-200">{title}</div>
      <div className="mt-1 max-w-xs text-[11px] leading-relaxed text-neutral-500">{description}</div>
    </div>
  );
}
