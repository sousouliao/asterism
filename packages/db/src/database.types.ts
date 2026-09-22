/**
 * 手写的 Supabase `Database` 类型，结构对齐 `supabase/migrations/`（snake_case 列）。
 * 待具备线上项目 / CLI 条件后，应以 `supabase gen types typescript` 重新生成覆盖本文件
 * （见 BACKLOG 与 decisions/0006）。
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      repos: {
        Row: {
          id: string;
          github_id: number;
          full_name: string;
          name: string;
          owner: string;
          description: string | null;
          language: string | null;
          topics: string[];
          stargazers: number;
          forks: number | null;
          homepage: string | null;
          pushed_at: string | null;
          repo_created_at: string | null;
          archived: boolean;
          is_fork: boolean | null;
          synced_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          github_id: number;
          full_name: string;
          name: string;
          owner: string;
          description?: string | null;
          language?: string | null;
          topics?: string[];
          stargazers?: number;
          forks?: number | null;
          homepage?: string | null;
          pushed_at?: string | null;
          repo_created_at?: string | null;
          archived?: boolean;
          is_fork?: boolean | null;
          synced_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['repos']['Insert']>;
        Relationships: [];
      };
      user_stars: {
        Row: {
          id: string;
          user_id: string;
          repo_id: string;
          starred_at: string | null;
          unstarred_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          repo_id: string;
          starred_at?: string | null;
          unstarred_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['user_stars']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'user_stars_repo_id_fkey';
            columns: ['repo_id'];
            isOneToOne: false;
            referencedRelation: 'repos';
            referencedColumns: ['id'];
          },
        ];
      };
      collections: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['collections']['Insert']>;
        Relationships: [];
      };
      collection_repos: {
        Row: {
          id: string;
          user_id: string;
          collection_id: string;
          repo_id: string;
          position: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          collection_id: string;
          repo_id: string;
          position?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['collection_repos']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'collection_repos_collection_id_fkey';
            columns: ['collection_id'];
            isOneToOne: false;
            referencedRelation: 'collections';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'collection_repos_repo_id_fkey';
            columns: ['repo_id'];
            isOneToOne: false;
            referencedRelation: 'repos';
            referencedColumns: ['id'];
          },
        ];
      };
      bulk_operations: {
        Row: {
          id: string;
          user_id: string;
          source: 'manual' | 'promotion';
          interaction: 'bulk_dialog';
          client_request_id: string;
          source_repo_ids: string[];
          status: 'pending' | 'running' | 'needs_attention' | 'completed';
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source: 'manual' | 'promotion';
          interaction?: 'bulk_dialog';
          client_request_id?: string;
          source_repo_ids: string[];
          status?: 'pending' | 'running' | 'needs_attention' | 'completed';
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['bulk_operations']['Insert']>;
        Relationships: [];
      };
      bulk_operation_items: {
        Row: {
          id: string;
          user_id: string;
          operation_id: string;
          repo_id: string;
          relation_type: 'tag' | 'collection';
          target_id: string;
          action: 'add' | 'remove';
          status:
            | 'pending'
            | 'running'
            | 'succeeded'
            | 'retryable_failed'
            | 'terminal_failed'
            | 'dismissed';
          attempt_count: number;
          last_error_code: string | null;
          last_error_message: string | null;
          effective_changed: boolean;
          effective_mutation_id: string | null;
          effective_relation_version: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          operation_id: string;
          repo_id: string;
          relation_type: 'tag' | 'collection';
          target_id: string;
          action: 'add' | 'remove';
          status?:
            | 'pending'
            | 'running'
            | 'succeeded'
            | 'retryable_failed'
            | 'terminal_failed'
            | 'dismissed';
          attempt_count?: number;
          last_error_code?: string | null;
          last_error_message?: string | null;
          effective_changed?: boolean;
          effective_mutation_id?: string | null;
          effective_relation_version?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['bulk_operation_items']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'bulk_operation_items_operation_id_fkey';
            columns: ['operation_id'];
            isOneToOne: false;
            referencedRelation: 'bulk_operations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bulk_operation_items_repo_id_fkey';
            columns: ['repo_id'];
            isOneToOne: false;
            referencedRelation: 'repos';
            referencedColumns: ['id'];
          },
        ];
      };
      collection_relation_heads: {
        Row: {
          id: string;
          user_id: string;
          collection_id: string;
          repo_id: string;
          present: boolean;
          version: number;
          effective_mutation_id: string | null;
          last_operation_item_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          collection_id: string;
          repo_id: string;
          present?: boolean;
          version?: number;
          effective_mutation_id?: string | null;
          last_operation_item_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['collection_relation_heads']['Insert']>;
        Relationships: [];
      };
      memories: {
        Row: {
          id: string;
          user_id: string;
          repo_id: string;
          source: 'github_star';
          source_created_at: string | null;
          why_saved: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          repo_id: string;
          source?: 'github_star';
          source_created_at?: string | null;
          why_saved?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['memories']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'memories_repo_id_fkey';
            columns: ['repo_id'];
            isOneToOne: false;
            referencedRelation: 'repos';
            referencedColumns: ['id'];
          },
        ];
      };
      user_repo_embeddings: {
        Row: {
          id: string;
          user_id: string;
          repo_id: string;
          // pgvector `vector(384)` 经 PostgREST 以文本形式（'[..]'）往返；查询层做 number[] 互转。
          embedding: string;
          embedding_model: string;
          content_hash: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          repo_id: string;
          embedding: string;
          embedding_model: string;
          content_hash: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['user_repo_embeddings']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'user_repo_embeddings_repo_id_fkey';
            columns: ['repo_id'];
            isOneToOne: false;
            referencedRelation: 'repos';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      github_sync_status: {
        Args: Record<string, never>;
        Returns: { connected: boolean; last_synced_at: string | null; last_error: string | null }[];
      };
      create_bulk_operation: {
        Args: {
          p_user_id: string;
          p_source: string;
          p_interaction: string;
          p_client_request_id: string;
          p_repo_ids: string[];
          p_changes: Json;
        };
        Returns: string;
      };
      claim_bulk_operation_items: {
        Args: { p_user_id: string; p_operation_id: string; p_statuses: string[] };
        Returns: Database['public']['Tables']['bulk_operation_items']['Row'][];
      };
      record_bulk_operation_item_result: {
        Args: {
          p_user_id: string;
          p_item_id: string;
          p_status: string;
          p_error_code?: string | null;
          p_error_message?: string | null;
          p_effective_changed?: boolean;
          p_effective_mutation_id?: string | null;
          p_effective_relation_version?: number | null;
        };
        Returns: undefined;
      };
      mutate_collection_relation: {
        Args: {
          p_collection_id: string;
          p_repo_id: string;
          p_action: string;
          p_client_request_id: string;
        };
        Returns: Json;
      };
      apply_collection_relation_mutation: {
        Args: {
          p_user_id: string;
          p_collection_id: string;
          p_repo_id: string;
          p_action: string;
          p_operation_item_id?: string | null;
        };
        Returns: Json;
      };
      complete_bulk_operation: {
        Args: { p_user_id: string; p_operation_id: string };
        Returns: boolean;
      };
      search_user_repo_embeddings: {
        Args: { query_embedding: string; match_count?: number };
        Returns: { repo_id: string; distance: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
