import { useDeferredValue, useEffect, useRef, useState } from "react";
import { APP_VIEWS } from "../navigation/views";

export function useAppProviderSearch(selectedGroup: string) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedGroup === APP_VIEWS.home) {
      setSearchQuery(searchInput);
      return;
    }
    const timer = window.setTimeout(() => setSearchQuery(searchInput), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, selectedGroup]);

  return {
    searchQuery,
    setSearchQuery,
    searchInput,
    setSearchInput,
    searchInputRef,
    deferredSearchQuery: useDeferredValue(searchQuery),
  };
}
