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
      checkins: {
        Row: {
          device_info: string | null
          id: string
          location: string | null
          scanned_at: string
          scanned_by: string
          ticket_id: string
        }
        Insert: {
          device_info?: string | null
          id?: string
          location?: string | null
          scanned_at?: string
          scanned_by: string
          ticket_id: string
        }
        Update: {
          device_info?: string | null
          id?: string
          location?: string | null
          scanned_at?: string
          scanned_by?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_scanned_by_fkey"
            columns: ["scanned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_scanned_by_fkey"
            columns: ["scanned_by"]
            isOneToOne: false
            referencedRelation: "v_member_revenue"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "checkins_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      course_instructors: {
        Row: {
          course_id: string
          created_at: string | null
          id: string
          instructor_id: string
          is_primary: boolean | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          id?: string
          instructor_id: string
          is_primary?: boolean | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          id?: string
          instructor_id?: string
          is_primary?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "course_instructors_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_instructors_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_instructors_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "v_member_revenue"
            referencedColumns: ["member_id"]
          },
        ]
      }
      course_lessons: {
        Row: {
          course_id: string
          created_at: string
          ends_at: string | null
          id: string
          notes: string | null
          starts_at: string
          title: string | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          notes?: string | null
          starts_at: string
          title?: string | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          notes?: string | null
          starts_at?: string
          title?: string | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_page_sections: {
        Row: {
          content: Json
          course_id: string
          created_at: string
          id: string
          is_visible: boolean | null
          position: number
          section_type: string
          title: string | null
          updated_at: string
        }
        Insert: {
          content?: Json
          course_id: string
          created_at?: string
          id?: string
          is_visible?: boolean | null
          position?: number
          section_type: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: Json
          course_id?: string
          created_at?: string
          id?: string
          is_visible?: boolean | null
          position?: number
          section_type?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_page_sections_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          capacity: number
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          instructor_id: string | null
          level: string
          points: number
          price_cents: number
          primary_instructor: string | null
          starts_at: string | null
          status: string
          title: string
          venue: string | null
        }
        Insert: {
          capacity?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          instructor_id?: string | null
          level?: string
          points?: number
          price_cents?: number
          primary_instructor?: string | null
          starts_at?: string | null
          status?: string
          title: string
          venue?: string | null
        }
        Update: {
          capacity?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          instructor_id?: string | null
          level?: string
          points?: number
          price_cents?: number
          primary_instructor?: string | null
          starts_at?: string | null
          status?: string
          title?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_member_revenue"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "courses_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "v_member_revenue"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "courses_primary_instructor_fkey"
            columns: ["primary_instructor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_primary_instructor_fkey"
            columns: ["primary_instructor"]
            isOneToOne: false
            referencedRelation: "v_member_revenue"
            referencedColumns: ["member_id"]
          },
        ]
      }
      event_bookings: {
        Row: {
          booked_at: string
          created_at: string
          event_id: string
          id: string
          member_id: string
          payment_status: string
          qr_payload: string | null
          status: string
        }
        Insert: {
          booked_at?: string
          created_at?: string
          event_id: string
          id?: string
          member_id: string
          payment_status?: string
          qr_payload?: string | null
          status?: string
        }
        Update: {
          booked_at?: string
          created_at?: string
          event_id?: string
          id?: string
          member_id?: string
          payment_status?: string
          qr_payload?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_member_revenue"
            referencedColumns: ["member_id"]
          },
        ]
      }
      event_checkins: {
        Row: {
          booking_id: string
          created_at: string
          device_info: string | null
          event_id: string
          id: string
          location: string | null
          member_id: string
          scanned_at: string
          scanned_by: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          device_info?: string | null
          event_id: string
          id?: string
          location?: string | null
          member_id: string
          scanned_at?: string
          scanned_by: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          device_info?: string | null
          event_id?: string
          id?: string
          location?: string | null
          member_id?: string
          scanned_at?: string
          scanned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_checkins_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkins_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkins_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_member_revenue"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "event_checkins_scanned_by_fkey"
            columns: ["scanned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkins_scanned_by_fkey"
            columns: ["scanned_by"]
            isOneToOne: false
            referencedRelation: "v_member_revenue"
            referencedColumns: ["member_id"]
          },
        ]
      }
      event_page_sections: {
        Row: {
          content: Json
          created_at: string | null
          event_id: string
          id: string
          is_visible: boolean | null
          position: number
          section_type: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          content: Json
          created_at?: string | null
          event_id: string
          id?: string
          is_visible?: boolean | null
          position?: number
          section_type: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: Json
          created_at?: string | null
          event_id?: string
          id?: string
          is_visible?: boolean | null
          position?: number
          section_type?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_page_sections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number
          created_at: string
          created_by: string
          currency: string
          description: string
          discount_type: string
          discount_value: number | null
          end_at: string | null
          id: string
          image_url: string | null
          price_cents: number
          sold_count: number
          start_at: string
          status: string
          title: string
          updated_at: string
          venue: string
        }
        Insert: {
          capacity: number
          created_at?: string
          created_by: string
          currency?: string
          description: string
          discount_type?: string
          discount_value?: number | null
          end_at?: string | null
          id?: string
          image_url?: string | null
          price_cents: number
          sold_count?: number
          start_at: string
          status?: string
          title: string
          updated_at?: string
          venue: string
        }
        Update: {
          capacity?: number
          created_at?: string
          created_by?: string
          currency?: string
          description?: string
          discount_type?: string
          discount_value?: number | null
          end_at?: string | null
          id?: string
          image_url?: string | null
          price_cents?: number
          sold_count?: number
          start_at?: string
          status?: string
          title?: string
          updated_at?: string
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_member_revenue"
            referencedColumns: ["member_id"]
          },
        ]
      }
      lesson_bookings: {
        Row: {
          checkins_allowed: number
          checkins_used: number
          created_at: string
          id: string
          lesson_id: string
          member_id: string
          purchased_at: string
          qr_payload: string
          status: string
          ticket_type: string
        }
        Insert: {
          checkins_allowed?: number
          checkins_used?: number
          created_at?: string
          id?: string
          lesson_id: string
          member_id: string
          purchased_at?: string
          qr_payload?: string
          status?: string
          ticket_type: string
        }
        Update: {
          checkins_allowed?: number
          checkins_used?: number
          created_at?: string
          id?: string
          lesson_id?: string
          member_id?: string
          purchased_at?: string
          qr_payload?: string
          status?: string
          ticket_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_lesson_bookings_lesson"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_lesson_bookings_member"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_lesson_bookings_member"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_member_revenue"
            referencedColumns: ["member_id"]
          },
        ]
      }
      member_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          member_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          member_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "v_member_revenue"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_notes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_notes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_member_revenue"
            referencedColumns: ["member_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          description: string | null
          id: string
          member_id: string
          status: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          member_id: string
          status: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          member_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_member_revenue"
            referencedColumns: ["member_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          dance_experience: Json | null
          dance_role: Database["public"]["Enums"]["dance_role_type"] | null
          email: string | null
          full_name: string | null
          id: string
          level: string | null
          phone: string | null
          preferred_locale: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          dance_experience?: Json | null
          dance_role?: Database["public"]["Enums"]["dance_role_type"] | null
          email?: string | null
          full_name?: string | null
          id: string
          level?: string | null
          phone?: string | null
          preferred_locale?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          dance_experience?: Json | null
          dance_role?: Database["public"]["Enums"]["dance_role_type"] | null
          email?: string | null
          full_name?: string | null
          id?: string
          level?: string | null
          phone?: string | null
          preferred_locale?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          member_id: string
          plan: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          member_id: string
          plan: string
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          member_id?: string
          plan?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_member_revenue"
            referencedColumns: ["member_id"]
          },
        ]
      }
      tickets: {
        Row: {
          course_id: string | null
          expires_at: string | null
          id: string
          member_id: string
          order_id: string | null
          purchased_at: string
          qr_payload: string
          source_course_id: string | null
          status: string
          tickets_used: number
          total_tickets: number
        }
        Insert: {
          course_id?: string | null
          expires_at?: string | null
          id?: string
          member_id: string
          order_id?: string | null
          purchased_at?: string
          qr_payload: string
          source_course_id?: string | null
          status?: string
          tickets_used?: number
          total_tickets?: number
        }
        Update: {
          course_id?: string | null
          expires_at?: string | null
          id?: string
          member_id?: string
          order_id?: string | null
          purchased_at?: string
          qr_payload?: string
          source_course_id?: string | null
          status?: string
          tickets_used?: number
          total_tickets?: number
        }
        Relationships: [
          {
            foreignKeyName: "tickets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_member_revenue"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "tickets_source_course_id_fkey"
            columns: ["source_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_member_revenue"
            referencedColumns: ["member_id"]
          },
        ]
      }
    }
    Views: {
      v_member_checkins: {
        Row: {
          checkins_count: number | null
          last_checkin_at: string | null
          member_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "v_member_revenue"
            referencedColumns: ["member_id"]
          },
        ]
      }
      v_member_revenue: {
        Row: {
          member_id: string | null
          revenue_cents: number | null
          txn_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_create_member: {
        Args: {
          p_email: string
          p_full_name: string
          p_level?: string
          p_password: string
          p_phone?: string
          p_role?: Database["public"]["Enums"]["app_role"]
        }
        Returns: Json
      }
      admin_delete_member: { Args: { target_user_id: string }; Returns: Json }
      admin_manual_checkin: {
        Args: { p_course_id: string; p_member_id: string; p_note?: string }
        Returns: Json
      }
      admin_update_member: {
        Args: {
          new_level?: string
          new_status?: string
          points_delta?: number
          target: string
        }
        Returns: Json
      }
      admin_update_member_profile: {
        Args: {
          p_email?: string
          p_full_name?: string
          p_level?: string
          p_phone?: string
          p_points?: number
          p_role?: Database["public"]["Enums"]["app_role"]
          p_status?: string
          target_user_id: string
        }
        Returns: Json
      }
      check_in_with_qr: {
        Args: { p_device_info?: string; p_location?: string; qr: string }
        Returns: Json
      }
      get_member_display_name: { Args: { member_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "instructor" | "member"
      dance_role_type: "follower" | "leader"
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
      app_role: ["admin", "instructor", "member"],
      dance_role_type: ["follower", "leader"],
    },
  },
} as const
