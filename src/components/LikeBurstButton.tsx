/* Hallmark · component: button · genre: modern-minimal · theme: custom
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */

import React, { useState, useEffect, useRef } from 'react';
import { Heart, Loader2, AlertCircle, Check } from 'lucide-react';

export interface LikeBurstButtonProps {
  /** Current favorite/liked state */
  isLiked?: boolean;
  /** Callback fired when user toggles liked status */
  onToggle?: (newLiked: boolean, e: React.MouseEvent) => void;
  /** Icon size in px (default 18) */
  size?: number;
  /** Optional label text next to the heart */
  label?: string;
  /** Optional like count to display */
  count?: number;
  /** Additional CSS class names */
  className?: string;
  /** Accessible label */
  ariaLabel?: string;
  /** Component state override for state testing & previews */
  state?: 'default' | 'hover' | 'focus' | 'active' | 'disabled' | 'loading' | 'error' | 'success';
  /** Disabled flag */
  disabled?: boolean;
}

// 8 sparks radiating around the heart center
const SPARKS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
  const distance = 16; // radial distance in px
  const tx = Math.round(Math.cos(angle) * distance);
  const ty = Math.round(Math.sin(angle) * distance);
  const sparkSize = i % 2 === 0 ? 4 : 3;
  return { id: i, tx, ty, sparkSize };
});

export const LikeBurstButton: React.FC<LikeBurstButtonProps> = ({
  isLiked = false,
  onToggle,
  size = 18,
  label,
  count,
  className = '',
  ariaLabel = 'Favorilere Ekle',
  state,
  disabled = false,
}) => {
  const [internalLiked, setInternalLiked] = useState(isLiked);
  const [isAnimating, setIsAnimating] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const isFirstRender = useRef(true);

  // Sync prop changes
  useEffect(() => {
    setInternalLiked(isLiked);
  }, [isLiked]);

  // Trigger burst animation only when flipping from false -> true
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || state === 'disabled' || state === 'loading') return;

    const nextLiked = !internalLiked;
    setInternalLiked(nextLiked);

    if (nextLiked) {
      setIsAnimating(true);
      setBurstKey((prev) => prev + 1);
      setTimeout(() => setIsAnimating(false), 500);
    }

    if (onToggle) {
      onToggle(nextLiked, e);
    }
  };

  useEffect(() => {
    isFirstRender.current = false;
  }, []);

  const activeLiked = state === 'success' ? true : internalLiked;
  const isDisabled = disabled || state === 'disabled';
  const isLoading = state === 'loading';
  const isError = state === 'error';
  const isSuccess = state === 'success';

  // Compute state modifier classes
  const stateClasses = [
    state === 'hover' ? 'is-hover' : '',
    state === 'focus' ? 'is-focus' : '',
    state === 'active' ? 'is-active' : '',
  ].join(' ');

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-pressed={activeLiked}
      data-state={state || (isLoading ? 'loading' : isError ? 'error' : isSuccess ? 'success' : activeLiked ? 'liked' : 'idle')}
      className={`relative inline-flex items-center justify-center gap-2 select-none font-medium text-xs rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 cursor-pointer ${
        isDisabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:scale-105 active:scale-95'
      } ${
        activeLiked
          ? 'text-rose-500 bg-rose-500/10 border border-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
          : 'text-neutral-400 hover:text-neutral-200 bg-white/5 hover:bg-white/10 border border-white/10'
      } ${stateClasses} ${className}`}
      style={{ padding: label || count !== undefined ? '6px 12px' : '8px' }}
    >
      {/* Icon container with particle burst */}
      <div className="relative inline-flex items-center justify-center">
        {/* Burst particles */}
        {isAnimating && (
          <div
            key={burstKey}
            className="absolute inset-0 pointer-events-none flex items-center justify-center"
            style={{ width: size, height: size }}
          >
            {SPARKS.map((spark) => (
              <span
                key={spark.id}
                className="absolute rounded-full bg-rose-400 shadow-[0_0_4px_#f43f5e]"
                style={{
                  width: spark.sparkSize,
                  height: spark.sparkSize,
                  '--spark-tx': `${spark.tx}px`,
                  '--spark-ty': `${spark.ty}px`,
                  animation: 'likeSparkBurst 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                } as React.CSSProperties}
              />
            ))}
          </div>
        )}

        {/* State icons */}
        {isLoading ? (
          <Loader2 size={size} className="animate-spin text-rose-400" />
        ) : isError ? (
          <AlertCircle size={size} className="text-amber-400" />
        ) : isSuccess ? (
          <Check size={size} className="text-emerald-400" />
        ) : (
          <Heart
            size={size}
            fill={activeLiked ? 'currentColor' : 'none'}
            className={`transition-all duration-300 ${
              isAnimating ? 'animate-like-heart-pop' : ''
            } ${activeLiked ? 'text-rose-500 drop-shadow-[0_0_6px_rgba(244,63,94,0.4)]' : ''}`}
          />
        )}
      </div>

      {/* Optional Label or Count */}
      {label && <span>{label}</span>}
      {count !== undefined && (
        <span className={`text-xs tabular-nums ${activeLiked ? 'text-rose-400 font-semibold' : 'text-neutral-400'}`}>
          {count + (activeLiked && !isLiked ? 1 : !activeLiked && isLiked ? -1 : 0)}
        </span>
      )}
    </button>
  );
};

export default LikeBurstButton;
