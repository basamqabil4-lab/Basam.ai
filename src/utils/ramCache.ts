import type { PromptResult } from '../services/geminiService';

const MAX_RAM_CACHE_ENTRIES = 30;
const ramCache = new Map<string, PromptResult[]>();

function hashString(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16)}-${(h2 >>> 0).toString(16)}-${input.length}`;
}

function normalizeForKey(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.startsWith('data:') ? `img:${hashString(value)}` : value;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeForKey);
  }
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const prop = (value as Record<string, unknown>)[key];
      if (prop !== undefined) {
        sorted[key] = normalizeForKey(prop);
      }
    }
    return sorted;
  }
  return value;
}

export function buildRequestCacheKey(payload: unknown): string {
  return JSON.stringify(normalizeForKey(payload));
}

export function getCachedPrompts(cacheKey: string): PromptResult[] | null {
  const hit = ramCache.get(cacheKey);
  if (!hit) return null;
  // Refresh LRU recency
  ramCache.delete(cacheKey);
  ramCache.set(cacheKey, hit);
  return hit;
}

export function setCachedPrompts(cacheKey: string, results: PromptResult[]): void {
  if (!results || results.length === 0 || results.some((r) => r.isError)) {
    return;
  }
  if (ramCache.has(cacheKey)) {
    ramCache.delete(cacheKey);
  } else if (ramCache.size >= MAX_RAM_CACHE_ENTRIES) {
    const oldestKey = ramCache.keys().next().value;
    if (oldestKey !== undefined) {
      ramCache.delete(oldestKey);
    }
  }
  ramCache.set(cacheKey, results);
}
