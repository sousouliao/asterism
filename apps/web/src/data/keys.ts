export const repoKeys = {
  all: ['repos'] as const,
  starred: (userId: string) => ['repos', 'starred', userId] as const,
  readme: (userId: string, owner: string, name: string) =>
    ['repos', 'readme', userId, owner.toLowerCase(), name.toLowerCase()] as const,
};

export const collectionKeys = {
  all: ['collections'] as const,
  list: (userId: string) => ['collections', userId] as const,
};

export const collectionRepoKeys = {
  all: ['collection-repos'] as const,
  list: (userId: string) => ['collection-repos', userId] as const,
};

export const memoryKeys = {
  all: ['memory'] as const,
  list: (userId: string) => ['memory', userId, 'list'] as const,
  noteRepoIds: (userId: string) => ['memory', userId, 'note-repo-ids'] as const,
  detail: (userId: string, repoId: string) => ['memory', userId, repoId] as const,
};

export const bulkOperationKeys = {
  all: ['bulk-operations'] as const,
  list: (userId: string) => ['bulk-operations', userId] as const,
};

export const embeddingKeys = {
  all: ['embeddings'] as const,
  search: (userId: string, query: string) => ['embeddings', 'search', userId, query] as const,
  list: (userId: string) => ['embeddings', 'list', userId] as const,
};

export const aiConnectionKeys = {
  all: ['ai-connections'] as const,
  list: (userId: string) => ['ai-connections', userId] as const,
};

export const aiSettingsKeys = {
  all: ['ai-settings'] as const,
  detail: (userId: string) => ['ai-settings', userId] as const,
};
