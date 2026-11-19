export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      answers: {
        Row: {
          body: string;
          created_at: string;
          day_key: string;
          deleted_at: string | null;
          exposure_count: number;
          id: string;
          is_seed: boolean;
          moderated_at: string | null;
          question_id: string;
          rejection_reason: string | null;
          status: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          day_key: string;
          deleted_at?: string | null;
          exposure_count?: number;
          id?: string;
          is_seed?: boolean;
          moderated_at?: string | null;
          question_id: string;
          rejection_reason?: string | null;
          status?: string;
          user_id?: string | null;
        };
        Update: {
          body?: string;
          created_at?: string;
          day_key?: string;
          deleted_at?: string | null;
          exposure_count?: number;
          id?: string;
          is_seed?: boolean;
          moderated_at?: string | null;
          question_id?: string;
          rejection_reason?: string | null;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'answers_question_id_fkey';
            columns: ['question_id'];
            isOneToOne: false;
            referencedRelation: 'questions';
            referencedColumns: ['id'];
          },
        ];
      };
      app_settings: {
        Row: {
          allow_clock_override: boolean;
          allow_timer_cancel: boolean;
          answer_grace_minutes: number;
          answer_max_length: number;
          answer_min_length: number;
          day_start_hour: number;
          glow_exposure_cap: number;
          id: boolean;
          letters_glowing_slots: number;
          letters_per_day: number;
          letters_random_slots: number;
          light_thresholds: number[];
          report_hide_threshold: number;
          time_zone: string;
          timer_options: number[];
          timer_start_cutoff_minutes: number;
        };
        ComputedFields: never;
        Insert: {
          allow_clock_override?: boolean;
          allow_timer_cancel?: boolean;
          answer_grace_minutes?: number;
          answer_max_length?: number;
          answer_min_length?: number;
          day_start_hour?: number;
          glow_exposure_cap?: number;
          id?: boolean;
          letters_glowing_slots?: number;
          letters_per_day?: number;
          letters_random_slots?: number;
          light_thresholds?: number[];
          report_hide_threshold?: number;
          time_zone?: string;
          timer_options?: number[];
          timer_start_cutoff_minutes?: number;
        };
        Update: {
          allow_clock_override?: boolean;
          allow_timer_cancel?: boolean;
          answer_grace_minutes?: number;
          answer_max_length?: number;
          answer_min_length?: number;
          day_start_hour?: number;
          glow_exposure_cap?: number;
          id?: boolean;
          letters_glowing_slots?: number;
          letters_per_day?: number;
          letters_random_slots?: number;
          light_thresholds?: number[];
          report_hide_threshold?: number;
          time_zone?: string;
          timer_options?: number[];
          timer_start_cutoff_minutes?: number;
        };
        Relationships: [];
      };
      blocks: {
        Row: {
          blocked_user_id: string;
          blocker_id: string;
          created_at: string;
        };
        ComputedFields: never;
        Insert: {
          blocked_user_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_user_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      daily_progress: {
        Row: {
          answered_at: string | null;
          day_key: string;
          feed_completed_at: string | null;
          timer_ends_at: string | null;
          timer_minutes: number | null;
          timer_started_at: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          answered_at?: string | null;
          day_key: string;
          feed_completed_at?: string | null;
          timer_ends_at?: string | null;
          timer_minutes?: number | null;
          timer_started_at?: string | null;
          user_id: string;
        };
        Update: {
          answered_at?: string | null;
          day_key?: string;
          feed_completed_at?: string | null;
          timer_ends_at?: string | null;
          timer_minutes?: number | null;
          timer_started_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      feed_assignments: {
        Row: {
          answer_id: string;
          assigned_at: string;
          day_key: string;
          kind: string;
          seen_at: string | null;
          slot: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          answer_id: string;
          assigned_at?: string;
          day_key: string;
          kind: string;
          seen_at?: string | null;
          slot: number;
          user_id: string;
        };
        Update: {
          answer_id?: string;
          assigned_at?: string;
          day_key?: string;
          kind?: string;
          seen_at?: string | null;
          slot?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'feed_assignments_answer_id_fkey';
            columns: ['answer_id'];
            isOneToOne: false;
            referencedRelation: 'admin_report_queue';
            referencedColumns: ['answer_id'];
          },
          {
            foreignKeyName: 'feed_assignments_answer_id_fkey';
            columns: ['answer_id'];
            isOneToOne: false;
            referencedRelation: 'answers';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          glow_notice_day: string | null;
          id: string;
          is_banned: boolean;
          notify_question: boolean;
          notify_timer: boolean;
          onboarded_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          glow_notice_day?: string | null;
          id: string;
          is_banned?: boolean;
          notify_question?: boolean;
          notify_timer?: boolean;
          onboarded_at?: string | null;
        };
        Update: {
          created_at?: string;
          glow_notice_day?: string | null;
          id?: string;
          is_banned?: boolean;
          notify_question?: boolean;
          notify_timer?: boolean;
          onboarded_at?: string | null;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          platform: string;
          token: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          platform: string;
          token: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          platform?: string;
          token?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_tokens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      questions: {
        Row: {
          body: string;
          created_at: string;
          day_key: string;
          genre: string;
          id: string;
          sponsor_name: string | null;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          day_key: string;
          genre: string;
          id?: string;
          sponsor_name?: string | null;
        };
        Update: {
          body?: string;
          created_at?: string;
          day_key?: string;
          genre?: string;
          id?: string;
          sponsor_name?: string | null;
        };
        Relationships: [];
      };
      reactions: {
        Row: {
          answer_id: string;
          created_at: string;
          type: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          answer_id: string;
          created_at?: string;
          type: string;
          user_id: string;
        };
        Update: {
          answer_id?: string;
          created_at?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reactions_answer_id_fkey';
            columns: ['answer_id'];
            isOneToOne: false;
            referencedRelation: 'admin_report_queue';
            referencedColumns: ['answer_id'];
          },
          {
            foreignKeyName: 'reactions_answer_id_fkey';
            columns: ['answer_id'];
            isOneToOne: false;
            referencedRelation: 'answers';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          answer_id: string;
          created_at: string;
          id: string;
          reason: string;
          reporter_id: string;
          reviewed_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          answer_id: string;
          created_at?: string;
          id?: string;
          reason: string;
          reporter_id: string;
          reviewed_at?: string | null;
        };
        Update: {
          answer_id?: string;
          created_at?: string;
          id?: string;
          reason?: string;
          reporter_id?: string;
          reviewed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'reports_answer_id_fkey';
            columns: ['answer_id'];
            isOneToOne: false;
            referencedRelation: 'admin_report_queue';
            referencedColumns: ['answer_id'];
          },
          {
            foreignKeyName: 'reports_answer_id_fkey';
            columns: ['answer_id'];
            isOneToOne: false;
            referencedRelation: 'answers';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      admin_report_queue: {
        Row: {
          answer_id: string;
          body: string;
          day_key: string;
          last_reported_at: string | null;
          reasons: string[] | null;
          report_count: number | null;
          status: string;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      ack_glow_notice: { Args: Record<PropertyKey, never>; Returns: undefined };
      active_day_key: { Args: { uid: string }; Returns: string };
      app_day_ends_at: { Args: { day: string }; Returns: string };
      app_day_key: { Args: { ts?: string }; Returns: string };
      app_day_starts_at: { Args: { day: string }; Returns: string };
      app_now: { Args: Record<PropertyKey, never>; Returns: string };
      assign_letters: { Args: { day: string; uid: string }; Returns: undefined };
      block_letter_author: { Args: { p_answer_id: string }; Returns: undefined };
      cancel_timer: { Args: Record<PropertyKey, never>; Returns: Json };
      complete_onboarding: { Args: Record<PropertyKey, never>; Returns: Json };
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      delete_my_answer: { Args: { p_answer_id: string }; Returns: undefined };
      derive_day_state: {
        Args: {
          at: string;
          day: string;
          p: Omit<
            Database['public']['Tables']['daily_progress']['Row'],
            Database['public']['Tables']['daily_progress']['ComputedFields']
          >;
        };
        Returns: string;
      };
      get_my_archive: { Args: { p_month: string }; Returns: Json };
      get_my_profile: { Args: Record<PropertyKey, never>; Returns: Json };
      get_today_letters: { Args: Record<PropertyKey, never>; Returns: Json };
      get_today_question: {
        Args: Record<PropertyKey, never>;
        Returns: {
          body: string;
          day_key: string;
          ends_at: string;
          genre: string;
          question_id: string;
          server_now: string;
          sponsor_name: string;
          starts_at: string;
        }[];
      };
      get_today_state: { Args: Record<PropertyKey, never>; Returns: Json };
      has_posted: { Args: { day: string; uid: string }; Returns: boolean };
      is_assigned: { Args: { p_answer_id: string; uid: string }; Returns: boolean };
      letter_candidates: {
        Args: { day: string; uid: string };
        Returns: {
          body: string;
          created_at: string;
          day_key: string;
          deleted_at: string | null;
          exposure_count: number;
          id: string;
          is_seed: boolean;
          moderated_at: string | null;
          question_id: string;
          rejection_reason: string | null;
          status: string;
          user_id: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'answers';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      light_level: { Args: { p_answer_id: string }; Returns: number };
      mark_letter_seen: { Args: { p_answer_id: string }; Returns: Json };
      normalize_answer_body: { Args: { body: string }; Returns: string };
      register_push_token: { Args: { p_platform: string; p_token: string }; Returns: undefined };
      report_letter: { Args: { p_answer_id: string; p_reason: string }; Returns: undefined };
      require_user: { Args: Record<PropertyKey, never>; Returns: string };
      set_reaction: { Args: { p_answer_id: string; p_on: boolean; p_type: string }; Returns: Json };
      start_timer: { Args: { p_minutes: number }; Returns: Json };
      submit_answer: { Args: { p_body: string }; Returns: Json };
      timer_start_closes_at: { Args: { day: string }; Returns: string };
      today_state_extras: { Args: { day: string; uid: string }; Returns: Json };
      update_my_settings: {
        Args: { p_notify_question?: boolean; p_notify_timer?: boolean };
        Returns: Json;
      };
      visible_assignments: {
        Args: { day: string; uid: string };
        Returns: {
          answer_id: string;
          body: string;
          seen_at: string;
          slot: number;
        }[];
      };
      writable_until: { Args: { day: string; timer_ends_at: string }; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
