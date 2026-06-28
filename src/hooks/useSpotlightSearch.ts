import { useState, useEffect, useRef, useDeferredValue } from 'react';
import type { PlaylistItem } from '../utils/m3uParser';
import type { GroupedSeries } from '../utils/seriesGroupers';

interface UseSpotlightSearchProps {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  items: PlaylistItem[];
  itemBuckets: { live: PlaylistItem[]; movie: PlaylistItem[]; series: PlaylistItem[] };
  allGroupedSeries: GroupedSeries[];
  hiddenCategories: string[];
  hiddenMovieCategories: string[];
  hiddenSeriesCategories: string[];
}

export function useSpotlightSearch({
  searchInputRef,
  items,
  itemBuckets,
  allGroupedSeries,
  hiddenCategories,
  hiddenMovieCategories,
  hiddenSeriesCategories
}: UseSpotlightSearchProps) {
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [spotlightSearchInput, setSpotlightSearchInput] = useState('');
  const [spotlightScope, setSpotlightScope] = useState<'all' | 'live' | 'movie' | 'series'>('all');
  const [spotlightActiveStep, setSpotlightActiveStep] = useState<'select_scope' | 'searching'>('searching');
  const [focusedButtonIndex, setFocusedButtonIndex] = useState<number>(0);
  const spotlightInputRef = useRef<HTMLInputElement>(null);
  
  const [spotlightSearchResults, setSpotlightSearchResults] = useState<any[]>([]);
  const [isSearchingWorker, setIsSearchingWorker] = useState(false);

  const deferredSpotlightSearchInput = useDeferredValue(spotlightSearchInput);
  
  const workerRef = useRef<Worker | null>(null);
  const lastSearchIdRef = useRef<number>(0);

  // Instantiate worker
  useEffect(() => {
    try {
      workerRef.current = new Worker(new URL('../utils/search.worker.ts', import.meta.url), { type: 'module' });
      
      workerRef.current.onmessage = (e) => {
        if (e.data.action === 'search_results') {
          if (e.data.searchId === lastSearchIdRef.current) {
            setSpotlightSearchResults(e.data.results);
            setIsSearchingWorker(false);
          }
        }
      };
    } catch (err) {
      console.error("Failed to initialize search worker:", err);
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Update worker data
  useEffect(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({
      action: 'set_data',
      items,
      itemBuckets,
      allGroupedSeries,
      hiddenCategories,
      hiddenMovieCategories,
      hiddenSeriesCategories
    });
  }, [items, itemBuckets, allGroupedSeries, hiddenCategories, hiddenMovieCategories, hiddenSeriesCategories]);

  // Trigger search
  useEffect(() => {
    if (!workerRef.current) return;
    const query = deferredSpotlightSearchInput.trim();
    if (!query) {
      setSpotlightSearchResults([]);
      setIsSearchingWorker(false);
      return;
    }

    const searchId = Date.now();
    lastSearchIdRef.current = searchId;
    setIsSearchingWorker(true);

    workerRef.current.postMessage({
      action: 'search',
      query,
      scope: spotlightScope,
      searchId
    });
  }, [deferredSpotlightSearchInput, spotlightScope]);

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
    spotlightSearchResults,
    isSearchingWorker
  };
}
