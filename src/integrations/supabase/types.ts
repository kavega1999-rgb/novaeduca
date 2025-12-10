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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          country: string | null
          created_at: string
          details: string | null
          device_type: string | null
          event_timestamp: string
          event_type: string
          id: string
          ip_address: string | null
          region: string | null
          status: string
          user_agent: string | null
          user_email: string
          user_id: string | null
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          details?: string | null
          device_type?: string | null
          event_timestamp?: string
          event_type: string
          id?: string
          ip_address?: string | null
          region?: string | null
          status?: string
          user_agent?: string | null
          user_email: string
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          details?: string | null
          device_type?: string | null
          event_timestamp?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          region?: string | null
          status?: string
          user_agent?: string | null
          user_email?: string
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      adherence_reports: {
        Row: {
          conclusion: string | null
          created_at: string
          id: string
          improvement_percentage: number | null
          postest_attempt_id: string | null
          postest_category: string | null
          postest_score: number | null
          pretest_attempt_id: string | null
          pretest_category: string | null
          pretest_score: number | null
          strategies: string | null
          training_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conclusion?: string | null
          created_at?: string
          id?: string
          improvement_percentage?: number | null
          postest_attempt_id?: string | null
          postest_category?: string | null
          postest_score?: number | null
          pretest_attempt_id?: string | null
          pretest_category?: string | null
          pretest_score?: number | null
          strategies?: string | null
          training_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conclusion?: string | null
          created_at?: string
          id?: string
          improvement_percentage?: number | null
          postest_attempt_id?: string | null
          postest_category?: string | null
          postest_score?: number | null
          pretest_attempt_id?: string | null
          pretest_category?: string | null
          pretest_score?: number | null
          strategies?: string | null
          training_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adherence_reports_postest_attempt_id_fkey"
            columns: ["postest_attempt_id"]
            isOneToOne: false
            referencedRelation: "evaluation_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adherence_reports_pretest_attempt_id_fkey"
            columns: ["pretest_attempt_id"]
            isOneToOne: false
            referencedRelation: "pretest_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adherence_reports_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          attempt_id: string | null
          certificate_type: string
          created_at: string
          file_url: string
          id: string
          issued_at: string
          training_id: string
          user_id: string
        }
        Insert: {
          attempt_id?: string | null
          certificate_type: string
          created_at?: string
          file_url: string
          id?: string
          issued_at?: string
          training_id: string
          user_id: string
        }
        Update: {
          attempt_id?: string | null
          certificate_type?: string
          created_at?: string
          file_url?: string
          id?: string
          issued_at?: string
          training_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "evaluation_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_answers: {
        Row: {
          ai_feedback: string | null
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean | null
          points_earned: number | null
          question_id: string
          selected_option_id: string | null
          text_response: string | null
        }
        Insert: {
          ai_feedback?: string | null
          attempt_id: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          question_id: string
          selected_option_id?: string | null
          text_response?: string | null
        }
        Update: {
          ai_feedback?: string | null
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          question_id?: string
          selected_option_id?: string | null
          text_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "evaluation_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "evaluation_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_answers_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "evaluation_question_options"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_attempts: {
        Row: {
          completed_at: string | null
          evaluation_id: string
          id: string
          max_score: number
          passed: boolean | null
          score: number | null
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          evaluation_id: string
          id?: string
          max_score: number
          passed?: boolean | null
          score?: number | null
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          evaluation_id?: string
          id?: string
          max_score?: number
          passed?: boolean | null
          score?: number | null
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_attempts_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_question_options: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          option_text: string
          order_index: number
          question_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct?: boolean
          option_text: string
          order_index?: number
          question_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          option_text?: string
          order_index?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "evaluation_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_questions: {
        Row: {
          created_at: string
          evaluation_id: string
          id: string
          order_index: number
          points: number
          question_text: string
          question_type: string
        }
        Insert: {
          created_at?: string
          evaluation_id: string
          id?: string
          order_index?: number
          points?: number
          question_text: string
          question_type?: string
        }
        Update: {
          created_at?: string
          evaluation_id?: string
          id?: string
          order_index?: number
          points?: number
          question_text?: string
          question_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_questions_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          max_attempts: number | null
          passing_score: number
          requires_pretest: boolean
          time_limit_minutes: number | null
          title: string
          training_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          max_attempts?: number | null
          passing_score?: number
          requires_pretest?: boolean
          time_limit_minutes?: number | null
          title: string
          training_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          max_attempts?: number | null
          passing_score?: number
          requires_pretest?: boolean
          time_limit_minutes?: number | null
          title?: string
          training_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_documents: {
        Row: {
          category: Database["public"]["Enums"]["document_category"]
          created_at: string
          created_by: string | null
          file_url: string
          id: string
          published_at: string
          summary: string | null
          title: string
          updated_at: string
          visible_to: Database["public"]["Enums"]["visibility_target"][]
        }
        Insert: {
          category: Database["public"]["Enums"]["document_category"]
          created_at?: string
          created_by?: string | null
          file_url: string
          id?: string
          published_at?: string
          summary?: string | null
          title: string
          updated_at?: string
          visible_to?: Database["public"]["Enums"]["visibility_target"][]
        }
        Update: {
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          created_by?: string | null
          file_url?: string
          id?: string
          published_at?: string
          summary?: string | null
          title?: string
          updated_at?: string
          visible_to?: Database["public"]["Enums"]["visibility_target"][]
        }
        Relationships: []
      }
      pretest_answers: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean | null
          points_earned: number | null
          question_id: string
          selected_option_id: string | null
          text_response: string | null
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          question_id: string
          selected_option_id?: string | null
          text_response?: string | null
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          question_id?: string
          selected_option_id?: string | null
          text_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pretest_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "pretest_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pretest_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "evaluation_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pretest_answers_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "evaluation_question_options"
            referencedColumns: ["id"]
          },
        ]
      }
      pretest_attempts: {
        Row: {
          completed_at: string | null
          evaluation_id: string
          id: string
          max_score: number
          score: number | null
          started_at: string
          status: string
          training_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          evaluation_id: string
          id?: string
          max_score: number
          score?: number | null
          started_at?: string
          status?: string
          training_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          evaluation_id?: string
          id?: string
          max_score?: number
          score?: number | null
          started_at?: string
          status?: string
          training_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pretest_attempts_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pretest_attempts_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          area: Database["public"]["Enums"]["user_area"] | null
          created_at: string
          full_name: string
          id: string
          position: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
        }
        Insert: {
          area?: Database["public"]["Enums"]["user_area"] | null
          created_at?: string
          full_name: string
          id: string
          position?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
        }
        Update: {
          area?: Database["public"]["Enums"]["user_area"] | null
          created_at?: string
          full_name?: string
          id?: string
          position?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_target_areas: {
        Row: {
          created_at: string
          id: string
          target_area: Database["public"]["Enums"]["user_area"]
          training_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_area: Database["public"]["Enums"]["user_area"]
          training_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_area?: Database["public"]["Enums"]["user_area"]
          training_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_target_areas_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          area_id: string
          content_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          generates_certificate: boolean | null
          generates_constancia: boolean | null
          id: string
          published_at: string | null
          requires_evaluation: boolean | null
          status: string
          title: string
          total_pages: number | null
          type: string
          updated_at: string
          visible_to_all: boolean | null
          year: number
        }
        Insert: {
          area_id: string
          content_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          generates_certificate?: boolean | null
          generates_constancia?: boolean | null
          id?: string
          published_at?: string | null
          requires_evaluation?: boolean | null
          status?: string
          title: string
          total_pages?: number | null
          type: string
          updated_at?: string
          visible_to_all?: boolean | null
          year?: number
        }
        Update: {
          area_id?: string
          content_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          generates_certificate?: boolean | null
          generates_constancia?: boolean | null
          id?: string
          published_at?: string | null
          requires_evaluation?: boolean | null
          status?: string
          title?: string
          total_pages?: number | null
          type?: string
          updated_at?: string
          visible_to_all?: boolean | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "trainings_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          completed_at: string | null
          content_viewed_completely: boolean | null
          id: string
          last_accessed_at: string | null
          pretest_completed: boolean | null
          pretest_score: number | null
          progress_percentage: number | null
          started_at: string | null
          status: string
          training_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          content_viewed_completely?: boolean | null
          id?: string
          last_accessed_at?: string | null
          pretest_completed?: boolean | null
          pretest_score?: number | null
          progress_percentage?: number | null
          started_at?: string | null
          status?: string
          training_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          content_viewed_completely?: boolean | null
          id?: string
          last_accessed_at?: string | null
          pretest_completed?: boolean | null
          pretest_score?: number | null
          progress_percentage?: number | null
          started_at?: string | null
          status?: string
          training_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "leader" | "user"
      document_category: "Norma" | "Circular" | "Resolución" | "Manual" | "Otro"
      user_area: "medicos" | "asistencial" | "administrativos"
      visibility_target: "Administrativos" | "Médicos" | "Operativos" | "Todos"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "leader", "user"],
      document_category: ["Norma", "Circular", "Resolución", "Manual", "Otro"],
      user_area: ["medicos", "asistencial", "administrativos"],
      visibility_target: ["Administrativos", "Médicos", "Operativos", "Todos"],
    },
  },
} as const
