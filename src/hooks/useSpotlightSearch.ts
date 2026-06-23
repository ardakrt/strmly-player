import { useState, useEffect, useRef, useDeferredValue } from 'react';

interface UseSpotlightSearchProps {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function useSpotlightSearch({ searchInputRef }: UseSpotlightSearchProps) {
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [spotlightSearchInput, setSpotlightSearchInput] = useState('');
  const [spotlightScope, setSpotlightScope] = useState<'all' | 'live' | 'movie' | 'series'>('all');
  const [spotlightActiveStep, setSpotlightActiveStep] = useState<'select_scope' | 'searching'>('select_scope');
  const [focusedButtonIndex, setFocusedButtonIndex] = useState<number>(0);
  const spotlightInputRef = useRef<HTMLInputElement>(null);
  
  const deferredSpotlightSearchInput = useDeferredValue(spotlightSearchInput);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Spotlight Modal on Ctrl+K / Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSpotlight(prev => !prev);
      }

      // Close Spotlight Modal on Escape
      if (e.key === 'Escape' && showSpotlight) {
        e.preventDefault();
        setShowSpotlight(false);
      }

      // Handle spotlight menu navigation when spotlight is open and in selection step
      if (showSpotlight && spotlightActiveStep === 'select_scope') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedButtonIndex(prev => (prev + 1) % 3);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedButtonIndex(prev => (prev - 1 + 3) % 3);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          // Select current option: index 0 -> series, index 1 -> movie, index 2 -> live
          const scopes: Array<'series' | 'movie' | 'live'> = ['series', 'movie', 'live'];
          setSpotlightScope(scopes[focusedButtonIndex]);
          setSpotlightActiveStep('searching');
        }
      }

      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        // Focus spotlight search instead of regular search if available, otherwise regular search
        if (showSpotlight) {
          if (spotlightActiveStep === 'searching') {
            spotlightInputRef.current?.focus();
          }
        } else {
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSpotlight, spotlightActiveStep, focusedButtonIndex, searchInputRef]);

  // Autofocus spotlight input when searching is activated, reset when spotlight opens/closes
  useEffect(() => {
    if (showSpotlight) {
      setSpotlightActiveStep('select_scope');
      setFocusedButtonIndex(0);
      setSpotlightSearchInput('');
      (document.activeElement as HTMLElement)?.blur();
    } else {
      setSpotlightSearchInput('');
    }
  }, [showSpotlight]);

  useEffect(() => {
    if (showSpotlight && spotlightActiveStep === 'searching') {
      const timer = setTimeout(() => {
        spotlightInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [spotlightActiveStep, showSpotlight]);

  return {
    showSpotlight,
    setShowSpotlight,
    spotlightSearchInput,
    setSpotlightSearchInput,
    spotlightScope,
    setSpotlightScope,
    spotlightActiveStep,
    setSpotlightActiveStep,
    focusedButtonIndex,
    setFocusedButtonIndex,
    spotlightInputRef,
    deferredSpotlightSearchInput,
  };
}
