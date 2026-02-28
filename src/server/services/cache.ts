import { stat } from "fs/promises";
import type { ParsedSession } from "./parser";

interface CacheEntry {
  session: ParsedSession;
  mtime: number;
}

const cache = new Map<string, CacheEntry>();

export async function getCachedSession(
  sessionId: string,
  filePath: string,
  parser: (filePath: string, sessionId: string, projectId: string) => Promise<ParsedSession>,
  projectId: string
): Promise<ParsedSession> {
  const s = await stat(filePath);
  const mtime = s.mtime.getTime();
  const existing = cache.get(sessionId);

  if (existing && existing.mtime === mtime) {
    return existing.session;
  }

  const session = await parser(filePath, sessionId, projectId);
  cache.set(sessionId, { session, mtime });
  return session;
}

export function invalidateSession(sessionId: string): void {
  cache.delete(sessionId);
}

export function invalidateAll(): void {
  cache.clear();
}

export function getCacheStats(): { size: number } {
  return { size: cache.size };
}
