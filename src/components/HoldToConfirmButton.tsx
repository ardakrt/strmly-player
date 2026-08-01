/* Hallmark · component: button · genre: modern-minimal · theme: custom
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */

import React, { useState, useRef, useEffect } from 'react';
import { Trash2, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export interface HoldToConfirmButtonProps {
  /** Callback triggered when user completes the press-and-hold duration */
  onConfirm: () => void;
  /** Hold duration in milliseconds (default 1200ms) */
  holdDuration?: number;
  /** Button label */
  label?: string;
  /** Confirmed state label */
  confirmedLabel?: string;
  /** Custom icon component */
  icon?: React.ReactNode;
  /** Custom class names */
  className?: string;
  /** Variant style */
  variant?: 'danger' | 'warning' | 'primary';
  /** Accessible label */
  ariaLabel?: string;
  /** Component state override for testing */
  state?: 'default' | 'hover' | 'focus' | 'active' | 'disabled' | 'loading' | 'error' | 'success';
  /** Disabled flag */
  disabled?: boolean;
}

export const HoldToConfirmButton: React.FC<HoldToConfirmButtonProps> = ({
  onConfirm,
  holdDuration = 1200,
  label,
  confirmedLabel,
  icon,
  className = '',
  variant = 'danger',
  ariaLabel,
  state,
  disabled = false,
}) => {
  const { language } = useSettings();
  const resolvedLabel = label || (language === 'tr' ? 'Basılı Tutun' : 'Press and Hold');
  const resolvedConfirmedLabel = confirmedLabel || (language === 'tr' ? 'Onaylandı' : 'Confirmed');
  const resolvedAriaLabel = ariaLabel || (language === 'tr' ? 'Basılı tutarak onaylayın' : 'Hold to confirm');
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const startHold = () => {
    if (disabled || state === 'disabled' || state === 'loading' || isConfirmed) return;
    setIsHolding(true);
    startTimeRef.current = performance.now();

    const updateProgress = (now: number) => {
      if (!startTimeRef.current) return;
      const elapsed = now - startTimeRef.current;
      const currentProgress = Math.min(1, elapsed / holdDuration);
      setProgress(currentProgress);

      if (currentProgress >= 1) {
        setIsHolding(false);
        setIsConfirmed(true);
        onConfirm();
        setTimeout(() => {
          setIsConfirmed(false);
          setProgress(0);
        }, 1800);
      } else {
        animFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    animFrameRef.current = requestAnimationFrame(updateProgress);
  };

  const cancelHold = () => {
    if (isConfirmed) return;
    setIsHolding(false);
    startTimeRef.current = null;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setProgress(0);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const isDisabled = disabled || state === 'disabled';
  const isLoading = state === 'loading';
  const isError = state === 'error';
  const isSuccess = state === 'success' || isConfirmed;

  const variantStyles = {
    danger: {
      base: 'border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 hover:border-red-500/50',
      progress: 'bg-red-500/40',
      glow: 'shadow-[0_0_15px_rgba(239,68,68,0.3)]',
    },
    warning: {
      base: 'border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-500/50',
      progress: 'bg-amber-500/40',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]',
    },
    primary: {
      base: 'border-white/20 text-white bg-white/10 hover:bg-white/20 hover:border-white/30',
      progress: 'bg-white/30',
      glow: 'shadow-[0_0_15px_rgba(255,255,255,0.2)]',
    },
  }[variant];

  return (
    <button
      type="button"
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={startHold}
      onTouchEnd={cancelHold}
      disabled={isDisabled}
      aria-label={resolvedAriaLabel}
      data-state={state || (isConfirmed ? 'confirmed' : isHolding ? 'holding' : 'idle')}
      className={`relative overflow-hidden inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border backdrop-blur-md transition-all duration-200 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 ${
        isDisabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-[0.98]'
      } ${variantStyles.base} ${isHolding ? variantStyles.glow : ''} ${className}`}
    >
      {/* Background progress fill */}
      <span
        className={`absolute inset-0 transition-none pointer-events-none ${variantStyles.progress}`}
        style={{
          width: `${(isSuccess ? 1 : progress) * 100}%`,
        }}
      />

      {/* Button content */}
      <span className="relative z-10 inline-flex items-center gap-1.5">
        {isLoading ? (
          <Loader2 size={14} className="animate-spin text-neutral-300" />
        ) : isError ? (
          <AlertTriangle size={14} className="text-amber-400" />
        ) : isSuccess ? (
          <Check size={14} className="text-emerald-400 animate-bounce" />
        ) : (
          icon || <Trash2 size={14} />
        )}
        <span>{isSuccess ? resolvedConfirmedLabel : isHolding ? (language === 'tr' ? 'Basılı Tutun...' : 'Holding...') : resolvedLabel}</span>
      </span>
    </button>
  );
};

export default HoldToConfirmButton;
