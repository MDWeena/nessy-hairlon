export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type BookingStatus = "pending_review" | "quoted" | "confirmed" | "completed" | "cancelled";

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
        };
        Insert: {
          id?: string;
          day_key: string;
          is_open?: boolean;
          start_hour?: number;
          end_hour?: number;
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
          created_at: string;
          updated_at: string;
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
          created_at?: string;
          updated_at?: string;
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
        };
        Insert: {
          id?: string;
          client_name: string;
          review_text: string;
          stars: number;
          is_visible?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["testimonials"]["Insert"]>;
        Relationships: [];
      };
      gallery: {
        Row: {
          id: string;
          day_of_week: string;
          style_name: string;
          image_url: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          day_of_week: string;
          style_name: string;
          image_url?: string | null;
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
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
