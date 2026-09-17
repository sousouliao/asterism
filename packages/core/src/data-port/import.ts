import type {
  ExportCollectionRepo,
  ExportMemory,
  ExportRepo,
  ImportIssue,
  ImportPayload,
  ImportVersion,
  NormalizedImportData,
  ParsedImportPayload,
} from './types';
import { IMPORT_VERSIONS } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  return typeof value === 'string' ? value : undefined;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  if (!value.every((item) => typeof item === 'string')) {
    return null;
  }
  return value;
}

function isImportVersion(value: unknown): value is ImportVersion {
  return IMPORT_VERSIONS.some((version) => version === value);
}

/** 解析并校验 v3 JSON 导入 payload。 */
export function parseImportJson(raw: string): ParsedImportPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('INVALID_JSON');
  }

  const issues: ImportIssue[] = [];
  if (!isRecord(parsed)) {
    throw new Error('INVALID_SCHEMA');
  }

  if (!isImportVersion(parsed.version)) {
    throw new Error('UNSUPPORTED_VERSION');
  }

  const exportedAt = readString(parsed.exportedAt);
  if (!exportedAt) {
    issues.push({ kind: 'warning', message: 'Missing exportedAt' });
  }

  const collections = parseCollections(parsed.collections, issues);
  const repos = parseRepos(parsed.repos, issues);
  const collectionRepos = parseCollectionRepos(parsed.collectionRepos, issues);
  const memories = parseMemories(parsed.memories, issues);

  const payload: ImportPayload = {
    version: parsed.version,
    exportedAt: exportedAt ?? new Date().toISOString(),
    collections,
    repos,
    collectionRepos,
    memories,
  };

  if (issues.some((issue) => issue.kind === 'error')) {
    throw new Error('INVALID_SCHEMA');
  }

  return { payload };
}

/** 从 payload 提取可写入数据库的组织数据（不含 repos 本体）。 */
export function normalizeImportData(payload: ImportPayload): NormalizedImportData {
  return {
    collections: payload.collections,
    collectionRepos: payload.collectionRepos,
    memories: payload.memories.filter(
      (memory) => Boolean(memory.whySaved?.trim()) || Boolean(memory.note?.trim()),
    ),
  };
}

function parseCollections(value: unknown, issues: ImportIssue[]) {
  if (!Array.isArray(value)) {
    issues.push({ kind: 'error', message: 'collections must be an array' });
    return [];
  }
  const collections = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    const name = readString(item.name)?.trim();
    if (!name) {
      continue;
    }
    const description =
      item.description === null ? null : readString(item.description)?.trim() || null;
    collections.push({ name, description });
  }
  return collections;
}

function parseRepos(value: unknown, issues: ImportIssue[]) {
  if (!Array.isArray(value)) {
    issues.push({ kind: 'error', message: 'repos must be an array' });
    return [];
  }
  const repos: ExportRepo[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    const fullName = readString(item.fullName)?.trim();
    if (!fullName) {
      continue;
    }
    repos.push({
      fullName,
      starredAt: readString(item.starredAt),
      language: item.language === null ? null : readString(item.language),
      description: item.description === null ? null : readString(item.description),
      topics: readStringArray(item.topics) ?? [],
      stargazers: typeof item.stargazers === 'number' ? item.stargazers : 0,
      forks: typeof item.forks === 'number' ? item.forks : null,
      archived: Boolean(item.archived),
      pushedAt: item.pushedAt === null ? null : readString(item.pushedAt),
    });
  }
  return repos;
}

function parseCollectionRepos(value: unknown, issues: ImportIssue[]) {
  if (!Array.isArray(value)) {
    issues.push({ kind: 'error', message: 'collectionRepos must be an array' });
    return [];
  }
  const links: ExportCollectionRepo[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    const collectionName = readString(item.collectionName)?.trim();
    const fullName = readString(item.fullName)?.trim();
    if (collectionName && fullName) {
      links.push({ collectionName, fullName });
    }
  }
  return links;
}

function parseMemories(value: unknown, issues: ImportIssue[]): ExportMemory[] {
  if (!Array.isArray(value)) {
    issues.push({ kind: 'error', message: 'memories must be an array' });
    return [];
  }

  const memories: ExportMemory[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    const fullName = readString(item.fullName)?.trim();
    const sourceCreatedAt = readNullableString(item.sourceCreatedAt);
    const whySaved = readNullableString(item.whySaved);
    const note = readNullableString(item.note);
    if (
      fullName &&
      item.source === 'github_star' &&
      sourceCreatedAt !== undefined &&
      whySaved !== undefined &&
      note !== undefined
    ) {
      memories.push({ fullName, source: 'github_star', sourceCreatedAt, whySaved, note });
    }
  }
  return memories;
}
