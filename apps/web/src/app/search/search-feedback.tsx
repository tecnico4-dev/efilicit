"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

/** Disparado por «Limpiar campos» para resetear widgets controlados (p. ej. CPV). */
export const CLEAR_SEARCH_EVENT = "efilicit:clear-search";

type Feedback = {
  text: string;
  isError: boolean;
  linkHref?: string;
  linkLabel?: string;
} | null;

type SearchFeedbackApi = {
  feedback: Feedback;
  setFeedback: (next: Feedback) => void;
  clearFeedback: () => void;
};

const SearchFeedbackContext = createContext<SearchFeedbackApi | null>(null);

export function SearchFeedbackProvider({ children }: { children: ReactNode }) {
  const [feedback, setFeedbackState] = useState<Feedback>(null);
  const setFeedback = useCallback((next: Feedback) => {
    setFeedbackState(next);
  }, []);
  const clearFeedback = useCallback(() => setFeedbackState(null), []);

  return (
    <SearchFeedbackContext.Provider
      value={{ feedback, setFeedback, clearFeedback }}
    >
      {children}
    </SearchFeedbackContext.Provider>
  );
}

export function useSearchFeedback(): SearchFeedbackApi {
  const ctx = useContext(SearchFeedbackContext);
  if (!ctx) {
    throw new Error("useSearchFeedback debe usarse dentro de SearchFeedbackProvider");
  }
  return ctx;
}
