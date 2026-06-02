export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      app_users: {
        Row: {
          authorized: boolean
          created_at: string | null
          email: string
          id: string
          name: string | null
          role: string | null
          service: string | null
          session_id: string
        }
        Insert: {
          authorized?: boolean
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
          role?: string | null
          service?: string | null
          session_id: string
        }
        Update: {
          authorized?: boolean
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          role?: string | null
          service?: string | null
          session_id?: string
        }
        Relationships: []
      }
      cahiers_de_charge: {
        Row: {
          id: string
          template_data: Json | null
          timestamp: string | null
          titre: string | null
          version: number
        }
        Insert: {
          id?: string
          template_data?: Json | null
          timestamp?: string | null
          titre?: string | null
          version?: number
        }
        Update: {
          id?: string
          template_data?: Json | null
          timestamp?: string | null
          titre?: string | null
          version?: number
        }
        Relationships: []
      }
      commandes: {
        Row: {
          commande_numero: string | null
          id: string
          template_data: Json | null
          timestamp: string | null
          version: number
        }
        Insert: {
          commande_numero?: string | null
          id?: string
          template_data?: Json | null
          timestamp?: string | null
          version?: number
        }
        Update: {
          commande_numero?: string | null
          id?: string
          template_data?: Json | null
          timestamp?: string | null
          version?: number
        }
        Relationships: []
      }
      devis: {
        Row: {
          client_adresse: string | null
          client_nom: string
          client_telephone: string | null
          created_by: string | null
          date_emission: string | null
          delivery_address: Json | null
          details: Json
          id: string
          is_latest: boolean
          numero: string
          total: number
          validite_jours: number
          version: number
        }
        Insert: {
          client_adresse?: string | null
          client_nom: string
          client_telephone?: string | null
          created_by?: string | null
          date_emission?: string | null
          delivery_address?: Json | null
          details?: Json
          id?: string
          is_latest?: boolean
          numero: string
          total: number
          validite_jours: number
          version?: number
        }
        Update: {
          client_adresse?: string | null
          client_nom?: string
          client_telephone?: string | null
          created_by?: string | null
          date_emission?: string | null
          delivery_address?: Json | null
          details?: Json
          id?: string
          is_latest?: boolean
          numero?: string
          total?: number
          validite_jours?: number
          version?: number
        }
        Relationships: []
      }
      factures: {
        Row: {
          facture_numero: string | null
          id: string
          template_data: Json | null
          timestamp: string | null
          version: number
        }
        Insert: {
          facture_numero?: string | null
          id?: string
          template_data?: Json | null
          timestamp?: string | null
          version?: number
        }
        Update: {
          facture_numero?: string | null
          id?: string
          template_data?: Json | null
          timestamp?: string | null
          version?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachments: Json | null
          content: string | null
          id: string
          quote: Json | null
          sender: string
          session_id: string
          template_data: Json | null
          template_type: string | null
          timestamp: string
          user_id: string
          version_ref: string | null
        }
        Insert: {
          attachments?: Json | null
          content?: string | null
          id?: string
          quote?: Json | null
          sender: string
          session_id: string
          template_data?: Json | null
          template_type?: string | null
          timestamp?: string
          user_id: string
          version_ref?: string | null
        }
        Update: {
          attachments?: Json | null
          content?: string | null
          id?: string
          quote?: Json | null
          sender?: string
          session_id?: string
          template_data?: Json | null
          template_type?: string | null
          timestamp?: string
          user_id?: string
          version_ref?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          document_number: string | null
          event_type: string
          id: string
          new_status: string | null
          old_status: string | null
          read: boolean
          session_id: string
          template_id: string | null
          template_type: string
          timestamp: string
          user_id: string
        }
        Insert: {
          document_number?: string | null
          event_type: string
          id?: string
          new_status?: string | null
          old_status?: string | null
          read?: boolean
          session_id: string
          template_id?: string | null
          template_type: string
          timestamp?: string
          user_id: string
        }
        Update: {
          document_number?: string | null
          event_type?: string
          id?: string
          new_status?: string | null
          old_status?: string | null
          read?: boolean
          session_id?: string
          template_id?: string | null
          template_type?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          gallery_images: Json | null
          id: string
          main_image_url: string | null
          manufacturing_rules: Json | null
          name: string
          session_id: string | null
          updated_at: string
          variants: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          gallery_images?: Json | null
          id?: string
          main_image_url?: string | null
          manufacturing_rules?: Json | null
          name: string
          session_id?: string | null
          updated_at?: string
          variants?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          gallery_images?: Json | null
          id?: string
          main_image_url?: string | null
          manufacturing_rules?: Json | null
          name?: string
          session_id?: string | null
          updated_at?: string
          variants?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          session_id: string
          templates: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          session_id: string
          templates?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          session_id?: string
          templates?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      template_notes: {
        Row: {
          attachments: Json | null
          content: string | null
          created_at: string | null
          id: string
          note_type: string
          template_id: string
          template_type: string
          updated_at: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          attachments?: Json | null
          content?: string | null
          created_at?: string | null
          id?: string
          note_type: string
          template_id: string
          template_type: string
          updated_at?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          attachments?: Json | null
          content?: string | null
          created_at?: string | null
          id?: string
          note_type?: string
          template_id?: string
          template_type?: string
          updated_at?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_financial_analytics: {
        Args: { user_filter: string; time_period?: string }
        Returns: {
          potential_revenue: number
          actual_revenue: number
          conversion_rate: number
          expenses: number
          profit_margin: number
        }[]
      }
      get_monthly_financial_data: {
        Args: { user_filter: string; months_back?: number }
        Returns: {
          month: string
          potential_revenue: number
          actual_revenue: number
          expenses: number
        }[]
      }
      get_product_counts: {
        Args: { user_filter: string }
        Returns: {
          count: number
        }[]
      }
      get_template_counts: {
        Args: { user_filter: string }
        Returns: {
          template_type: string
          count: number
        }[]
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
