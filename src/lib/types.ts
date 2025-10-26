export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ChecklistItemStatus = 'done' | 'na' | 'issue' | 'unchecked'

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          user_id: string | null
          name: string
          phone: string | null
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          phone?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          phone?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'clients_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'properties_client_id_fkey'
            columns: ['id']
            referencedRelation: 'properties'
            referencedColumns: ['client_id']
          }
        ]
      }
      checklists: {
        Row: {
          id: string
          property_id: string | null
          user_id: string | null
          visit_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          property_id?: string | null
          user_id?: string | null
          visit_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          property_id?: string | null
          user_id?: string | null
          visit_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'checklists_property_id_fkey'
            columns: ['property_id']
            referencedRelation: 'properties'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'checklists_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      checklist_items: {
        Row: {
          id: string
          checklist_id: string | null
          category: string
          item_text: string
          status: ChecklistItemStatus | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          checklist_id?: string | null
          category: string
          item_text: string
          status?: ChecklistItemStatus | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          checklist_id?: string | null
          category?: string
          item_text?: string
          status?: ChecklistItemStatus | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'checklist_items_checklist_id_fkey'
            columns: ['checklist_id']
            referencedRelation: 'checklists'
            referencedColumns: ['id']
          }
        ]
      }
      checklist_photos: {
        Row: {
          id: string
          checklist_item_id: string | null
          storage_path: string
          created_at: string
        }
        Insert: {
          id?: string
          checklist_item_id?: string | null
          storage_path: string
          created_at?: string
        }
        Update: {
          id?: string
          checklist_item_id?: string | null
          storage_path?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'checklist_photos_checklist_item_id_fkey'
            columns: ['checklist_item_id']
            referencedRelation: 'checklist_items'
            referencedColumns: ['id']
          }
        ]
      }
      properties: {
        Row: {
          id: string
          name: string
          client_id: string | null
          address: string | null
          user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          client_id?: string | null
          address?: string | null
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          client_id?: string | null
          address?: string | null
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'properties_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'properties_client_id_fkey'
            columns: ['client_id']
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'checklists_property_id_fkey'
            columns: ['id']
            referencedRelation: 'checklists'
            referencedColumns: ['property_id']
          }
        ]
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
