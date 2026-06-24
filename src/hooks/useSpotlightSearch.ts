import { useState, useEffect, useRef, useDeferredValue } from 'react';

interface UseSpotlightSearchProps {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function useSpotlightSearch({ searchInputRef }: UseSpotlightSearchProps) {
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [spotlightSearchInput, setSpotlightSearchInput] = useState('');
  const [spotlightScope, setSpotlightScope] = useState<'all' | 'live' | 'movie' | 'series'>('all');
  const [spotlightActiveStep, setSpotlightActiveStep] = useState<'select_scope' | 'searching'>('searching');
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

      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (showSpotlight) {
          spotlightInputRef.current?.focus();
        } else {
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSpotlight, searchInputRef]);

  // Autofocus spotlight input when search is opened
  useEffect(() => {
    if (showSpotlight) {
      setSpotlightScope('all');
      setSpotlightActiveStep('searching');
      setSpotlightSearchInput('');
      (document.activeElement as HTMLElement)?.blur();
      
      const timer = setTimeout(() => {
        spotlightInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSpotlightSearchInput('');
    }
  }, [showSpotlight]);

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
