import { useCallback, useState } from "react";
import {
  sanitizeRecentList,
  toRecentEntry,
  type SpotlightMatch,
} from "../components/spotlight/spotlightHelpers";

const RECENT_SEARCHES_KEY = "strmly_recent_searches:v1";
const QUERY_HISTORY_KEY = "strmly_search_query_history:v1";

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota/private-mode failures must not block search.
  }
}

export function useSpotlightHistory() {
  const [recentSearches, setRecentSearches] = useState<SpotlightMatch[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      return sanitizeRecentList(saved ? JSON.parse(saved) : []);
    } catch {
      return [];
    }
  });
  const [queryHistory, setQueryHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(QUERY_HISTORY_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed)
        ? parsed
            .filter((entry) => typeof entry === "string" && entry.trim())
            .slice(0, 12)
        : [];
    } catch {
      return [];
    }
  });

  const saveQuery = useCallback((term: string) => {
    const clean = term.trim();
    if (!clean || clean.length < 2) return;
    setQueryHistory((previous) => {
      const filtered = previous.filter(
        (query) => query.toLowerCase() !== clean.toLowerCase(),
      );
      const updated = [clean, ...filtered].slice(0, 12);
      writeStorage(QUERY_HISTORY_KEY, updated);
      return updated;
    });
  }, []);

  const removeQuery = useCallback((term: string) => {
    setQueryHistory((previous) => {
      const updated = previous.filter(
        (query) => query.toLowerCase() !== term.toLowerCase(),
      );
      writeStorage(QUERY_HISTORY_KEY, updated);
      return updated;
    });
  }, []);

  const clearQueries = useCallback(() => {
    setQueryHistory([]);
    localStorage.removeItem(QUERY_HISTORY_KEY);
  }, []);

  const saveRecent = useCallback((match: SpotlightMatch) => {
    const entry = toRecentEntry(match);
    if (!entry) return;
    setRecentSearches((previous) => {
      const filtered = previous.filter((item) => item.item?.id !== entry.item.id);
      const updated = [entry, ...filtered].slice(0, 12);
      writeStorage(RECENT_SEARCHES_KEY, updated);
      return updated;
    });
  }, []);

  const removeRecent = useCallback((id: string) => {
    setRecentSearches((previous) => {
      const updated = previous.filter(
        (item) => String(item.item?.id) !== String(id),
      );
      writeStorage(RECENT_SEARCHES_KEY, updated);
      return updated;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  }, []);

  return {
    recentSearches,
    queryHistory,
    saveQuery,
    removeQuery,
    clearQueries,
    saveRecent,
    removeRecent,
    clearRecent,
  };
}
