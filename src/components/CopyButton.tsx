/* Hallmark · component: button · genre: modern-minimal · theme: custom
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */

import React, { useState } from 'react';
import { Copy, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export interface CopyButtonProps {
  /** Text content to copy to clipboard */
  value: string;
  /** Button label */
  label?: string;
  /** Label shown after successful copy */
  copiedLabel?: string;
  /** Icon size */
  size?: number;
  /** Additional CSS classes */
  className?: string;
  /** Accessible label */
  ariaLabel?: string;
  /** Component state override for testing */
  state?: 'default' | 'hover' | 'focus' | 'active' | 'disabled' | 'loading' | 'error' | 'success';
  /** Disabled flag */
  disabled?: boolean;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  value,
  label,
  copiedLabel,
  size = 14,
  className = '',
  ariaLabel,
  state,
  disabled = false,
}) => {
  const { language } = useSettings();
  const resolvedCopiedLabel = copiedLabel || (language === 'tr' ? 'Kopyalandı' : 'Copied');
  const resolvedAriaLabel = ariaLabel || (language === 'tr' ? 'Metni kopyala' : 'Copy text');
  const [copied, setCopied] = useState(false);
  const [isError, setIsError] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || state === 'disabled' || state === 'loading' || copied) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setIsError(true);
      setTimeout(() => setIsError(false), 2000);
    }
  };

  const isDisabled = disabled || state === 'disabled';
  const isLoading = state === 'loading';
  const hasError = isError || state === 'error';
  const isSuccess = copied || state === 'success';

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={isDisabled}
      aria-label={resolvedAriaLabel}
      title={resolvedAriaLabel}
      data-state={state || (isSuccess ? 'copied' : hasError ? 'error' : 'idle')}
      className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border backdrop-blur-md transition-all duration-200 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
        isDisabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:scale-105 active:scale-95'
      } ${
        isSuccess
          ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
          : hasError
          ? 'border-red-500/30 text-red-400 bg-red-500/10'
          : 'border-white/10 text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10'
      } ${className}`}
    >
      {isLoading ? (
        <Loader2 size={size} className="animate-spin text-neutral-400" />
      ) : hasError ? (
        <AlertCircle size={size} className="text-red-400" />
      ) : isSuccess ? (
        <Check size={size} className="text-emerald-400 animate-scale-in" />
      ) : (
        <Copy size={size} className="transition-transform duration-200 group-hover:scale-110" />
      )}

      {label || isSuccess ? (
        <span>{isSuccess ? resolvedCopiedLabel : label}</span>
      ) : null}
    </button>
  );
};

export default CopyButton;
