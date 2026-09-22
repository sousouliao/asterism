import type { Repo } from '../models/repo';

const GITHUB_GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
const STARRED_PAGE_SIZE = 100;

/**
 * GitHub GraphQL 查询：按 STARRED_AT 倒序拉取 viewer 的 starred 仓库（游标分页）。
 * 这是纯查询串，平台无关；Edge Function 侧有一份对应实现，二者以本包单测为权威保持一致
 * （见 decisions/0006）。
 */
export const STARRED_REPOS_QUERY = `
query StarredRepos($cursor: String, $pageSize: Int!) {
  viewer {
    starredRepositories(
      first: $pageSize
      after: $cursor
      orderBy: { field: STARRED_AT, direction: DESC }
    ) {
      pageInfo { hasNextPage endCursor }
      edges {
        starredAt
        node {
          databaseId
          name
          nameWithOwner
          owner { login }
          description
          primaryLanguage { name }
          repositoryTopics(first: 20) { nodes { topic { name } } }
          stargazerCount
          forkCount
          homepageUrl
          pushedAt
          createdAt
          isArchived
          isFork
        }
      }
    }
  }
}`;

export interface StarredRepo {
  repo: Repo;
  starredAt: string;
}

export interface StarredPage {
  repos: StarredRepo[];
  hasNextPage: boolean;
  endCursor: string | null;
}

export type FetchStarredPage = (cursor: string | null) => Promise<StarredPage>;

export class GitHubSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubSyncError';
  }
}

export interface RawStarEdge {
  starredAt: string;
  node: {
    databaseId: number | null;
    name: string;
    nameWithOwner: string;
    owner: { login: string };
    description: string | null;
    primaryLanguage: { name: string } | null;
    repositoryTopics: { nodes: { topic: { name: string } }[] };
    stargazerCount: number;
    forkCount: number;
    homepageUrl: string | null;
    pushedAt: string | null;
    createdAt: string | null;
    isArchived: boolean;
    isFork: boolean;
  };
}

interface RawStarredResponse {
  data?: {
    viewer: {
      starredRepositories: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        edges: RawStarEdge[];
      };
    };
  };
  errors?: { message: string }[];
}

/** 把一条 GraphQL star 边映射为领域 `Repo` + starredAt。`syncedAt` 由编排方注入。 */
export function mapStarEdgeToRepo(edge: RawStarEdge, syncedAt: string): StarredRepo {
  const { node } = edge;
  return {
    starredAt: edge.starredAt,
    repo: {
      githubId: node.databaseId ?? 0,
      fullName: node.nameWithOwner,
      name: node.name,
      owner: node.owner.login,
      description: node.description,
      language: node.primaryLanguage?.name ?? null,
      topics: node.repositoryTopics.nodes.map((entry) => entry.topic.name),
      stargazers: node.stargazerCount,
      forks: node.forkCount,
      homepage: node.homepageUrl,
      pushedAt: node.pushedAt,
      repoCreatedAt: node.createdAt,
      archived: node.isArchived,
      isFork: node.isFork,
      syncedAt,
    },
  };
}

/** 基于注入的 `fetch` 构造单页拉取函数（默认用全局 fetch，便于在测试/Deno 中替换）。 */
export function createGitHubStarsFetcher(
  token: string,
  fetchImpl: typeof fetch = fetch,
): FetchStarredPage {
  return async (cursor) => {
    let response: Response;
    try {
      response = await fetchImpl(GITHUB_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: STARRED_REPOS_QUERY,
          variables: { cursor, pageSize: STARRED_PAGE_SIZE },
        }),
      });
    } catch (cause) {
      throw new GitHubSyncError(`GitHub request failed: ${(cause as Error).message}`);
    }

    if (!response.ok) {
      throw new GitHubSyncError(`GitHub GraphQL responded with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as RawStarredResponse;
    if (payload.errors?.length) {
      throw new GitHubSyncError(payload.errors.map((entry) => entry.message).join('; '));
    }

    const connection = payload.data?.viewer.starredRepositories;
    if (!connection) {
      throw new GitHubSyncError('GitHub GraphQL response was malformed');
    }

    const syncedAt = new Date().toISOString();
    return {
      repos: connection.edges.map((edge) => mapStarEdgeToRepo(edge, syncedAt)),
      hasNextPage: connection.pageInfo.hasNextPage,
      endCursor: connection.pageInfo.endCursor,
    };
  };
}

/**
 * 遍历全部游标页，收集当前 Star 快照。缺页或缺仓库 ID 时抛错，调用方不得对账部分结果。
 */
export async function collectStarredRepos(fetchPage: FetchStarredPage): Promise<StarredRepo[]> {
  const collected: StarredRepo[] = [];
  let cursor: string | null = null;

  for (;;) {
    const page = await fetchPage(cursor);
    for (const item of page.repos) {
      if (item.repo.githubId <= 0) {
        throw new GitHubSyncError('GitHub returned a repository without an ID');
      }
      collected.push(item);
    }
    if (page.hasNextPage && (!page.endCursor || page.endCursor === cursor)) {
      throw new GitHubSyncError('GitHub pagination ended before the final page');
    }
    if (!page.hasNextPage) {
      break;
    }
    cursor = page.endCursor;
  }

  return collected;
}
