import { useCallback, useEffect, useRef, useState } from "react";

import type { City } from "@globber/shared/types/city";

import { searchCities } from "@/services/cityService";

type UseCitySearchOptions = {
  debounceDelay?: number;
};

type UseCitySearchReturn = {
  searchResults: City[];
  isSearching: boolean;
  searchError: string | null;
  searchKeyword: string;
  setSearchKeyword: (keyword: string) => void;
  clearSearch: () => void;
  hasSearched: boolean;
};

export const useCitySearch = ({ debounceDelay = 500 }: UseCitySearchOptions = {}): UseCitySearchReturn => {
  const latestRequestIdRef = useRef(0);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<City[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (searchKeyword.trim()) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [searchKeyword]);

  const performSearch = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setSearchResults([]);
      setSearchError(null);
      setHasSearched(false);
      return;
    }

    const requestId = ++latestRequestIdRef.current;
    setSearchError(null);

    try {
      const results = await searchCities(keyword);
      if (requestId === latestRequestIdRef.current) {
        setSearchResults(results);
        setHasSearched(true);
      }
    } catch (error) {
      if (requestId === latestRequestIdRef.current) {
        setSearchError(error instanceof Error ? error.message : "검색 중 오류가 발생했습니다");
        setSearchResults([]);
        setHasSearched(true);
      }
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setIsSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchKeyword);
    }, debounceDelay);

    return () => clearTimeout(timeoutId);
  }, [searchKeyword, performSearch, debounceDelay]);

  const clearSearch = useCallback(() => {
    setSearchKeyword("");
    setSearchResults([]);
    setSearchError(null);
    setHasSearched(false);
  }, []);

  return {
    searchResults,
    isSearching,
    searchError,
    searchKeyword,
    setSearchKeyword,
    clearSearch,
    hasSearched,
  };
};
