// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearRepoDigest,
  readRepoDigest,
  repoDigestStorageKey,
  resetRepoDigestStorageState,
  saveRepoDigest,
} from './repo-digest-storage';

const USER = 'user-test-digest';
const REPO = 'repo-1';

describe('repo-digest-storage', () => {
  beforeEach(() => {
    localStorage.clear();
    resetRepoDigestStorageState();
  });

  afterEach(() => {
    localStorage.clear();
    resetRepoDigestStorageState();
  });

  it('reads null when no digest is stored', () => {
    expect(readRepoDigest(USER, REPO)).toBeNull();
  });

  it('saves and reads digest correctly', () => {
    const data = {
      definition: '无头 Markdown 流式解析库',
      painPoint: '解决流式生成频繁重绘导致的页面跳动',
      scenarios: 'AI 聊天气泡与打字机输出界面',
    };

    saveRepoDigest(USER, REPO, data);
    expect(readRepoDigest(USER, REPO)).toEqual(data);

    const raw = localStorage.getItem(repoDigestStorageKey(USER));
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? '{}')).toMatchObject({
      version: 1,
      entries: {
        [REPO]: data,
      },
    });
  });

  it('clears specific digest correctly', () => {
    const data = {
      definition: '测试定位',
      painPoint: '测试痛点',
      scenarios: '测试场景',
    };

    saveRepoDigest(USER, REPO, data);
    expect(readRepoDigest(USER, REPO)).toEqual(data);

    clearRepoDigest(USER, REPO);
    expect(readRepoDigest(USER, REPO)).toBeNull();
  });
});
