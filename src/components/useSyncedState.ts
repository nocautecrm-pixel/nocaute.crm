"use client";

import { useCallback, useState, type SetStateAction } from "react";

/** Local edits survive rerenders, but a new server snapshot replaces them. */
export function useSyncedState<T>(input: T) {
  const [state, setState] = useState({ input, value: input });
  if (state.input !== input) setState({ input, value: input });
  const setValue = useCallback((next: SetStateAction<T>) => {
    setState((current) => ({
      ...current,
      value: typeof next === "function" ? (next as (value: T) => T)(current.value) : next,
    }));
  }, []);
  return [state.input === input ? state.value : input, setValue] as const;
}
