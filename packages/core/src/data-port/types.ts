export const EXPORT_VERSION = 3 as const;
export const IMPORT_VERSIONS = [3] as const;

export type ImportVersion = (typeof IMPORT_VERSIONS)[number];

export interface ExportCollection {
  name: string;
  description: string | null;
}

export interface ExportRepo {
  fullName: string;
  starredAt: string | null;
  language: string | null;
  description: string | null;
  topics: string[];
  stargazers: number;
  forks: number | null;
  archived: boolean;
  pushedAt: string | null;
}

export interface ExportCollectionRepo {
  collectionName: string;
  fullName: string;
}

export interface ExportMemory {
  fullName: string;
  source: 'github_star';
  sourceCreatedAt: string | null;
  whySaved: string | null;
  note: string | null;
}

export interface ExportPayloadV3 {
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  counts: {
    repos: number;
    collections: number;
    memories: number;
  };
  collections: ExportCollection[];
  repos: ExportRepo[];
  collectionRepos: ExportCollectionRepo[];
  memories: ExportMemory[];
}

export type ExportPayload = ExportPayloadV3;

export interface ExportSnapshot {
  collections: ExportCollection[];
  repos: ExportRepo[];
  collectionRepos: ExportCollectionRepo[];
  memories: ExportMemory[];
}

export interface ImportPayload {
  version: ImportVersion;
  exportedAt: string;
  collections: ExportCollection[];
  repos: ExportRepo[];
  collectionRepos: ExportCollectionRepo[];
  memories: ExportMemory[];
}

export interface ParsedImportPayload {
  payload: ImportPayload;
}

export interface ImportIssue {
  kind: 'warning' | 'error';
  message: string;
}

export interface NormalizedImportData {
  collections: ExportCollection[];
  collectionRepos: ExportCollectionRepo[];
  memories: ExportMemory[];
}
