import { useRef } from 'react';
import type { LogMovimento } from '../types';
export function useLogsCache() {
  const cache = useRef<Map<number, LogMovimento[]>>(new Map());
  const get = (id: number) => cache.current.get(id);
  const set = (id: number, data: LogMovimento[]) => cache.current.set(id, data);
  const clear = (id?: number) => { if (typeof id === 'number') cache.current.delete(id); else cache.current.clear(); };
  return { get, set, clear };
}
