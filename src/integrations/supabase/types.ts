export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_access_requests: {
        Row: {
          contact_email: string
          created_at: string
          id: string
          institution_id: string
          justification: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          contact_email: string
          created_at?: string
          id?: string
          institution_id: string
          justification?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          contact_email?: string
          created_at?: string
          id?: string
          institution_id?: string
          justification?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_access_requests_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_access_requests_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_settings: {
        Row: {
          default_auth_method: string
          embed_key: string
          institution_id: string
          notes: string
          proxy_prefix: string
          updated_at: string
        }
        Insert: {
          default_auth_method?: string
          embed_key?: string
          institution_id: string
          notes?: string
          proxy_prefix?: string
          updated_at?: string
        }
        Update: {
          default_auth_method?: string
          embed_key?: string
          institution_id?: string
          notes?: string
          proxy_prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_settings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institution_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_settings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          annual_price_cents: number
          billing_status: string
          catalog_name: string
          created_at: string
          email_domains: string[]
          id: string
          implementation_fee_cents: number
          is_active: boolean
          name: string
          plan_code: string
          renewal_on: string | null
          short_name: string
          slug: string
          subscription_started_on: string | null
          subscription_status: string
        }
        Insert: {
          annual_price_cents?: number
          billing_status?: string
          catalog_name: string
          created_at?: string
          email_domains?: string[]
          id?: string
          implementation_fee_cents?: number
          is_active?: boolean
          name: string
          plan_code?: string
          renewal_on?: string | null
          short_name: string
          slug: string
          subscription_started_on?: string | null
          subscription_status?: string
        }
        Update: {
          annual_price_cents?: number
          billing_status?: string
          catalog_name?: string
          created_at?: string
          email_domains?: string[]
          id?: string
          implementation_fee_cents?: number
          is_active?: boolean
          name?: string
          plan_code?: string
          renewal_on?: string | null
          short_name?: string
          slug?: string
          subscription_started_on?: string | null
          subscription_status?: string
        }
        Relationships: []
      }
      pricing_plans: {
        Row: {
          annual_price_cents: number
          code: string
          created_at: string
          features: string[]
          id: string
          implementation_fee_cents: number
          is_active: boolean
          is_custom: boolean
          name: string
          sort_order: number
          tagline: string
          updated_at: string
        }
        Insert: {
          annual_price_cents?: number
          code: string
          created_at?: string
          features?: string[]
          id?: string
          implementation_fee_cents?: number
          is_active?: boolean
          is_custom?: boolean
          name: string
          sort_order?: number
          tagline?: string
          updated_at?: string
        }
        Update: {
          annual_price_cents?: number
          code?: string
          created_at?: string
          features?: string[]
          id?: string
          implementation_fee_cents?: number
          is_active?: boolean
          is_custom?: boolean
          name?: string
          sort_order?: number
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          institution_id: string | null
          marketing_opt_in: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          institution_id?: string | null
          marketing_opt_in?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          institution_id?: string | null
          marketing_opt_in?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          auth_method: string
          created_at: string
          description: string
          disciplines: string[]
          id: string
          institution_id: string
          kind: string
          monthly_queries: number
          name: string
          provider: string
          source_types: string[]
          status: string
          updated_at: string
          url: string
        }
        Insert: {
          auth_method?: string
          created_at?: string
          description?: string
          disciplines?: string[]
          id?: string
          institution_id: string
          kind?: string
          monthly_queries?: number
          name: string
          provider?: string
          source_types?: string[]
          status?: string
          updated_at?: string
          url?: string
        }
        Update: {
          auth_method?: string
          created_at?: string
          description?: string
          disciplines?: string[]
          id?: string
          institution_id?: string
          kind?: string
          monthly_queries?: number
          name?: string
          provider?: string
          source_types?: string[]
          status?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          institution_id: string
          resource_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type?: string
          id?: string
          institution_id: string
          resource_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          institution_id?: string
          resource_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          institution_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institution_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      institution_directory: {
        Row: {
          catalog_name: string | null
          id: string | null
          name: string | null
          short_name: string | null
          slug: string | null
        }
        Insert: {
          catalog_name?: string | null
          id?: string | null
          name?: string | null
          short_name?: string | null
          slug?: string | null
        }
        Update: {
          catalog_name?: string | null
          id?: string | null
          name?: string | null
          short_name?: string | null
          slug?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_institution_access: {
        Args: { _institution_id: string }
        Returns: Json
      }
      current_institution: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      manages_institution: {
        Args: { _institution_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "college_admin" | "super_admin"
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
  public: {
    Enums: {
      app_role: ["student", "college_admin", "super_admin"],
    },
  },
} as const
