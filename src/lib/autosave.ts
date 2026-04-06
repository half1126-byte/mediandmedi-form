'use client';

import { useEffect, useRef, useCallback } from 'react';

const STORAGE_PREFIX = 'mediandmedi-form-';
const DEBOUNCE_MS = 2000;
const BACKUP_INTERVAL_MS = 30000;

function getStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    storage.setItem('__test__', '1');
    storage.removeItem('__test__');
    return storage;
  } catch {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }
}

export function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export interface SavedFormData {
  sessionId: string;
  clinicName?: string;
  currentStep: number;
  totalSteps: number;
  data: Record<string, unknown>;
  savedAt: string;
  submitted?: boolean;
}

function getKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}`;
}

export function saveForm(sessionId: string, data: SavedFormData): boolean {
  const storage = getStorage();
  if (!storage) return false;

  try {
    storage.setItem(getKey(sessionId), JSON.stringify(data));
    return true;
  } catch {
    // localStorage 용량 초과 시 오래된 데이터 정리
    cleanOldSaves(storage);
    try {
      storage.setItem(getKey(sessionId), JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }
}

export function loadForm(sessionId: string): SavedFormData | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(getKey(sessionId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearForm(sessionId: string): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(getKey(sessionId));
}

export function findExistingSaves(): SavedFormData[] {
  const storage = getStorage();
  if (!storage) return [];

  const saves: SavedFormData[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      try {
        const data = JSON.parse(storage.getItem(key) || '');
        if (data && !data.submitted) {
          saves.push(data);
        }
      } catch {
        // 파싱 실패한 항목은 무시
      }
    }
  }

  return saves.sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
}

function cleanOldSaves(storage: Storage): void {
  const keys: { key: string; time: number }[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      try {
        const data = JSON.parse(storage.getItem(key) || '');
        keys.push({ key, time: new Date(data.savedAt).getTime() });
      } catch {
        storage.removeItem(key!);
      }
    }
  }

  // 가장 오래된 것부터 삭제 (최대 3개 유지)
  keys.sort((a, b) => a.time - b.time);
  while (keys.length > 3) {
    const oldest = keys.shift()!;
    storage.removeItem(oldest.key);
  }
}

export function useAutosave(
  sessionId: string,
  getData: () => SavedFormData,
  deps: unknown[] = []
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backupRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const save = useCallback(() => {
    saveForm(sessionId, getData());
  }, [sessionId, getData]);

  // Debounced save on data change
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // 30초 백업
  useEffect(() => {
    backupRef.current = setInterval(save, BACKUP_INTERVAL_MS);
    return () => {
      if (backupRef.current) clearInterval(backupRef.current);
    };
  }, [save]);

  // beforeunload
  useEffect(() => {
    const handler = () => save();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [save]);

  // 즉시 저장 (스텝 이동 시 호출)
  return { saveNow: save };
}
