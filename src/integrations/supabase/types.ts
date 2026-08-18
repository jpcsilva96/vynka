export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_type: string;
          actor_user_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          metadata: Json | null;
          store_id: string | null;
        };
        Insert: {
          action: string;
          actor_type?: string;
          actor_user_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          metadata?: Json | null;
          store_id?: string | null;
        };
        Update: {
          action?: string;
          actor_type?: string;
          actor_user_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          metadata?: Json | null;
          store_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          active: boolean;
          created_at: string;
          display_order: number;
          id: string;
          name: string;
          parent_id: string | null;
          position: number;
          slug: string;
          store_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          display_order?: number;
          id?: string;
          name: string;
          parent_id?: string | null;
          position?: number;
          slug: string;
          store_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          display_order?: number;
          id?: string;
          name?: string;
          parent_id?: string | null;
          position?: number;
          slug?: string;
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "categories_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          address_number: string | null;
          birth_date: string | null;
          city: string | null;
          complement: string | null;
          created_at: string;
          document: string | null;
          email: string | null;
          id: string;
          mobile: string | null;
          name: string;
          neighborhood: string | null;
          notes: string | null;
          phone: string | null;
          state: string | null;
          store_id: string;
          street: string | null;
          telephone: string | null;
          updated_at: string;
          user_id: string | null;
          zip_code: string | null;
        };
        Insert: {
          address_number?: string | null;
          birth_date?: string | null;
          city?: string | null;
          complement?: string | null;
          created_at?: string;
          document?: string | null;
          email?: string | null;
          id?: string;
          mobile?: string | null;
          name: string;
          neighborhood?: string | null;
          notes?: string | null;
          phone?: string | null;
          state?: string | null;
          store_id: string;
          street?: string | null;
          telephone?: string | null;
          updated_at?: string;
          user_id?: string | null;
          zip_code?: string | null;
        };
        Update: {
          address_number?: string | null;
          birth_date?: string | null;
          city?: string | null;
          complement?: string | null;
          created_at?: string;
          document?: string | null;
          email?: string | null;
          id?: string;
          mobile?: string | null;
          name?: string;
          neighborhood?: string | null;
          notes?: string | null;
          phone?: string | null;
          state?: string | null;
          store_id?: string;
          street?: string | null;
          telephone?: string | null;
          updated_at?: string;
          user_id?: string | null;
          zip_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_favorites: {
        Row: {
          created_at: string;
          customer_id: string;
          id: string;
          product_id: string;
          store_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          id?: string;
          product_id: string;
          store_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          id?: string;
          product_id?: string;
          store_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_favorites_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_favorites_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_favorites_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          store_id: string;
          total_cost: number;
          total_price: number;
          unit_cost: number;
          unit_price: number;
          variant_id: string | null;
          variant_name: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          quantity?: number;
          store_id: string;
          total_cost?: number;
          total_price?: number;
          unit_cost?: number;
          unit_price?: number;
          variant_id?: string | null;
          variant_name?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          order_id?: string;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          store_id?: string;
          total_cost?: number;
          total_price?: number;
          unit_cost?: number;
          unit_price?: number;
          variant_id?: string | null;
          variant_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          change_due: number | null;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          discount: number;
          id: string;
          notes: string | null;
          number: number | null;
          paid_amount: number | null;
          payment_details: Json;
          payment_method: string | null;
          source: Database["public"]["Enums"]["order_source"];
          status: Database["public"]["Enums"]["order_status"];
          store_id: string;
          subtotal: number;
          surcharge: number;
          total: number;
          updated_at: string;
        };
        Insert: {
          change_due?: number | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          discount?: number;
          id?: string;
          notes?: string | null;
          number?: number | null;
          paid_amount?: number | null;
          payment_details?: Json;
          payment_method?: string | null;
          source?: Database["public"]["Enums"]["order_source"];
          status?: Database["public"]["Enums"]["order_status"];
          store_id: string;
          subtotal?: number;
          surcharge?: number;
          total?: number;
          updated_at?: string;
        };
        Update: {
          change_due?: number | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          discount?: number;
          id?: string;
          notes?: string | null;
          number?: number | null;
          paid_amount?: number | null;
          payment_details?: Json;
          payment_method?: string | null;
          source?: Database["public"]["Enums"]["order_source"];
          status?: Database["public"]["Enums"]["order_status"];
          store_id?: string;
          subtotal?: number;
          surcharge?: number;
          total?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          active: boolean;
          allow_custom_domain: boolean;
          allow_site_orders: boolean;
          allow_whatsapp_orders: boolean;
          created_at: string;
          description: string | null;
          id: string;
          max_products: number;
          max_users: number;
          name: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          allow_custom_domain?: boolean;
          allow_site_orders?: boolean;
          allow_whatsapp_orders?: boolean;
          created_at?: string;
          description?: string | null;
          id?: string;
          max_products?: number;
          max_users?: number;
          name: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          allow_custom_domain?: boolean;
          allow_site_orders?: boolean;
          allow_whatsapp_orders?: boolean;
          created_at?: string;
          description?: string | null;
          id?: string;
          max_products?: number;
          max_users?: number;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_users: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["platform_role"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["platform_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["platform_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      product_images: {
        Row: {
          created_at: string;
          id: string;
          position: number;
          product_id: string;
          storage_path: string | null;
          url: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          position?: number;
          product_id: string;
          storage_path?: string | null;
          url: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          position?: number;
          product_id?: string;
          storage_path?: string | null;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_option_values: {
        Row: {
          id: string;
          option_id: string;
          position: number;
          value: string;
        };
        Insert: {
          id?: string;
          option_id: string;
          position?: number;
          value: string;
        };
        Update: {
          id?: string;
          option_id?: string;
          position?: number;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_option_values_option_id_fkey";
            columns: ["option_id"];
            isOneToOne: false;
            referencedRelation: "product_options";
            referencedColumns: ["id"];
          },
        ];
      };
      product_options: {
        Row: {
          id: string;
          name: string;
          position: number;
          product_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          position?: number;
          product_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          position?: number;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_options_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          available: boolean;
          created_at: string;
          id: string;
          image_url: string | null;
          options: Json;
          position: number;
          price: number | null;
          product_id: string;
          sku_key: string;
          stock_quantity: number;
          store_id: string;
        };
        Insert: {
          available?: boolean;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          options?: Json;
          position?: number;
          price?: number | null;
          product_id: string;
          sku_key: string;
          stock_quantity?: number;
          store_id: string;
        };
        Update: {
          available?: boolean;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          options?: Json;
          position?: number;
          price?: number | null;
          product_id?: string;
          sku_key?: string;
          stock_quantity?: number;
          store_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variants_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          category_id: string | null;
          cost_price: number;
          created_at: string;
          description: string | null;
          display_order: number;
          featured: boolean;
          id: string;
          manage_stock: boolean;
          name: string;
          position: number;
          price: number;
          promo_price: number | null;
          slug: string | null;
          status: Database["public"]["Enums"]["product_status"];
          store_id: string;
          updated_at: string;
        };
        Insert: {
          category_id?: string | null;
          cost_price?: number;
          created_at?: string;
          description?: string | null;
          display_order?: number;
          featured?: boolean;
          id?: string;
          manage_stock?: boolean;
          name?: string;
          position?: number;
          price?: number;
          promo_price?: number | null;
          slug?: string | null;
          status?: Database["public"]["Enums"]["product_status"];
          store_id: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          cost_price?: number;
          created_at?: string;
          description?: string | null;
          display_order?: number;
          featured?: boolean;
          id?: string;
          manage_stock?: boolean;
          name?: string;
          position?: number;
          price?: number;
          promo_price?: number | null;
          slug?: string | null;
          status?: Database["public"]["Enums"]["product_status"];
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      store_members: {
        Row: {
          active: boolean;
          created_at: string;
          email: string | null;
          id: string;
          name: string | null;
          permissions: Json;
          role: Database["public"]["Enums"]["member_role"];
          store_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string | null;
          permissions?: Json;
          role?: Database["public"]["Enums"]["member_role"];
          store_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string | null;
          permissions?: Json;
          role?: Database["public"]["Enums"]["member_role"];
          store_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_members_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      store_settings: {
        Row: {
          created_at: string;
          id: string;
          setting_key: string;
          setting_value: Json | null;
          store_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          setting_key: string;
          setting_value?: Json | null;
          store_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          setting_key?: string;
          setting_value?: Json | null;
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_settings_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      store_banners: {
        Row: {
          active: boolean;
          button_label: string | null;
          created_at: string;
          id: string;
          image_url: string;
          link_target: string | null;
          link_type: string;
          sort_order: number;
          store_id: string;
          subtitle: string | null;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          button_label?: string | null;
          created_at?: string;
          id?: string;
          image_url: string;
          link_target?: string | null;
          link_type?: string;
          sort_order?: number;
          store_id: string;
          subtitle?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          button_label?: string | null;
          created_at?: string;
          id?: string;
          image_url?: string;
          link_target?: string | null;
          link_type?: string;
          sort_order?: number;
          store_id?: string;
          subtitle?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_banners_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      stores: {
        Row: {
          accepts_site_orders: boolean;
          accepts_whatsapp_orders: boolean;
          address: string | null;
          address_number: string | null;
          banner_cta: string | null;
          banner_subtitle: string | null;
          banner_title: string | null;
          banner_url: string | null;
          business_hours: string | null;
          city: string | null;
          combine_delivery_whatsapp: boolean;
          complement: string | null;
          created_at: string;
          delivery_available: boolean;
          delivery_notes: string | null;
          description: string | null;
          email: string | null;
          facebook: string | null;
          id: string;
          instagram: string | null;
          logo_url: string | null;
          name: string;
          og_image_url: string | null;
          onboarding_completed_at: string | null;
          onboarding_current_step: number;
          onboarding_status: Database["public"]["Enums"]["onboarding_status"];
          phone: string | null;
          pickup_available: boolean;
          plan_id: string | null;
          publication_status: Database["public"]["Enums"]["publication_status"];
          published_at: string | null;
          responsible_name: string | null;
          segment: string | null;
          slug: string;
          state: string | null;
          status: Database["public"]["Enums"]["store_status"];
          subscription_ends_at: string | null;
          tax_document: string | null;
          tiktok: string | null;
          trial_ends_at: string | null;
          updated_at: string;
          whatsapp: string | null;
          zip_code: string | null;
        };
        Insert: {
          accepts_site_orders?: boolean;
          accepts_whatsapp_orders?: boolean;
          address?: string | null;
          address_number?: string | null;
          banner_cta?: string | null;
          banner_subtitle?: string | null;
          banner_title?: string | null;
          banner_url?: string | null;
          business_hours?: string | null;
          city?: string | null;
          combine_delivery_whatsapp?: boolean;
          complement?: string | null;
          created_at?: string;
          delivery_available?: boolean;
          delivery_notes?: string | null;
          description?: string | null;
          email?: string | null;
          facebook?: string | null;
          id?: string;
          instagram?: string | null;
          logo_url?: string | null;
          name: string;
          og_image_url?: string | null;
          onboarding_completed_at?: string | null;
          onboarding_current_step?: number;
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"];
          phone?: string | null;
          pickup_available?: boolean;
          plan_id?: string | null;
          publication_status?: Database["public"]["Enums"]["publication_status"];
          published_at?: string | null;
          responsible_name?: string | null;
          segment?: string | null;
          slug: string;
          state?: string | null;
          status?: Database["public"]["Enums"]["store_status"];
          subscription_ends_at?: string | null;
          tax_document?: string | null;
          tiktok?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
          whatsapp?: string | null;
          zip_code?: string | null;
        };
        Update: {
          accepts_site_orders?: boolean;
          accepts_whatsapp_orders?: boolean;
          address?: string | null;
          address_number?: string | null;
          banner_cta?: string | null;
          banner_subtitle?: string | null;
          banner_title?: string | null;
          banner_url?: string | null;
          business_hours?: string | null;
          city?: string | null;
          combine_delivery_whatsapp?: boolean;
          complement?: string | null;
          created_at?: string;
          delivery_available?: boolean;
          delivery_notes?: string | null;
          description?: string | null;
          email?: string | null;
          facebook?: string | null;
          id?: string;
          instagram?: string | null;
          logo_url?: string | null;
          name?: string;
          og_image_url?: string | null;
          onboarding_completed_at?: string | null;
          onboarding_current_step?: number;
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"];
          phone?: string | null;
          pickup_available?: boolean;
          plan_id?: string | null;
          publication_status?: Database["public"]["Enums"]["publication_status"];
          published_at?: string | null;
          responsible_name?: string | null;
          segment?: string | null;
          slug?: string;
          state?: string | null;
          status?: Database["public"]["Enums"]["store_status"];
          subscription_ends_at?: string | null;
          tax_document?: string | null;
          tiktok?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
          whatsapp?: string | null;
          zip_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stores_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          created_at: string;
          ends_at: string | null;
          id: string;
          plan_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["subscription_status"];
          store_id: string;
          trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          plan_id: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          store_id: string;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          plan_id?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          store_id?: string;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_platform_admin: { Args: { _user_id?: string }; Returns: boolean };
      is_store_admin: {
        Args: { _store_id: string; _user_id?: string };
        Returns: boolean;
      };
      is_store_member: {
        Args: { _store_id: string; _user_id?: string };
        Returns: boolean;
      };
      store_is_public: { Args: { _store_id: string }; Returns: boolean };
    };
    Enums: {
      member_role: "owner" | "admin" | "seller";
      onboarding_status: "not_started" | "in_progress" | "completed";
      order_source: "website" | "whatsapp" | "manual";
      order_status:
        | "pending"
        | "confirmed"
        | "paid"
        | "in_production"
        | "in_dispatch"
        | "shipped"
        | "delivered"
        | "cancelled";
      platform_role: "platform_owner" | "super_admin" | "support";
      product_status: "active" | "draft" | "archived";
      publication_status: "draft" | "published" | "unpublished" | "suspended";
      store_status: "trial" | "active" | "suspended" | "cancelled";
      subscription_status: "trial" | "active" | "past_due" | "suspended" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      member_role: ["owner", "admin", "seller"],
      onboarding_status: ["not_started", "in_progress", "completed"],
      order_source: ["website", "whatsapp", "manual"],
      order_status: [
        "pending",
        "confirmed",
        "paid",
        "in_production",
        "in_dispatch",
        "shipped",
        "delivered",
        "cancelled",
      ],
      platform_role: ["platform_owner", "super_admin", "support"],
      product_status: ["active", "draft", "archived"],
      publication_status: ["draft", "published", "unpublished", "suspended"],
      store_status: ["trial", "active", "suspended", "cancelled"],
      subscription_status: ["trial", "active", "past_due", "suspended", "cancelled"],
    },
  },
} as const;
