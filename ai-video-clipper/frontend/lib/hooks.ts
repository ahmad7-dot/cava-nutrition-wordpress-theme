"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

/** Fetch JSON and optionally poll while `shouldPoll(data)` is true. */
export function useApi<T>(path: string | null, shouldPoll?: (d: T) => boolean, interval = 2000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef(shouldPoll);
  pollRef.current = shouldPoll;

  const load = useCallback(async () => {
    if (!path) return null;
    try {
      const d = await api.get<T>(path);
      setData(d);
      setError(null);
      return d;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, [path]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    const tick = async () => {
      const d = await load();
      if (alive && d && pollRef.current?.(d)) timer = setTimeout(tick, interval);
    };
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [load, interval]);

  return { data, error, reload: load, setData };
}
