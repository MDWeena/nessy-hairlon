export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type BookingStatus = "pending_review" | "quoted" | "deposit_paid" | "confirmed" | "completed" | "cancelled";

export type AttachmentPreference = "client_provides" | "nessy_buys";

export interface MaterialItem {
  type: string;
  quantity: number;
  unit_cost: number;
}

export interface Database {
  public: {
    Tables: {
      services: {
        Row: {
          id: string;
          category: string;
          name: string;
          description: string;
          duration: string;
          price: string | null;
          price_range_min: number | null;
          price_range_max: number | null;
          icon_name: string;
          image_url: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          category: string;
          name: string;
          description: string;
          duration: string;
          price?: string | null;
          price_range_min?: number | null;
          price_range_max?: number | null;
          icon_name: string;
          image_url?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["services"]["Insert"]>;
        Relationships: [];
      };
      schedule_defaults: {
        Row: {
          id: string;
          day_key: string;
          is_open: boolean;
          start_hour: number;
          end_hour: number;
          max_slots_per_day: number;
          min_gap_hours: number;
        };
        Insert: {
          id?: string;
          day_key: string;
          is_open?: boolean;
          start_hour?: number;
          end_hour?: number;
          max_slots_per_day?: number;
          min_gap_hours?: number;
        };
        Update: Partial<Database["public"]["Tables"]["schedule_defaults"]["Insert"]>;
        Relationships: [];
      };
      blocked_slots: {
        Row: {
          id: string;
          date: string;
          hour: number | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          hour?: number | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["blocked_slots"]["Insert"]>;
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          client_name: string;
          client_phone: string;
          client_email: string | null;
          booking_date: string;
          booking_time: string;
          service_ids: string[];
          custom_style_url: string | null;
          custom_style_description: string | null;
          status: BookingStatus;
          quoted_price: number | null;
          notes: string | null;
          deposit_confirmed_at: string | null;
          payment_proof_url: string | null;
          created_at: string;
          updated_at: string;
          attachment_preference: AttachmentPreference | null;
          attachment_items: MaterialItem[];
          accessory_items: MaterialItem[];
          hair_service_cost: number | null;
          balance_paid_at: string | null;
          balance_reminder_sent_at: string | null;
          style_reference_urls: string[];
        };
        Insert: {
          id?: string;
          client_name: string;
          client_phone: string;
          client_email?: string | null;
          booking_date: string;
          booking_time: string;
          service_ids?: string[];
          custom_style_url?: string | null;
          custom_style_description?: string | null;
          status?: BookingStatus;
          quoted_price?: number | null;
          notes?: string | null;
          deposit_confirmed_at?: string | null;
          payment_proof_url?: string | null;
          created_at?: string;
          updated_at?: string;
          attachment_preference?: AttachmentPreference | null;
          attachment_items?: MaterialItem[];
          accessory_items?: MaterialItem[];
          hair_service_cost?: number | null;
          balance_paid_at?: string | null;
          balance_reminder_sent_at?: string | null;
          style_reference_urls?: string[];
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Insert"]>;
        Relationships: [];
      };
      testimonials: {
        Row: {
          id: string;
          client_name: string;
          review_text: string;
          stars: number;
          is_visible: boolean;
          sort_order: number;
          created_at: string;
          review_date: string;
          booking_id: string | null;
          is_verified: boolean;
        };
        Insert: {
          id?: string;
          client_name: string;
          review_text: string;
          stars: number;
          is_visible?: boolean;
          sort_order?: number;
          created_at?: string;
          review_date?: string;
          booking_id?: string | null;
          is_verified?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["testimonials"]["Insert"]>;
        Relationships: [];
      };
      booking_reminders: {
        Row: {
          id: string;
          booking_id: string;
          reminder_type: string;
          scheduled_for: string;
          sent_at: string | null;
          channel: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          reminder_type: string;
          scheduled_for: string;
          sent_at?: string | null;
          channel?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["booking_reminders"]["Insert"]>;
        Relationships: [];
      };
      gallery: {
        Row: {
          id: string;
          day_of_week: string;
          style_name: string;
          image_url: string | null;
          description: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          day_of_week: string;
          style_name: string;
          image_url?: string | null;
          description?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["gallery"]["Insert"]>;
        Relationships: [];
      };
      settings: {
        Row: {
          id: string;
          key: string;
          value: Json;
        };
        Insert: {
          id?: string;
          key: string;
          value: Json;
        };
        Update: Partial<Database["public"]["Tables"]["settings"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      public_booking_slots: {
        Row: {
          booking_date: string;
          booking_time: string;
          status: BookingStatus;
        };
        Relationships: [];
      };
    };
    Functions: {
      lookup_bookings: {
        Args: { p_reference?: string | null; p_phone?: string | null };
        Returns: {
          id: string;
          client_name: string;
          booking_date: string;
          booking_time: string;
          status: BookingStatus;
          quoted_price: number | null;
          service_ids: string[];
          custom_style_url: string | null;
          custom_style_description: string | null;
          created_at: string;
          attachment_preference: AttachmentPreference | null;
          attachment_items: MaterialItem[];
          accessory_items: MaterialItem[];
          hair_service_cost: number | null;
          balance_paid_at: string | null;
          balance_reminder_sent_at: string | null;
        }[];
      };
      reschedule_booking: {
        Args: { p_reference: string; p_phone: string; p_new_date: string; p_new_time: string };
        Returns: undefined;
      };
      cancel_booking: {
        Args: { p_reference: string; p_phone: string };
        Returns: undefined;
      };
      mark_deposit_paid: {
        Args: { p_reference: string; p_phone: string; p_payment_proof_url?: string | null };
        Returns: undefined;
      };
      submit_review: {
        Args: { p_reference: string; p_phone: string; p_stars: number; p_review_text: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
}
