import type { AskTurn } from '../data/use-ask-question';

/** 单场 Ask 会话持久化记录。 */
export interface AskSessionRecord {
  /** 唯一标识符（UUID）。 */
  id: string;
  /** 会话标题（默认取首问前 40 字符摘要）。 */
  title: string;
  /** 创建时间（epoch ms）。 */
  createdAt: number;
  /** 最近更新/追问时间（epoch ms）。 */
  updatedAt: number;
  /** 会话包含的所有问答轮次。 */
  turns: AskTurn[];
}

/** 7 天自然保留时长（毫秒）。 */
export const ASK_SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
/** 休假防全白保底场数。 */
export const ASK_SESSION_MIN_FLOOR = 5;
export const ASK_SESSION_MAX_CEILING = 30;

const DB_NAME = 'asterism-ask';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const LOCAL_STORAGE_FALLBACK_KEY = 'asterism:ask-sessions:v1';

/**
 * 纯函数：执行「7 天自然淘汰 + 保底 5 场 / 上限 30 场」策略。
 * 1. 按 updatedAt 倒序排序；
 * 2. 封顶最多 30 场；
 * 3. 超过 7 天未活动的会话剔除，但若剩余不足 5 场，保底保留最新的 5 场。
 */
export function applySessionEviction(
  sessions: readonly AskSessionRecord[],
  now: number = Date.now(),
): AskSessionRecord[] {
  if (sessions.length === 0) {
    return [];
  }

  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  const capped = sorted.slice(0, ASK_SESSION_MAX_CEILING);
  const cutoffTime = now - ASK_SESSION_RETENTION_MS;
  const recent = capped.filter((s) => s.updatedAt >= cutoffTime);

  if (recent.length >= ASK_SESSION_MIN_FLOOR) {
    return recent;
  }

  // 若 7 天内保留的少于保底场数，保留 capped 中最新的 min(length, MIN_FLOOR) 场
  return capped.slice(0, Math.min(capped.length, ASK_SESSION_MIN_FLOOR));
}

/** 生成符合标题规格的会话标题（首问截断前 40 字符）。 */
export function formatSessionTitle(firstQuestion: string): string {
  const trimmed = firstQuestion.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 40) {
    return trimmed;
  }
  return `${trimmed.slice(0, 39)}…`;
}

function isIndexedDbAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
  } catch {
    return false;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readFromLocalStorage(): AskSessionRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeToLocalStorage(sessions: AskSessionRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(sessions));
  } catch {
    // 忽略 localStorage 配额错误
  }
}

/**
 * 读取所有会话，并在读取时自动应用淘汰策略。
 */
export async function getAskSessions(now: number = Date.now()): Promise<AskSessionRecord[]> {
  let all: AskSessionRecord[] = [];

  if (isIndexedDbAvailable()) {
    try {
      const db = await openDatabase();
      all = await new Promise<AskSessionRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      all = readFromLocalStorage();
    }
  } else {
    all = readFromLocalStorage();
  }

  const pruned = applySessionEviction(all, now);

  // 如果发生了淘汰，异步更新存储保持一致
  if (pruned.length !== all.length) {
    persistPrunedSessions(pruned).catch(() => {});
  }

  return pruned;
}

/** 保存或更新单个会话记录。 */
export async function saveAskSession(session: AskSessionRecord): Promise<void> {
  if (isIndexedDbAvailable()) {
    try {
      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(session);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      return;
    } catch {
      // 降级到 localStorage
    }
  }

  const existing = readFromLocalStorage();
  const next = [session, ...existing.filter((s) => s.id !== session.id)];
  writeToLocalStorage(applySessionEviction(next));
}

/** 删除指定会话。 */
export async function deleteAskSession(sessionId: string): Promise<void> {
  if (isIndexedDbAvailable()) {
    try {
      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(sessionId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      return;
    } catch {
      // 降级
    }
  }

  const existing = readFromLocalStorage();
  writeToLocalStorage(existing.filter((s) => s.id !== sessionId));
}

/** 清空所有本地会话历史。 */
export async function clearAllAskSessions(): Promise<void> {
  if (isIndexedDbAvailable()) {
    try {
      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // 降级
    }
  }

  try {
    localStorage.removeItem(LOCAL_STORAGE_FALLBACK_KEY);
  } catch {}
}

async function persistPrunedSessions(sessions: AskSessionRecord[]): Promise<void> {
  if (isIndexedDbAvailable()) {
    try {
      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        for (const s of sessions) {
          store.put(s);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return;
    } catch {}
  }
  writeToLocalStorage(sessions);
}
