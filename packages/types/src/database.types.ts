export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          created_at: string
          criteria: Json
          frequency: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          criteria?: Json
          frequency?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          criteria?: Json
          frequency?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contracting_authorities: {
        Row: {
          country: string
          created_at: string
          id: string
          identity_confidence: string
          municipality: string | null
          name: string
          name_normalized: string | null
          platform_id: string | null
          tax_id: string | null
          tax_id_country: string
          updated_at: string
        }
        Insert: {
          country?: string
          created_at?: string
          id?: string
          identity_confidence?: string
          municipality?: string | null
          name: string
          name_normalized?: string | null
          platform_id?: string | null
          tax_id?: string | null
          tax_id_country?: string
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          identity_confidence?: string
          municipality?: string | null
          name?: string
          name_normalized?: string | null
          platform_id?: string | null
          tax_id?: string | null
          tax_id_country?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          artifact_id: string | null
          created_at: string
          document_type: string | null
          id: string
          source_code: string | null
          tender_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          artifact_id?: string | null
          created_at?: string
          document_type?: string | null
          id?: string
          source_code?: string | null
          tender_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          artifact_id?: string | null
          created_at?: string
          document_type?: string | null
          id?: string
          source_code?: string | null
          tender_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "source_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tender_id_fkey"
            columns: ["tender_id"]
            isOneToOne: false
            referencedRelation: "tenders"
            referencedColumns: ["id"]
          },
        ]
      }
      errors: {
        Row: {
          artifact_id: string | null
          created_at: string
          details: Json | null
          error_class: string
          id: string
          message: string
          source_code: string | null
          sync_id: string | null
        }
        Insert: {
          artifact_id?: string | null
          created_at?: string
          details?: Json | null
          error_class?: string
          id?: string
          message: string
          source_code?: string | null
          sync_id?: string | null
        }
        Update: {
          artifact_id?: string | null
          created_at?: string
          details?: Json | null
          error_class?: string
          id?: string
          message?: string
          source_code?: string | null
          sync_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "errors_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "source_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "errors_sync_id_fkey"
            columns: ["sync_id"]
            isOneToOne: false
            referencedRelation: "source_sync"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          tender_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tender_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tender_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_tender_id_fkey"
            columns: ["tender_id"]
            isOneToOne: false
            referencedRelation: "tenders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          alert_id: string | null
          attempts: number
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          payload: Json
          scheduled_at: string
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          alert_id?: string | null
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          payload?: Json
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          alert_id?: string | null
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          payload?: Json
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          event_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "tender_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          criteria: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          criteria?: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          criteria?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      setup_rls_smoke: {
        Row: {
          created_at: string
          id: string
          note: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          owner_id?: string
        }
        Relationships: []
      }
      source_artifacts: {
        Row: {
          artifact_key: string
          byte_size: number | null
          checksum: string
          content_type: string | null
          created_at: string
          downloaded_at: string
          id: string
          source_code: string
          source_url: string | null
          storage_path: string | null
          sync_id: string | null
        }
        Insert: {
          artifact_key: string
          byte_size?: number | null
          checksum: string
          content_type?: string | null
          created_at?: string
          downloaded_at?: string
          id?: string
          source_code: string
          source_url?: string | null
          storage_path?: string | null
          sync_id?: string | null
        }
        Update: {
          artifact_key?: string
          byte_size?: number | null
          checksum?: string
          content_type?: string | null
          created_at?: string
          downloaded_at?: string
          id?: string
          source_code?: string
          source_url?: string | null
          storage_path?: string | null
          sync_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_artifacts_sync_id_fkey"
            columns: ["sync_id"]
            isOneToOne: false
            referencedRelation: "source_sync"
            referencedColumns: ["id"]
          },
        ]
      }
      source_sync: {
        Row: {
          checksum: string | null
          created_at: string
          cursor: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          last_artifact: string | null
          records_failed: number
          records_new: number
          records_seen: number
          records_updated: number
          run_id: string
          source_code: string
          started_at: string
          status: string
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          cursor?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          last_artifact?: string | null
          records_failed?: number
          records_new?: number
          records_seen?: number
          records_updated?: number
          run_id: string
          source_code: string
          started_at?: string
          status?: string
        }
        Update: {
          checksum?: string | null
          created_at?: string
          cursor?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          last_artifact?: string | null
          records_failed?: number
          records_new?: number
          records_seen?: number
          records_updated?: number
          run_id?: string
          source_code?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          country: string
          created_at: string
          id: string
          identity_confidence: string
          municipality: string | null
          name: string
          name_normalized: string | null
          tax_id: string | null
          tax_id_country: string
          updated_at: string
        }
        Insert: {
          country?: string
          created_at?: string
          id?: string
          identity_confidence?: string
          municipality?: string | null
          name: string
          name_normalized?: string | null
          tax_id?: string | null
          tax_id_country?: string
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          identity_confidence?: string
          municipality?: string | null
          name?: string
          name_normalized?: string | null
          tax_id?: string | null
          tax_id_country?: string
          updated_at?: string
        }
        Relationships: []
      }
      tender_events: {
        Row: {
          created_at: string
          event_status: string | null
          event_type: string
          id: string
          occurred_at: string
          payload: Json | null
          source_code: string | null
          tender_id: string
        }
        Insert: {
          created_at?: string
          event_status?: string | null
          event_type: string
          id?: string
          occurred_at?: string
          payload?: Json | null
          source_code?: string | null
          tender_id: string
        }
        Update: {
          created_at?: string
          event_status?: string | null
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json | null
          source_code?: string | null
          tender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tender_events_tender_id_fkey"
            columns: ["tender_id"]
            isOneToOne: false
            referencedRelation: "tenders"
            referencedColumns: ["id"]
          },
        ]
      }
      tender_sources: {
        Row: {
          artifact_id: string | null
          created_at: string
          id: string
          last_seen_at: string
          match_candidate_tender_id: string | null
          match_method: string | null
          match_score: number | null
          matched_at: string | null
          review_status: string
          source_code: string
          source_tender_id: string
          source_url: string | null
          tender_id: string
        }
        Insert: {
          artifact_id?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string
          match_candidate_tender_id?: string | null
          match_method?: string | null
          match_score?: number | null
          matched_at?: string | null
          review_status?: string
          source_code: string
          source_tender_id: string
          source_url?: string | null
          tender_id: string
        }
        Update: {
          artifact_id?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string
          match_candidate_tender_id?: string | null
          match_method?: string | null
          match_score?: number | null
          matched_at?: string | null
          review_status?: string
          source_code?: string
          source_tender_id?: string
          source_url?: string | null
          tender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tender_sources_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "source_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tender_sources_match_candidate_tender_id_fkey"
            columns: ["match_candidate_tender_id"]
            isOneToOne: false
            referencedRelation: "tenders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tender_sources_tender_id_fkey"
            columns: ["tender_id"]
            isOneToOne: false
            referencedRelation: "tenders"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_ccaa: {
        Row: {
          code: string
          name: string
        }
        Insert: {
          code: string
          name: string
        }
        Update: {
          code?: string
          name?: string
        }
        Relationships: []
      }
      geo_municipio: {
        Row: {
          ccaa_code: string
          code: string
          name: string
        }
        Insert: {
          ccaa_code: string
          code: string
          name: string
        }
        Update: {
          ccaa_code?: string
          code?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_municipio_ccaa_code_fkey"
            columns: ["ccaa_code"]
            isOneToOne: false
            referencedRelation: "geo_ccaa"
            referencedColumns: ["code"]
          },
        ]
      }
      tender_cpvs: {
        Row: {
          tender_id: string
          cpv_code: string
        }
        Insert: {
          tender_id: string
          cpv_code: string
        }
        Update: {
          tender_id?: string
          cpv_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "tender_cpvs_tender_id_fkey"
            columns: ["tender_id"]
            isOneToOne: false
            referencedRelation: "tenders"
            referencedColumns: ["id"]
          },
        ]
      }
      tenders: {
        Row: {
          canonical_source_code: string
          contract_type: string | null
          contracting_authority_id: string | null
          created_at: string
          currency: string
          deadline_at: string | null
          description: string | null
          estimated_value: number | null
          id: string
          place_ccaa_code: string | null
          place_municipality_code: string | null
          place_nuts_code: string | null
          procedure_type: string | null
          publication_date: string | null
          search_vector: unknown
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          canonical_source_code: string
          contract_type?: string | null
          contracting_authority_id?: string | null
          created_at?: string
          currency?: string
          deadline_at?: string | null
          description?: string | null
          estimated_value?: number | null
          id?: string
          place_ccaa_code?: string | null
          place_municipality_code?: string | null
          place_nuts_code?: string | null
          procedure_type?: string | null
          publication_date?: string | null
          search_vector?: unknown
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          canonical_source_code?: string
          contract_type?: string | null
          contracting_authority_id?: string | null
          created_at?: string
          currency?: string
          deadline_at?: string | null
          description?: string | null
          estimated_value?: number | null
          id?: string
          place_ccaa_code?: string | null
          place_municipality_code?: string | null
          place_nuts_code?: string | null
          procedure_type?: string | null
          publication_date?: string | null
          search_vector?: unknown
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenders_contracting_authority_id_fkey"
            columns: ["contracting_authority_id"]
            isOneToOne: false
            referencedRelation: "contracting_authorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenders_place_ccaa_code_fkey"
            columns: ["place_ccaa_code"]
            isOneToOne: false
            referencedRelation: "geo_ccaa"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "tenders_place_municipality_code_fkey"
            columns: ["place_municipality_code"]
            isOneToOne: false
            referencedRelation: "geo_municipio"
            referencedColumns: ["code"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string
          created_at: string
          digest_frequency: string
          display_name: string | null
          id: string
          notifications_read_at: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          digest_frequency?: string
          display_name?: string | null
          id?: string
          notifications_read_at?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          digest_frequency?: string
          display_name?: string | null
          id?: string
          notifications_read_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_tenders: {
        Args: {
          p_authority_ids?: string[]
          p_authority_name_contains?: string
          p_authority_tax_ids?: string[]
          p_contract_types?: string[]
          p_countries?: string[]
          p_cpv_codes?: string[]
          /** `any` (default) | `all` — ADR 019 */
          p_cpv_match?: string
          p_deadline_from?: string
          p_deadline_to?: string
          /** true → deadline_at > now() (excluye sin plazo) */
          p_open_for_submission?: boolean
          p_estimated_value_max?: number
          p_estimated_value_min?: number
          p_keywords?: string[]
          p_limit?: number
          p_ccaa_codes?: string[]
          p_municipalities?: string[]
          p_municipality_codes?: string[]
          p_offset?: number
          p_procedure_types?: string[]
          p_publication_date_from?: string
          p_publication_date_to?: string
          p_query?: string
          p_statuses?: string[]
        }
        Returns: {
          contract_type: string
          contracting_authority_id: string
          cpv_codes: string[]
          created_at: string
          currency: string
          deadline_at: string
          description: string
          estimated_value: number
          id: string
          match_kind: string
          procedure_type: string
          publication_date: string
          rank: number
          status: string
          title: string
          /** Universo de la búsqueda (sin texto: filtros; con texto: tras top-K). */
          total_count: number
          updated_at: string
        }[]
      }
      list_place_municipalities: {
        Args: {
          p_ccaa_code: string
        }
        Returns: {
          code: string
          name: string
        }[]
      }
      list_tender_filter_options: {
        Args: Record<PropertyKey, never>
        Returns: {
          kind: string
          value: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

