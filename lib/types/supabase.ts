export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
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
      achievements: {
        Row: {
          created_at: string;
          id: string;
          mission_id: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          mission_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          mission_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "achievements_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "mission_achievement_count_view";
            referencedColumns: ["mission_id"];
          },
          {
            foreignKeyName: "achievements_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "mission_category_view";
            referencedColumns: ["mission_id"];
          },
          {
            foreignKeyName: "achievements_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "missions";
            referencedColumns: ["id"];
          },
        ];
      };
      award_questions: {
        Row: {
          created_at: string;
          display_order: number;
          help_text: string | null;
          id: string;
          is_active: boolean;
          is_required: boolean;
          placeholder: string | null;
          question_group: string;
          question_text: string;
          question_type: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_order?: number;
          help_text?: string | null;
          id?: string;
          is_active?: boolean;
          is_required?: boolean;
          placeholder?: string | null;
          question_group: string;
          question_text: string;
          question_type: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_order?: number;
          help_text?: string | null;
          id?: string;
          is_active?: boolean;
          is_required?: boolean;
          placeholder?: string | null;
          question_group?: string;
          question_text?: string;
          question_type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      award_late_submission_grants: {
        Row: {
          id: string;
          survey_id: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
          created_by_user_id: string;
        };
        Insert: {
          id?: string;
          survey_id: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
          created_by_user_id: string;
        };
        Update: {
          id?: string;
          survey_id?: string;
          user_id?: string;
          token_hash?: string;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
          created_by_user_id?: string;
        };
        Relationships: [];
      };
      award_responses: {
        Row: {
          created_at: string;
          id: string;
          is_late_submission: boolean;
          nominee_user_id: string | null;
          question_id: string;
          survey_id: string;
          text_value: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_late_submission?: boolean;
          nominee_user_id?: string | null;
          question_id: string;
          survey_id: string;
          text_value?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_late_submission?: boolean;
          nominee_user_id?: string | null;
          question_id?: string;
          survey_id?: string;
          text_value?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "award_responses_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "award_questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "award_responses_survey_id_fkey";
            columns: ["survey_id"];
            isOneToOne: false;
            referencedRelation: "award_surveys";
            referencedColumns: ["id"];
          },
        ];
      };
      award_surveys: {
        Row: {
          created_at: string;
          description: string | null;
          end_date: string;
          id: string;
          is_active: boolean;
          period_number: number;
          slack_notified_at: string | null;
          start_date: string;
          title: string;
          updated_at: string;
          year_month: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          end_date: string;
          id?: string;
          is_active?: boolean;
          period_number: number;
          slack_notified_at?: string | null;
          start_date: string;
          title: string;
          updated_at?: string;
          year_month: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          end_date?: string;
          id?: string;
          is_active?: boolean;
          period_number?: number;
          slack_notified_at?: string | null;
          start_date?: string;
          title?: string;
          updated_at?: string;
          year_month?: string;
        };
        Relationships: [];
      };
      business_units: {
        Row: {
          company_id: string;
          created_at: string;
          display_order: number;
          id: string;
          is_active: boolean;
          name: string;
          parent_id: string | null;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          name: string;
          parent_id?: string | null;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          name?: string;
          parent_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_units_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_units_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "business_units";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          created_at: string;
          display_order: number;
          id: string;
          is_active: boolean;
          name: string;
          slug: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          name: string;
          slug?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          name?: string;
          slug?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_action_summary: {
        Row: {
          count: number;
          created_at: string;
          date: string;
        };
        Insert: {
          count: number;
          created_at?: string;
          date: string;
        };
        Update: {
          count?: number;
          created_at?: string;
          date?: string;
        };
        Relationships: [];
      };
      daily_dashboard_registration_by_prefecture_summary: {
        Row: {
          count: number;
          created_at: string;
          date: string;
          prefecture: string;
        };
        Insert: {
          count: number;
          created_at?: string;
          date: string;
          prefecture: string;
        };
        Update: {
          count?: number;
          created_at?: string;
          date?: string;
          prefecture?: string;
        };
        Relationships: [];
      };
      daily_dashboard_registration_summary: {
        Row: {
          count: number;
          created_at: string;
          date: string;
        };
        Insert: {
          count: number;
          created_at?: string;
          date: string;
        };
        Update: {
          count?: number;
          created_at?: string;
          date?: string;
        };
        Relationships: [];
      };
      enps_questions: {
        Row: {
          created_at: string;
          display_order: number;
          id: string;
          is_active: boolean;
          is_required: boolean;
          parent_question_id: string | null;
          question_text: string;
          question_type: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          is_required?: boolean;
          parent_question_id?: string | null;
          question_text: string;
          question_type: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          is_required?: boolean;
          parent_question_id?: string | null;
          question_text?: string;
          question_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enps_questions_parent_question_id_fkey";
            columns: ["parent_question_id"];
            isOneToOne: false;
            referencedRelation: "enps_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      enps_late_submission_grants: {
        Row: {
          id: string;
          survey_id: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
          created_by_user_id: string;
        };
        Insert: {
          id?: string;
          survey_id: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
          created_by_user_id: string;
        };
        Update: {
          id?: string;
          survey_id?: string;
          user_id?: string;
          token_hash?: string;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
          created_by_user_id?: string;
        };
        Relationships: [];
      };
      enps_monthly_snapshots: {
        Row: {
          business_unit_name: string;
          company_name: string;
          computed_at: string;
          detractors: number;
          id: string;
          nps_imputed_base: number | null;
          nps_respondent_base: number | null;
          passives: number;
          promoters: number;
          question_id: string;
          respondent_count: number;
          scope: string;
          survey_id: string;
          target_count: number;
        };
        Insert: {
          business_unit_name: string;
          company_name: string;
          computed_at?: string;
          detractors: number;
          id?: string;
          nps_imputed_base?: number | null;
          nps_respondent_base?: number | null;
          passives: number;
          promoters: number;
          question_id: string;
          respondent_count: number;
          scope: string;
          survey_id: string;
          target_count: number;
        };
        Update: {
          business_unit_name?: string;
          company_name?: string;
          computed_at?: string;
          detractors?: number;
          id?: string;
          nps_imputed_base?: number | null;
          nps_respondent_base?: number | null;
          passives?: number;
          promoters?: number;
          question_id?: string;
          respondent_count?: number;
          scope?: string;
          survey_id?: string;
          target_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "enps_monthly_snapshots_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "enps_questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enps_monthly_snapshots_survey_id_fkey";
            columns: ["survey_id"];
            isOneToOne: false;
            referencedRelation: "enps_surveys";
            referencedColumns: ["id"];
          },
        ];
      };
      enps_report_ai_summaries: {
        Row: {
          company_name: string;
          generated_at: string;
          id: string;
          input_response_count: number;
          model: string;
          payload: Json;
          survey_id: string;
        };
        Insert: {
          company_name: string;
          generated_at?: string;
          id?: string;
          input_response_count: number;
          model: string;
          payload: Json;
          survey_id: string;
        };
        Update: {
          company_name?: string;
          generated_at?: string;
          id?: string;
          input_response_count?: number;
          model?: string;
          payload?: Json;
          survey_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enps_report_ai_summaries_survey_id_fkey";
            columns: ["survey_id"];
            isOneToOne: false;
            referencedRelation: "enps_surveys";
            referencedColumns: ["id"];
          },
        ];
      };
      enps_responses: {
        Row: {
          created_at: string;
          id: string;
          is_late_submission: boolean;
          question_id: string;
          score_value: number | null;
          survey_id: string;
          text_value: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_late_submission?: boolean;
          question_id: string;
          score_value?: number | null;
          survey_id: string;
          text_value?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_late_submission?: boolean;
          question_id?: string;
          score_value?: number | null;
          survey_id?: string;
          text_value?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enps_responses_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "enps_questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enps_responses_survey_id_fkey";
            columns: ["survey_id"];
            isOneToOne: false;
            referencedRelation: "enps_surveys";
            referencedColumns: ["id"];
          },
        ];
      };
      enps_surveys: {
        Row: {
          created_at: string;
          description: string | null;
          end_date: string;
          id: string;
          is_active: boolean;
          slack_notified_at: string | null;
          start_date: string;
          title: string;
          updated_at: string;
          year_month: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          end_date: string;
          id?: string;
          is_active?: boolean;
          slack_notified_at?: string | null;
          start_date: string;
          title: string;
          updated_at?: string;
          year_month: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          end_date?: string;
          id?: string;
          is_active?: boolean;
          slack_notified_at?: string | null;
          start_date?: string;
          title?: string;
          updated_at?: string;
          year_month?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          created_at: string;
          id: string;
          starts_at: string;
          title: string;
          updated_at: string;
          url: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          starts_at: string;
          title: string;
          updated_at?: string;
          url: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          starts_at?: string;
          title?: string;
          updated_at?: string;
          url?: string;
        };
        Relationships: [];
      };
      external_user_pending_xp: {
        Row: {
          claimed_at: string | null;
          claimed_by_user_id: string | null;
          created_at: string;
          description: string | null;
          external_user_name: string;
          id: string;
          source_type: string;
          user_mission_id: string;
          xp_amount: number;
        };
        Insert: {
          claimed_at?: string | null;
          claimed_by_user_id?: string | null;
          created_at?: string;
          description?: string | null;
          external_user_name: string;
          id?: string;
          source_type?: string;
          user_mission_id: string;
          xp_amount: number;
        };
        Update: {
          claimed_at?: string | null;
          claimed_by_user_id?: string | null;
          created_at?: string;
          description?: string | null;
          external_user_name?: string;
          id?: string;
          source_type?: string;
          user_mission_id?: string;
          xp_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "external_user_pending_xp_user_mission_id_fkey";
            columns: ["user_mission_id"];
            isOneToOne: false;
            referencedRelation: "user_missions";
            referencedColumns: ["id"];
          },
        ];
      };
      mission_artifact_geolocations: {
        Row: {
          accuracy: number | null;
          altitude: number | null;
          created_at: string;
          id: number;
          lat: number;
          lon: number;
          mission_artifact_id: string;
        };
        Insert: {
          accuracy?: number | null;
          altitude?: number | null;
          created_at?: string;
          id?: number;
          lat: number;
          lon: number;
          mission_artifact_id: string;
        };
        Update: {
          accuracy?: number | null;
          altitude?: number | null;
          created_at?: string;
          id?: number;
          lat?: number;
          lon?: number;
          mission_artifact_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mission_artifact_geolocations_mission_artifact_id_fkey";
            columns: ["mission_artifact_id"];
            isOneToOne: false;
            referencedRelation: "mission_artifacts";
            referencedColumns: ["id"];
          },
        ];
      };
      mission_artifacts: {
        Row: {
          achievement_id: string;
          artifact_type: string;
          created_at: string;
          description: string | null;
          id: string;
          image_storage_path: string | null;
          link_url: string | null;
          text_content: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          achievement_id: string;
          artifact_type: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_storage_path?: string | null;
          link_url?: string | null;
          text_content?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          achievement_id?: string;
          artifact_type?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_storage_path?: string | null;
          link_url?: string | null;
          text_content?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mission_artifacts_achievement_id_fkey";
            columns: ["achievement_id"];
            isOneToOne: false;
            referencedRelation: "achievements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mission_artifacts_achievement_id_fkey";
            columns: ["achievement_id"];
            isOneToOne: false;
            referencedRelation: "activity_timeline_view";
            referencedColumns: ["id"];
          },
        ];
      };
      mission_category: {
        Row: {
          category_kbn: string;
          category_title: string | null;
          created_at: string;
          del_flg: boolean;
          id: string;
          slug: string;
          sort_no: number;
          updated_at: string;
        };
        Insert: {
          category_kbn?: string;
          category_title?: string | null;
          created_at?: string;
          del_flg?: boolean;
          id: string;
          slug: string;
          sort_no?: number;
          updated_at?: string;
        };
        Update: {
          category_kbn?: string;
          category_title?: string | null;
          created_at?: string;
          del_flg?: boolean;
          id?: string;
          slug?: string;
          sort_no?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      mission_category_link: {
        Row: {
          category_id: string;
          created_at: string;
          del_flg: boolean;
          mission_id: string;
          sort_no: number;
          updated_at: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          del_flg?: boolean;
          mission_id: string;
          sort_no?: number;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          del_flg?: boolean;
          mission_id?: string;
          sort_no?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mission_category_link_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "mission_category";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mission_category_link_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "mission_category_view";
            referencedColumns: ["category_id"];
          },
          {
            foreignKeyName: "mission_category_link_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "mission_achievement_count_view";
            referencedColumns: ["mission_id"];
          },
          {
            foreignKeyName: "mission_category_link_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "mission_category_view";
            referencedColumns: ["mission_id"];
          },
          {
            foreignKeyName: "mission_category_link_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "missions";
            referencedColumns: ["id"];
          },
        ];
      };
      mission_main_links: {
        Row: {
          created_at: string;
          id: string;
          label: string;
          link: string;
          mission_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label: string;
          link: string;
          mission_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string;
          link?: string;
          mission_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mission_main_links_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: true;
            referencedRelation: "mission_achievement_count_view";
            referencedColumns: ["mission_id"];
          },
          {
            foreignKeyName: "mission_main_links_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: true;
            referencedRelation: "mission_category_view";
            referencedColumns: ["mission_id"];
          },
          {
            foreignKeyName: "mission_main_links_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: true;
            referencedRelation: "missions";
            referencedColumns: ["id"];
          },
        ];
      };
      mission_quiz_links: {
        Row: {
          created_at: string;
          display_order: number;
          id: string;
          link: string;
          mission_id: string;
          remark: string | null;
        };
        Insert: {
          created_at?: string;
          display_order?: number;
          id?: string;
          link: string;
          mission_id: string;
          remark?: string | null;
        };
        Update: {
          created_at?: string;
          display_order?: number;
          id?: string;
          link?: string;
          mission_id?: string;
          remark?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "mission_quiz_links_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "mission_achievement_count_view";
            referencedColumns: ["mission_id"];
          },
          {
            foreignKeyName: "mission_quiz_links_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "mission_category_view";
            referencedColumns: ["mission_id"];
          },
          {
            foreignKeyName: "mission_quiz_links_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "missions";
            referencedColumns: ["id"];
          },
        ];
      };
      missions: {
        Row: {
          artifact_label: string | null;
          content: string | null;
          created_at: string;
          difficulty: number;
          event_date: string | null;
          icon_url: string | null;
          id: string;
          important_display_end_date: string | null;
          important_display_start_date: string | null;
          is_featured: boolean;
          is_hidden: boolean;
          is_important: boolean;
          max_achievement_count: number | null;
          ogp_image_url: string | null;
          required_artifact_type: string;
          slug: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          artifact_label?: string | null;
          content?: string | null;
          created_at?: string;
          difficulty: number;
          event_date?: string | null;
          icon_url?: string | null;
          id: string;
          important_display_end_date?: string | null;
          important_display_start_date?: string | null;
          is_featured?: boolean;
          is_hidden?: boolean;
          is_important?: boolean;
          max_achievement_count?: number | null;
          ogp_image_url?: string | null;
          required_artifact_type?: string;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          artifact_label?: string | null;
          content?: string | null;
          created_at?: string;
          difficulty?: number;
          event_date?: string | null;
          icon_url?: string | null;
          id?: string;
          important_display_end_date?: string | null;
          important_display_start_date?: string | null;
          is_featured?: boolean;
          is_hidden?: boolean;
          is_important?: boolean;
          max_achievement_count?: number | null;
          ogp_image_url?: string | null;
          required_artifact_type?: string;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      office_closing_report_floors: {
        Row: {
          checked: boolean;
          floor_id: string;
          id: string;
          report_id: string;
        };
        Insert: {
          checked?: boolean;
          floor_id: string;
          id?: string;
          report_id: string;
        };
        Update: {
          checked?: boolean;
          floor_id?: string;
          id?: string;
          report_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "office_closing_report_floors_floor_id_fkey";
            columns: ["floor_id"];
            isOneToOne: false;
            referencedRelation: "office_floors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "office_closing_report_floors_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "office_closing_reports";
            referencedColumns: ["id"];
          },
        ];
      };
      office_closing_reports: {
        Row: {
          created_at: string;
          id: string;
          left_at: string;
          note: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          left_at: string;
          note?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          left_at?: string;
          note?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      office_floors: {
        Row: {
          created_at: string;
          display_order: number;
          id: string;
          is_active: boolean;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      poster_activities: {
        Row: {
          address: string | null;
          board_id: string | null;
          city: string;
          created_at: string;
          id: string;
          lat: number | null;
          long: number | null;
          mission_artifact_id: string;
          name: string | null;
          note: string | null;
          number: string;
          poster_count: number;
          prefecture: Database["public"]["Enums"]["poster_prefecture_enum"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          address?: string | null;
          board_id?: string | null;
          city: string;
          created_at?: string;
          id?: string;
          lat?: number | null;
          long?: number | null;
          mission_artifact_id: string;
          name?: string | null;
          note?: string | null;
          number: string;
          poster_count: number;
          prefecture: Database["public"]["Enums"]["poster_prefecture_enum"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          address?: string | null;
          board_id?: string | null;
          city?: string;
          created_at?: string;
          id?: string;
          lat?: number | null;
          long?: number | null;
          mission_artifact_id?: string;
          name?: string | null;
          note?: string | null;
          number?: string;
          poster_count?: number;
          prefecture?: Database["public"]["Enums"]["poster_prefecture_enum"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "poster_activities_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "poster_board_latest_editors";
            referencedColumns: ["board_id"];
          },
          {
            foreignKeyName: "poster_activities_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "poster_boards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "poster_activities_mission_artifact_id_fkey";
            columns: ["mission_artifact_id"];
            isOneToOne: false;
            referencedRelation: "mission_artifacts";
            referencedColumns: ["id"];
          },
        ];
      };
      poster_board_status_history: {
        Row: {
          board_id: string;
          created_at: string;
          id: string;
          new_status: Database["public"]["Enums"]["poster_board_status"];
          note: string | null;
          previous_status:
            | Database["public"]["Enums"]["poster_board_status"]
            | null;
          user_id: string;
        };
        Insert: {
          board_id: string;
          created_at?: string;
          id?: string;
          new_status: Database["public"]["Enums"]["poster_board_status"];
          note?: string | null;
          previous_status?:
            | Database["public"]["Enums"]["poster_board_status"]
            | null;
          user_id: string;
        };
        Update: {
          board_id?: string;
          created_at?: string;
          id?: string;
          new_status?: Database["public"]["Enums"]["poster_board_status"];
          note?: string | null;
          previous_status?:
            | Database["public"]["Enums"]["poster_board_status"]
            | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "poster_board_status_history_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "poster_board_latest_editors";
            referencedColumns: ["board_id"];
          },
          {
            foreignKeyName: "poster_board_status_history_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "poster_boards";
            referencedColumns: ["id"];
          },
        ];
      };
      poster_board_totals: {
        Row: {
          city: string | null;
          created_at: string | null;
          id: string;
          note: string | null;
          prefecture: Database["public"]["Enums"]["poster_prefecture_enum"];
          source: string | null;
          total_count: number;
          updated_at: string | null;
        };
        Insert: {
          city?: string | null;
          created_at?: string | null;
          id?: string;
          note?: string | null;
          prefecture: Database["public"]["Enums"]["poster_prefecture_enum"];
          source?: string | null;
          total_count: number;
          updated_at?: string | null;
        };
        Update: {
          city?: string | null;
          created_at?: string | null;
          id?: string;
          note?: string | null;
          prefecture?: Database["public"]["Enums"]["poster_prefecture_enum"];
          source?: string | null;
          total_count?: number;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      poster_boards: {
        Row: {
          address: string | null;
          city: string;
          created_at: string;
          file_name: string | null;
          id: string;
          lat: number;
          long: number;
          name: string | null;
          number: string | null;
          prefecture: Database["public"]["Enums"]["poster_prefecture_enum"];
          row_number: number | null;
          status: Database["public"]["Enums"]["poster_board_status"];
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          city: string;
          created_at?: string;
          file_name?: string | null;
          id?: string;
          lat: number;
          long: number;
          name?: string | null;
          number?: string | null;
          prefecture: Database["public"]["Enums"]["poster_prefecture_enum"];
          row_number?: number | null;
          status?: Database["public"]["Enums"]["poster_board_status"];
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          city?: string;
          created_at?: string;
          file_name?: string | null;
          id?: string;
          lat?: number;
          long?: number;
          name?: string | null;
          number?: string | null;
          prefecture?: Database["public"]["Enums"]["poster_prefecture_enum"];
          row_number?: number | null;
          status?: Database["public"]["Enums"]["poster_board_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      posting_activities: {
        Row: {
          created_at: string;
          id: string;
          location_text: string;
          mission_artifact_id: string;
          posting_count: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          location_text: string;
          mission_artifact_id: string;
          posting_count: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          location_text?: string;
          mission_artifact_id?: string;
          posting_count?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posting_activities_mission_artifact_id_fkey";
            columns: ["mission_artifact_id"];
            isOneToOne: false;
            referencedRelation: "mission_artifacts";
            referencedColumns: ["id"];
          },
        ];
      };
      posting_shapes: {
        Row: {
          coordinates: Json;
          created_at: string | null;
          id: string;
          properties: Json | null;
          type: string;
          updated_at: string | null;
        };
        Insert: {
          coordinates: Json;
          created_at?: string | null;
          id?: string;
          properties?: Json | null;
          type: string;
          updated_at?: string | null;
        };
        Update: {
          coordinates?: Json;
          created_at?: string | null;
          id?: string;
          properties?: Json | null;
          type?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      private_users: {
        Row: {
          address_prefecture: string;
          avatar_url: string | null;
          business_unit_id: string | null;
          created_at: string;
          date_of_birth: string;
          hubspot_contact_id: string | null;
          id: string;
          name: string;
          registered_at: string;
          slack_user_id: string | null;
          updated_at: string;
          x_username: string | null;
        };
        Insert: {
          address_prefecture: string;
          avatar_url?: string | null;
          business_unit_id?: string | null;
          created_at?: string;
          date_of_birth: string;
          hubspot_contact_id?: string | null;
          id: string;
          name: string;
          registered_at?: string;
          slack_user_id?: string | null;
          updated_at?: string;
          x_username?: string | null;
        };
        Update: {
          address_prefecture?: string;
          avatar_url?: string | null;
          business_unit_id?: string | null;
          created_at?: string;
          date_of_birth?: string;
          hubspot_contact_id?: string | null;
          id?: string;
          name?: string;
          registered_at?: string;
          slack_user_id?: string | null;
          updated_at?: string;
          x_username?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "private_users_business_unit_id_fkey";
            columns: ["business_unit_id"];
            isOneToOne: false;
            referencedRelation: "business_units";
            referencedColumns: ["id"];
          },
        ];
      };
      public_user_profiles: {
        Row: {
          address_prefecture: string;
          avatar_url: string | null;
          business_unit_id: string | null;
          created_at: string;
          github_username: string | null;
          id: string;
          name: string;
          x_username: string | null;
        };
        Insert: {
          address_prefecture: string;
          avatar_url?: string | null;
          business_unit_id?: string | null;
          created_at: string;
          github_username?: string | null;
          id: string;
          name: string;
          x_username?: string | null;
        };
        Update: {
          address_prefecture?: string;
          avatar_url?: string | null;
          business_unit_id?: string | null;
          created_at?: string;
          github_username?: string | null;
          id?: string;
          name?: string;
          x_username?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "public_user_profiles_business_unit_id_fkey";
            columns: ["business_unit_id"];
            isOneToOne: false;
            referencedRelation: "business_units";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_categories: {
        Row: {
          created_at: string;
          description: string | null;
          display_order: number;
          id: string;
          is_active: boolean;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      quiz_questions: {
        Row: {
          category_id: string;
          correct_answer: number;
          created_at: string;
          explanation: string | null;
          id: string;
          is_active: boolean;
          mission_id: string | null;
          option1: string;
          option2: string;
          option3: string;
          option4: string;
          question: string;
          question_order: number | null;
          updated_at: string;
        };
        Insert: {
          category_id: string;
          correct_answer: number;
          created_at?: string;
          explanation?: string | null;
          id?: string;
          is_active?: boolean;
          mission_id?: string | null;
          option1: string;
          option2: string;
          option3: string;
          option4: string;
          question: string;
          question_order?: number | null;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          correct_answer?: number;
          created_at?: string;
          explanation?: string | null;
          id?: string;
          is_active?: boolean;
          mission_id?: string | null;
          option1?: string;
          option2?: string;
          option3?: string;
          option4?: string;
          question?: string;
          question_order?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_questions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "quiz_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_questions_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "mission_achievement_count_view";
            referencedColumns: ["mission_id"];
          },
          {
            foreignKeyName: "quiz_questions_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "mission_category_view";
            referencedColumns: ["mission_id"];
          },
          {
            foreignKeyName: "quiz_questions_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "missions";
            referencedColumns: ["id"];
          },
        ];
      };
      slack_notifications: {
        Row: {
          created_at: string;
          error: string | null;
          event_id: string;
          event_type: string;
          id: string;
          payload: Json;
          sent_at: string | null;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          event_id: string;
          event_type: string;
          id?: string;
          payload: Json;
          sent_at?: string | null;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          event_id?: string;
          event_type?: string;
          id?: string;
          payload?: Json;
          sent_at?: string | null;
        };
        Relationships: [];
      };
      staging_poster_boards: {
        Row: {
          address: string | null;
          city: string;
          created_at: string;
          file_name: string | null;
          id: string | null;
          lat: number;
          long: number;
          name: string | null;
          number: string | null;
          prefecture: Database["public"]["Enums"]["poster_prefecture_enum"];
          row_number: number | null;
          status: Database["public"]["Enums"]["poster_board_status"];
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          city: string;
          created_at?: string;
          file_name?: string | null;
          id?: string | null;
          lat: number;
          long: number;
          name?: string | null;
          number?: string | null;
          prefecture: Database["public"]["Enums"]["poster_prefecture_enum"];
          row_number?: number | null;
          status?: Database["public"]["Enums"]["poster_board_status"];
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          city?: string;
          created_at?: string;
          file_name?: string | null;
          id?: string | null;
          lat?: number;
          long?: number;
          name?: string | null;
          number?: string | null;
          prefecture?: Database["public"]["Enums"]["poster_prefecture_enum"];
          row_number?: number | null;
          status?: Database["public"]["Enums"]["poster_board_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      survey_submit_throttle: {
        Row: {
          last_submitted_at: string;
          survey_id: string;
          user_id: string;
        };
        Insert: {
          last_submitted_at: string;
          survey_id: string;
          user_id: string;
        };
        Update: {
          last_submitted_at?: string;
          survey_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      unanswered_survey_global_exclusions: {
        Row: {
          created_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "unanswered_survey_global_exclusions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "private_users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_badges: {
        Row: {
          achieved_at: string;
          badge_image_path: string | null;
          badge_type: string;
          created_at: string;
          icon_image_path: string | null;
          id: string;
          is_notified: boolean;
          quarter_period: string | null;
          rank: number;
          sub_type: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          achieved_at?: string;
          badge_image_path?: string | null;
          badge_type: string;
          created_at?: string;
          icon_image_path?: string | null;
          id?: string;
          is_notified?: boolean;
          quarter_period?: string | null;
          rank: number;
          sub_type?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          achieved_at?: string;
          badge_image_path?: string | null;
          badge_type?: string;
          created_at?: string;
          icon_image_path?: string | null;
          id?: string;
          is_notified?: boolean;
          quarter_period?: string | null;
          rank?: number;
          sub_type?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_levels: {
        Row: {
          last_notified_level: number | null;
          level: number;
          updated_at: string;
          user_id: string;
          xp: number;
        };
        Insert: {
          last_notified_level?: number | null;
          level?: number;
          updated_at?: string;
          user_id: string;
          xp?: number;
        };
        Update: {
          last_notified_level?: number | null;
          level?: number;
          updated_at?: string;
          user_id?: string;
          xp?: number;
        };
        Relationships: [];
      };
      user_mission_likes: {
        Row: {
          created_at: string;
          id: string;
          user_id: string;
          user_mission_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          user_id: string;
          user_mission_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          user_id?: string;
          user_mission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_mission_likes_user_mission_id_fkey";
            columns: ["user_mission_id"];
            isOneToOne: false;
            referencedRelation: "user_missions";
            referencedColumns: ["id"];
          },
        ];
      };
      user_mission_mvv_items: {
        Row: {
          created_at: string;
          id: string;
          mvv_type: string;
          user_mission_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          mvv_type: string;
          user_mission_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          mvv_type?: string;
          user_mission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_mission_mvv_items_user_mission_id_fkey";
            columns: ["user_mission_id"];
            isOneToOne: false;
            referencedRelation: "user_missions";
            referencedColumns: ["id"];
          },
        ];
      };
      user_mission_praised_external_users: {
        Row: {
          created_at: string;
          id: string;
          praised_person_name: string;
          user_mission_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          praised_person_name: string;
          user_mission_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          praised_person_name?: string;
          user_mission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_mission_praised_external_users_user_mission_id_fkey";
            columns: ["user_mission_id"];
            isOneToOne: false;
            referencedRelation: "user_missions";
            referencedColumns: ["id"];
          },
        ];
      };
      user_mission_praised_users: {
        Row: {
          created_at: string;
          id: string;
          praised_user_id: string;
          user_mission_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          praised_user_id: string;
          user_mission_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          praised_user_id?: string;
          user_mission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_mission_praised_users_praised_user_id_fkey";
            columns: ["praised_user_id"];
            isOneToOne: false;
            referencedRelation: "private_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_mission_praised_users_user_mission_id_fkey";
            columns: ["user_mission_id"];
            isOneToOne: false;
            referencedRelation: "user_missions";
            referencedColumns: ["id"];
          },
        ];
      };
      user_missions: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          content: string;
          created_at: string;
          created_by: string;
          id: string;
          image_paths: Json | null;
          likes_count: number;
          public_mission_id: string | null;
          published_at: string | null;
          rejection_reason: string | null;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          content: string;
          created_at?: string;
          created_by: string;
          id?: string;
          image_paths?: Json | null;
          likes_count?: number;
          public_mission_id?: string | null;
          published_at?: string | null;
          rejection_reason?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          content?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          image_paths?: Json | null;
          likes_count?: number;
          public_mission_id?: string | null;
          published_at?: string | null;
          rejection_reason?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_missions_public_mission_id_fkey";
            columns: ["public_mission_id"];
            isOneToOne: false;
            referencedRelation: "mission_achievement_count_view";
            referencedColumns: ["mission_id"];
          },
          {
            foreignKeyName: "user_missions_public_mission_id_fkey";
            columns: ["public_mission_id"];
            isOneToOne: false;
            referencedRelation: "mission_category_view";
            referencedColumns: ["mission_id"];
          },
          {
            foreignKeyName: "user_missions_public_mission_id_fkey";
            columns: ["public_mission_id"];
            isOneToOne: false;
            referencedRelation: "missions";
            referencedColumns: ["id"];
          },
        ];
      };
      user_referral: {
        Row: {
          created_at: string | null;
          del_flg: boolean;
          referral_code: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          del_flg?: boolean;
          referral_code: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          del_flg?: boolean;
          referral_code?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      weekly_event_count_by_prefecture_summary: {
        Row: {
          count: number;
          created_at: string;
          date: string;
          prefecture: string;
        };
        Insert: {
          count: number;
          created_at?: string;
          date: string;
          prefecture: string;
        };
        Update: {
          count?: number;
          created_at?: string;
          date?: string;
          prefecture?: string;
        };
        Relationships: [];
      };
      weekly_event_count_summary: {
        Row: {
          count: number;
          created_at: string;
          date: string;
        };
        Insert: {
          count: number;
          created_at?: string;
          date: string;
        };
        Update: {
          count?: number;
          created_at?: string;
          date?: string;
        };
        Relationships: [];
      };
      xp_transactions: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          source_id: string | null;
          source_type: string;
          user_id: string;
          xp_amount: number;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          source_id?: string | null;
          source_type: string;
          user_id: string;
          xp_amount: number;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          source_id?: string | null;
          source_type?: string;
          user_id?: string;
          xp_amount?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      activity_timeline_view: {
        Row: {
          address_prefecture: string | null;
          avatar_url: string | null;
          created_at: string | null;
          id: string | null;
          name: string | null;
          title: string | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      mission_achievement_count_view: {
        Row: {
          achievement_count: number | null;
          mission_id: string | null;
        };
        Relationships: [];
      };
      mission_category_view: {
        Row: {
          artifact_label: string | null;
          category_id: string | null;
          category_kbn: string | null;
          category_sort_no: number | null;
          category_title: string | null;
          content: string | null;
          created_at: string | null;
          difficulty: number | null;
          event_date: string | null;
          icon_url: string | null;
          is_featured: boolean | null;
          is_hidden: boolean | null;
          link_sort_no: number | null;
          max_achievement_count: number | null;
          mission_id: string | null;
          ogp_image_url: string | null;
          required_artifact_type: string | null;
          title: string | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
      mission_quiz_with_links: {
        Row: {
          category_description: string | null;
          category_id: string | null;
          category_name: string | null;
          correct_answer: number | null;
          explanation: string | null;
          mission_id: string | null;
          mission_links: Json | null;
          option1: string | null;
          option2: string | null;
          option3: string | null;
          option4: string | null;
          question: string | null;
          question_id: string | null;
          question_order: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_questions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "quiz_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_questions_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "mission_achievement_count_view";
            referencedColumns: ["mission_id"];
          },
          {
            foreignKeyName: "quiz_questions_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "mission_category_view";
            referencedColumns: ["mission_id"];
          },
          {
            foreignKeyName: "quiz_questions_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "missions";
            referencedColumns: ["id"];
          },
        ];
      };
      poster_board_latest_editors: {
        Row: {
          board_id: string | null;
          last_edited_at: string | null;
          last_editor_id: string | null;
          lat: number | null;
          long: number | null;
          new_status: Database["public"]["Enums"]["poster_board_status"] | null;
          prefecture:
            | Database["public"]["Enums"]["poster_prefecture_enum"]
            | null;
          previous_status:
            | Database["public"]["Enums"]["poster_board_status"]
            | null;
          status: Database["public"]["Enums"]["poster_board_status"] | null;
        };
        Relationships: [];
      };
      quiz_questions_with_category: {
        Row: {
          category_description: string | null;
          category_display_order: number | null;
          category_id: string | null;
          category_name: string | null;
          correct_answer: number | null;
          created_at: string | null;
          explanation: string | null;
          id: string | null;
          is_active: boolean | null;
          mission_id: string | null;
          option1: string | null;
          option2: string | null;
          option3: string | null;
          option4: string | null;
          question: string | null;
          question_order: number | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_questions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "quiz_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_questions_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "mission_achievement_count_view";
            referencedColumns: ["mission_id"];
          },
          {
            foreignKeyName: "quiz_questions_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "mission_category_view";
            referencedColumns: ["mission_id"];
          },
          {
            foreignKeyName: "quiz_questions_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "missions";
            referencedColumns: ["id"];
          },
        ];
      };
      user_ranking_view: {
        Row: {
          address_prefecture: string | null;
          level: number | null;
          name: string | null;
          rank: number | null;
          updated_at: string | null;
          user_id: string | null;
          xp: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      calculate_level_from_xp: { Args: { xp: number }; Returns: number };
      get_daily_user_mission_counts: {
        Args: { p_end_date: string; p_start_date: string };
        Returns: {
          count: number;
          date: string;
        }[];
      };
      get_daily_user_mission_likes_counts: {
        Args: { p_end_date: string; p_start_date: string };
        Returns: {
          count: number;
          date: string;
        }[];
      };
      get_likes_ranking: {
        Args: { limit_count?: number };
        Returns: {
          address_prefecture: string;
          likes_count: number;
          rank: number;
          user_id: string;
          user_name: string;
        }[];
      };
      get_mission_links: {
        Args: { p_mission_id: string };
        Returns: {
          display_order: number;
          link: string;
          remark: string;
        }[];
      };
      get_mission_quiz_questions: {
        Args: { p_mission_id: string };
        Returns: {
          category_description: string;
          category_id: string;
          category_name: string;
          correct_answer: number;
          explanation: string;
          mission_links: Json;
          option1: string;
          option2: string;
          option3: string;
          option4: string;
          question: string;
          question_id: string;
          question_order: number;
        }[];
      };
      get_mission_ranking: {
        Args: { limit_count?: number; mission_id: string };
        Returns: {
          address_prefecture: string;
          clear_count: number;
          level: number;
          rank: number;
          total_points: number;
          updated_at: string;
          user_id: string;
          user_name: string;
          xp: number;
        }[];
      };
      get_period_likes_ranking: {
        Args: { p_limit?: number; p_start_date?: string };
        Returns: {
          address_prefecture: string;
          likes_count: number;
          rank: number;
          user_id: string;
          user_name: string;
        }[];
      };
      get_period_mission_ranking: {
        Args: { p_limit?: number; p_mission_id: string; p_start_date?: string };
        Returns: {
          address_prefecture: string;
          mission_id: string;
          name: string;
          rank: number;
          total_points: number;
          user_achievement_count: number;
          user_id: string;
        }[];
      };
      get_period_prefecture_ranking: {
        Args: { p_limit?: number; p_prefecture: string; p_start_date?: string };
        Returns: {
          name: string;
          rank: number;
          user_id: string;
          xp: number;
        }[];
      };
      get_period_ranking: {
        Args: { p_end_date?: string; p_limit?: number; p_start_date?: string };
        Returns: {
          address_prefecture: string;
          level: number;
          name: string;
          rank: number;
          updated_at: string;
          user_id: string;
          xp: number;
        }[];
      };
      get_poster_board_stats: {
        Args: never;
        Returns: {
          count: number;
          prefecture: string;
          status: Database["public"]["Enums"]["poster_board_status"];
        }[];
      };
      get_poster_board_stats_optimized: {
        Args: {
          target_prefecture: Database["public"]["Enums"]["poster_prefecture_enum"];
        };
        Returns: {
          status_counts: Json;
          total_count: number;
        }[];
      };
      get_prefecture_ranking: {
        Args: { limit_count?: number; prefecture: string };
        Returns: {
          address_prefecture: string;
          level: number;
          rank: number;
          updated_at: string;
          user_id: string;
          user_name: string;
          xp: number;
        }[];
      };
      get_top_users_posting_count: {
        Args: { user_ids: string[] };
        Returns: {
          posting_count: number;
          user_id: string;
        }[];
      };
      get_user_by_email: {
        Args: { user_email: string };
        Returns: {
          email: string;
          id: string;
          user_metadata: Json;
        }[];
      };
      get_user_edited_boards_by_prefecture: {
        Args: {
          target_prefecture: Database["public"]["Enums"]["poster_prefecture_enum"];
          target_user_id: string;
        };
        Returns: {
          board_id: string;
        }[];
      };
      get_user_edited_boards_with_details: {
        Args: {
          target_prefecture: Database["public"]["Enums"]["poster_prefecture_enum"];
          target_user_id: string;
        };
        Returns: {
          board_id: string;
          last_edited_at: string;
          lat: number;
          long: number;
          status: Database["public"]["Enums"]["poster_board_status"];
        }[];
      };
      get_user_likes_ranking: {
        Args: { target_user_id: string };
        Returns: {
          address_prefecture: string;
          likes_count: number;
          rank: number;
          user_id: string;
          user_name: string;
        }[];
      };
      get_user_mission_ranking: {
        Args: { mission_id: string; user_id: string };
        Returns: {
          address_prefecture: string;
          clear_count: number;
          level: number;
          rank: number;
          total_points: number;
          updated_at: string;
          user_id: string;
          user_name: string;
          xp: number;
        }[];
      };
      get_user_period_likes_ranking: {
        Args: { p_start_date?: string; p_user_id: string };
        Returns: {
          address_prefecture: string;
          likes_count: number;
          rank: number;
          user_id: string;
          user_name: string;
        }[];
      };
      get_user_period_mission_ranking: {
        Args: {
          p_mission_id: string;
          p_start_date?: string;
          p_user_id: string;
        };
        Returns: {
          address_prefecture: string;
          mission_id: string;
          name: string;
          rank: number;
          total_points: number;
          user_achievement_count: number;
          user_id: string;
        }[];
      };
      get_user_period_prefecture_ranking: {
        Args: {
          p_prefecture: string;
          p_start_date?: string;
          p_user_id: string;
        };
        Returns: {
          level: number;
          name: string;
          rank: number;
          user_id: string;
          xp: number;
        }[];
      };
      get_user_period_ranking: {
        Args: { start_date?: string; target_user_id: string };
        Returns: {
          address_prefecture: string;
          level: number;
          name: string;
          rank: number;
          updated_at: string;
          user_id: string;
          xp: number;
        }[];
      };
      get_user_posting_count: {
        Args: { target_user_id: string };
        Returns: number;
      };
      replace_award_responses: {
        Args: {
          p_grant_id?: string | null;
          p_grant_token?: string | null;
          p_rows: Json;
          p_survey_id: string;
        };
        Returns: undefined;
      };
      replace_enps_responses: {
        Args: {
          p_grant_id?: string | null;
          p_grant_token?: string | null;
          p_rows: Json;
          p_survey_id: string;
        };
        Returns: undefined;
      };
      get_user_prefecture_ranking: {
        Args: { prefecture: string; target_user_id: string };
        Returns: {
          address_prefecture: string;
          level: number;
          rank: number;
          updated_at: string;
          user_id: string;
          user_name: string;
          xp: number;
        }[];
      };
      total_xp_for_level: { Args: { level: number }; Returns: number };
    };
    Enums: {
      poster_board_status:
        | "not_yet"
        | "reserved"
        | "done"
        | "error_wrong_place"
        | "error_damaged"
        | "error_wrong_poster"
        | "other";
      poster_prefecture_enum:
        | "北海道"
        | "宮城県"
        | "埼玉県"
        | "千葉県"
        | "東京都"
        | "神奈川県"
        | "長野県"
        | "愛知県"
        | "大阪府"
        | "兵庫県"
        | "愛媛県"
        | "福岡県";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      poster_board_status: [
        "not_yet",
        "reserved",
        "done",
        "error_wrong_place",
        "error_damaged",
        "error_wrong_poster",
        "other",
      ],
      poster_prefecture_enum: [
        "北海道",
        "宮城県",
        "埼玉県",
        "千葉県",
        "東京都",
        "神奈川県",
        "長野県",
        "愛知県",
        "大阪府",
        "兵庫県",
        "愛媛県",
        "福岡県",
      ],
    },
  },
} as const;
