export interface Database {
  public: {
    Tables: {
      properties: {
        Row: {
          id: string
          name: string
          address: string | null
          created_at: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string | null
        }
      }
      checklists: {
        Row: {
          id: string
          property_id: string
          user_id: string | null
          visit_date: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          property_id: string
          user_id?: string | null
          visit_date: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          user_id?: string | null
          visit_date?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      checklist_items: {
        Row: {
          id: string
          checklist_id: string
          category: string
          item_text: string
          status: 'done' | 'na' | 'issue' | 'unchecked'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          checklist_id: string
          category: string
          item_text: string
          status?: 'done' | 'na' | 'issue' | 'unchecked'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          checklist_id?: string
          category?: string
          item_text?: string
          status?: 'done' | 'na' | 'issue' | 'unchecked'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      checklist_photos: {
        Row: {
          id: string
          checklist_item_id: string
          storage_path: string
          created_at: string
        }
        Insert: {
          id?: string
          checklist_item_id: string
          storage_path: string
          created_at?: string
        }
        Update: {
          id?: string
          checklist_item_id?: string
          storage_path?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}