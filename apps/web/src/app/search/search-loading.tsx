"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type SearchLoadingApi = {
  searching: boolean;
  setSearching: (next: boolean) => void;
};

const SearchLoadingContext = createContext<SearchLoadingApi | null>(null);

/** Estado de carga RPC compartido entre botón Buscar y panel de resultados. */
export function SearchLoadingProvider({ children }: { children: ReactNode }) {
  const [searching, setSearchingState] = useState(false);
  const setSearching = useCallback((next: boolean) => {
    setSearchingState(next);
  }, []);
  const value = useMemo(
    () => ({ searching, setSearching }),
    [searching, setSearching],
  );

  return (
    <SearchLoadingContext.Provider value={value}>
      {children}
    </SearchLoadingContext.Provider>
  );
}

export function useSearchLoading(): SearchLoadingApi {
  const ctx = useContext(SearchLoadingContext);
  if (!ctx) {
    throw new Error(
      "useSearchLoading debe usarse dentro de SearchLoadingProvider",
    );
  }
  return ctx;
}
