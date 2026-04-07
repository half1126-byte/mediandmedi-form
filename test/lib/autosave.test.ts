import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateSessionId,
  saveForm,
  loadForm,
  clearForm,
  findExistingSaves,
  type SavedFormData,
} from '@/lib/autosave';

// localStorage mock
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
  get length() {
    return Object.keys(mockStorage).length;
  },
  key: vi.fn((index: number) => Object.keys(mockStorage)[index] ?? null),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

function makeSaved(overrides: Partial<SavedFormData> = {}): SavedFormData {
  return {
    sessionId: 'test-session',
    clinicName: '테스트치과',
    currentStep: 1,
    totalSteps: 7,
    data: {},
    savedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('generateSessionId', () => {
  it('UUID 형태 생성', () => {
    const id = generateSessionId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('매번 다른 ID 생성', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateSessionId()));
    expect(ids.size).toBe(10);
  });
});

describe('saveForm / loadForm', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('저장 후 불러오기', () => {
    const data = makeSaved();
    const ok = saveForm('test-1', data);
    expect(ok).toBe(true);

    const loaded = loadForm('test-1');
    expect(loaded).toEqual(data);
  });

  it('없는 세션 불러오기 → null', () => {
    expect(loadForm('nonexistent')).toBeNull();
  });

  it('키 형식: mediandmedi-form-{sessionId}', () => {
    saveForm('abc-123', makeSaved());
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'mediandmedi-form-abc-123',
      expect.any(String)
    );
  });
});

describe('clearForm', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('세션 데이터 삭제', () => {
    saveForm('del-1', makeSaved());
    clearForm('del-1');
    expect(loadForm('del-1')).toBeNull();
  });
});

describe('findExistingSaves', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('미제출 데이터만 반환', () => {
    saveForm('s1', makeSaved({ submitted: false, savedAt: '2026-01-01T10:00:00Z' }));
    saveForm('s2', makeSaved({ submitted: true, savedAt: '2026-01-01T11:00:00Z' }));
    saveForm('s3', makeSaved({ submitted: false, savedAt: '2026-01-01T12:00:00Z' }));

    const saves = findExistingSaves();
    expect(saves.length).toBe(2);
  });

  it('최신순 정렬', () => {
    saveForm('old', makeSaved({ savedAt: '2026-01-01T00:00:00Z' }));
    saveForm('new', makeSaved({ savedAt: '2026-06-01T00:00:00Z' }));

    const saves = findExistingSaves();
    expect(saves[0].savedAt).toBe('2026-06-01T00:00:00Z');
  });
});
