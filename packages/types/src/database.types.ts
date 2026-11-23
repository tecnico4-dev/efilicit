
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "alert_related_trash": {
                  Row: {
                    "queue_id": string,"trashed_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "queue_id": string,"trashed_at"?: string,"user_id": string
                  }
                  Update: {
                    "queue_id"?: string,"trashed_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_related_trash_queue_id_fkey"
      columns: ["queue_id"]
isOneToOne: false
      referencedRelation: "notification_queue"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alert_related_trash_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"alerts": {
                  Row: {
                    "created_at": string,"criteria": NonNullable<Json>,"frequency": string,"id": string,"is_active": boolean,"kind": string | null,"name": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"criteria"?: NonNullable<Json>,"frequency"?: string,"id"?: string,"is_active"?: boolean,"kind"?: string | null,"name": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"criteria"?: NonNullable<Json>,"frequency"?: string,"id"?: string,"is_active"?: boolean,"kind"?: string | null,"name"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alerts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"company_documents": {
                  Row: {
                    "created_at": string,"created_by": string | null,"doc_type": string,"expires_on": string | null,"id": string,"issued_on": string | null,"notes": string | null,"storage_path": string | null,"tags": (string)[],"title": string,"updated_at": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"doc_type"?: string,"expires_on"?: string | null,"id"?: string,"issued_on"?: string | null,"notes"?: string | null,"storage_path"?: string | null,"tags"?: (string)[],"title": string,"updated_at"?: string,"url"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"doc_type"?: string,"expires_on"?: string | null,"id"?: string,"issued_on"?: string | null,"notes"?: string | null,"storage_path"?: string | null,"tags"?: (string)[],"title"?: string,"updated_at"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_documents_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"company_financials": {
                  Row: {
                    "annual_turnover": number,"created_at": string,"created_by": string | null,"currency": string,"fiscal_year": number,"id": string,"notes": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "annual_turnover": number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"fiscal_year": number,"id"?: string,"notes"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "annual_turnover"?: number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"fiscal_year"?: number,"id"?: string,"notes"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_financials_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"company_references": {
                  Row: {
                    "amount": number | null,"certificate_url": string | null,"client_name": string,"cpv_codes": (string)[],"created_at": string,"created_by": string | null,"currency": string,"id": string,"notes": string | null,"object_summary": string,"updated_at": string,"year_from": number | null,"year_to": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount"?: number | null,"certificate_url"?: string | null,"client_name": string,"cpv_codes"?: (string)[],"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"notes"?: string | null,"object_summary": string,"updated_at"?: string,"year_from"?: number | null,"year_to"?: number | null
                  }
                  Update: {
                    "amount"?: number | null,"certificate_url"?: string | null,"client_name"?: string,"cpv_codes"?: (string)[],"created_at"?: string,"created_by"?: string | null,"currency"?: string,"id"?: string,"notes"?: string | null,"object_summary"?: string,"updated_at"?: string,"year_from"?: number | null,"year_to"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_references_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"contracting_authorities": {
                  Row: {
                    "country": string,"created_at": string,"id": string,"identity_confidence": string,"municipality": string | null,"name": string,"name_normalized": string | null,"platform_id": string | null,"tax_id": string | null,"tax_id_country": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "country"?: string,"created_at"?: string,"id"?: string,"identity_confidence"?: string,"municipality"?: string | null,"name": string,"name_normalized"?: string | null,"platform_id"?: string | null,"tax_id"?: string | null,"tax_id_country"?: string,"updated_at"?: string
                  }
                  Update: {
                    "country"?: string,"created_at"?: string,"id"?: string,"identity_confidence"?: string,"municipality"?: string | null,"name"?: string,"name_normalized"?: string | null,"platform_id"?: string | null,"tax_id"?: string | null,"tax_id_country"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"documents": {
                  Row: {
                    "artifact_id": string | null,"created_at": string,"document_type": string | null,"id": string,"source_code": string | null,"tender_id": string,"title": string | null,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "artifact_id"?: string | null,"created_at"?: string,"document_type"?: string | null,"id"?: string,"source_code"?: string | null,"tender_id": string,"title"?: string | null,"url"?: string | null
                  }
                  Update: {
                    "artifact_id"?: string | null,"created_at"?: string,"document_type"?: string | null,"id"?: string,"source_code"?: string | null,"tender_id"?: string,"title"?: string | null,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "source_artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_tender_id_fkey"
      columns: ["tender_id"]
isOneToOne: false
      referencedRelation: "tenders"
      referencedColumns: ["id"]
    }
                  ]
                },"eficen_members": {
                  Row: {
                    "active": boolean,"avatar_url": string | null,"display_name": string,"id": string,"role_title": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"avatar_url"?: string | null,"display_name": string,"id"?: string,"role_title"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"avatar_url"?: string | null,"display_name"?: string,"id"?: string,"role_title"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "eficen_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"errors": {
                  Row: {
                    "artifact_id": string | null,"created_at": string,"details": Json | null,"error_class": string,"id": string,"message": string,"source_code": string | null,"sync_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "artifact_id"?: string | null,"created_at"?: string,"details"?: Json | null,"error_class"?: string,"id"?: string,"message": string,"source_code"?: string | null,"sync_id"?: string | null
                  }
                  Update: {
                    "artifact_id"?: string | null,"created_at"?: string,"details"?: Json | null,"error_class"?: string,"id"?: string,"message"?: string,"source_code"?: string | null,"sync_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "errors_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "source_artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "errors_sync_id_fkey"
      columns: ["sync_id"]
isOneToOne: false
      referencedRelation: "source_sync"
      referencedColumns: ["id"]
    }
                  ]
                },"favorites": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"tender_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": string,"tender_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"tender_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_tender_id_fkey"
      columns: ["tender_id"]
isOneToOne: false
      referencedRelation: "tenders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"favorites_common": {
                  Row: {
                    "added_by": string,"added_by_display_name": string | null,"created_at": string,"kind": string,"notes": string | null,"tender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by": string,"added_by_display_name"?: string | null,"created_at"?: string,"kind": string,"notes"?: string | null,"tender_id": string
                  }
                  Update: {
                    "added_by"?: string,"added_by_display_name"?: string | null,"created_at"?: string,"kind"?: string,"notes"?: string | null,"tender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_common_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_common_tender_id_fkey"
      columns: ["tender_id"]
isOneToOne: true
      referencedRelation: "tenders"
      referencedColumns: ["id"]
    }
                  ]
                },"favorites_shared": {
                  Row: {
                    "created_at": string,"from_user_id": string,"hidden_by_from_at": string | null,"hidden_by_to_at": string | null,"id": string,"kind": string,"notes": string | null,"tender_id": string,"to_user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"from_user_id": string,"hidden_by_from_at"?: string | null,"hidden_by_to_at"?: string | null,"id"?: string,"kind": string,"notes"?: string | null,"tender_id": string,"to_user_id": string
                  }
                  Update: {
                    "created_at"?: string,"from_user_id"?: string,"hidden_by_from_at"?: string | null,"hidden_by_to_at"?: string | null,"id"?: string,"kind"?: string,"notes"?: string | null,"tender_id"?: string,"to_user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_shared_from_user_id_fkey"
      columns: ["from_user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_shared_tender_id_fkey"
      columns: ["tender_id"]
isOneToOne: false
      referencedRelation: "tenders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_shared_to_user_id_fkey"
      columns: ["to_user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"geo_ccaa": {
                  Row: {
                    "code": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"name": string
                  }
                  Update: {
                    "code"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"geo_municipio": {
                  Row: {
                    "ccaa_code": string,"code": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ccaa_code": string,"code": string,"name": string
                  }
                  Update: {
                    "ccaa_code"?: string,"code"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "geo_municipio_ccaa_code_fkey"
      columns: ["ccaa_code"]
isOneToOne: false
      referencedRelation: "geo_ccaa"
      referencedColumns: ["code"]
    }
                  ]
                },"notification_common": {
                  Row: {
                    "read_at": string | null,"tender_id": string,"trashed_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "read_at"?: string | null,"tender_id": string,"trashed_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "read_at"?: string | null,"tender_id"?: string,"trashed_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_common_tender_id_fkey"
      columns: ["tender_id"]
isOneToOne: false
      referencedRelation: "favorites_common"
      referencedColumns: ["tender_id"]
    },{
      foreignKeyName: "notification_common_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_common_removed": {
                  Row: {
                    "created_at": string,"read_at": string | null,"removed_by": string | null,"removed_by_display_name": string | null,"tender_id": string,"trashed_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"read_at"?: string | null,"removed_by"?: string | null,"removed_by_display_name"?: string | null,"tender_id": string,"trashed_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"read_at"?: string | null,"removed_by"?: string | null,"removed_by_display_name"?: string | null,"tender_id"?: string,"trashed_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_common_removed_removed_by_fkey"
      columns: ["removed_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_common_removed_tender_id_fkey"
      columns: ["tender_id"]
isOneToOne: false
      referencedRelation: "tenders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_common_removed_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_emails": {
                  Row: {
                    "created_at": string,"digest_period": string,"frequency": string,"id": string,"read_at": string | null,"sent_at": string,"tender_count": number,"tender_ids": (string)[],"trashed_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"digest_period": string,"frequency": string,"id"?: string,"read_at"?: string | null,"sent_at": string,"tender_count": number,"tender_ids"?: (string)[],"trashed_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"digest_period"?: string,"frequency"?: string,"id"?: string,"read_at"?: string | null,"sent_at"?: string,"tender_count"?: number,"tender_ids"?: (string)[],"trashed_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "digest_inbox_notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_favorites": {
                  Row: {
                    "deleted": boolean,"event_id": string,"read_at": string | null,"trashed_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "deleted"?: boolean,"event_id": string,"read_at"?: string | null,"trashed_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "deleted"?: boolean,"event_id"?: string,"read_at"?: string | null,"trashed_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_favorites_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "tender_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_queue": {
                  Row: {
                    "alert_id": string | null,"attempts": number,"created_at": string,"id": string,"idempotency_key": string,"last_error": string | null,"payload": NonNullable<Json>,"scheduled_at": string,"sent_at": string | null,"status": string,"tender_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alert_id"?: string | null,"attempts"?: number,"created_at"?: string,"id"?: string,"idempotency_key": string,"last_error"?: string | null,"payload"?: NonNullable<Json>,"scheduled_at"?: string,"sent_at"?: string | null,"status"?: string,"tender_id": string,"user_id": string
                  }
                  Update: {
                    "alert_id"?: string | null,"attempts"?: number,"created_at"?: string,"id"?: string,"idempotency_key"?: string,"last_error"?: string | null,"payload"?: NonNullable<Json>,"scheduled_at"?: string,"sent_at"?: string | null,"status"?: string,"tender_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_queue_alert_id_fkey"
      columns: ["alert_id"]
isOneToOne: false
      referencedRelation: "alerts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_queue_tender_id_fkey"
      columns: ["tender_id"]
isOneToOne: false
      referencedRelation: "tenders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_queue_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"offer_assigned_people": {
                  Row: {
                    "compliance_status": string,"created_at": string,"id": string,"notes": string | null,"offer_case_id": string,"person_id": string | null,"required_profile": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "compliance_status"?: string,"created_at"?: string,"id"?: string,"notes"?: string | null,"offer_case_id": string,"person_id"?: string | null,"required_profile"?: string | null
                  }
                  Update: {
                    "compliance_status"?: string,"created_at"?: string,"id"?: string,"notes"?: string | null,"offer_case_id"?: string,"person_id"?: string | null,"required_profile"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "offer_assigned_people_offer_case_id_fkey"
      columns: ["offer_case_id"]
isOneToOne: false
      referencedRelation: "offer_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_assigned_people_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "eficen_members"
      referencedColumns: ["id"]
    }
                  ]
                },"offer_case_intake": {
                  Row: {
                    "attempts": number,"finished_at": string | null,"id": string,"last_error": string | null,"offer_case_id": string,"requested_at": string,"requested_by": string | null,"started_at": string | null,"stats": NonNullable<Json>,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"finished_at"?: string | null,"id"?: string,"last_error"?: string | null,"offer_case_id": string,"requested_at"?: string,"requested_by"?: string | null,"started_at"?: string | null,"stats"?: NonNullable<Json>,"status"?: string
                  }
                  Update: {
                    "attempts"?: number,"finished_at"?: string | null,"id"?: string,"last_error"?: string | null,"offer_case_id"?: string,"requested_at"?: string,"requested_by"?: string | null,"started_at"?: string | null,"stats"?: NonNullable<Json>,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "offer_case_intake_offer_case_id_fkey"
      columns: ["offer_case_id"]
isOneToOne: false
      referencedRelation: "offer_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_case_intake_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"offer_case_log": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string | null,"event_type": string,"happened_on": string,"id": string,"offer_case_id": string,"related_deliverable_id": string | null,"related_requirement_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"created_by"?: string | null,"event_type": string,"happened_on"?: string,"id"?: string,"offer_case_id": string,"related_deliverable_id"?: string | null,"related_requirement_id"?: string | null
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string | null,"event_type"?: string,"happened_on"?: string,"id"?: string,"offer_case_id"?: string,"related_deliverable_id"?: string | null,"related_requirement_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "offer_case_log_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_case_log_offer_case_id_fkey"
      columns: ["offer_case_id"]
isOneToOne: false
      referencedRelation: "offer_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_case_log_related_deliverable_case_fkey"
      columns: ["related_deliverable_id","offer_case_id"]
isOneToOne: false
      referencedRelation: "offer_deliverables"
      referencedColumns: ["id","offer_case_id"]
    },{
      foreignKeyName: "offer_case_log_related_requirement_case_fkey"
      columns: ["related_requirement_id","offer_case_id"]
isOneToOne: false
      referencedRelation: "offer_requirements"
      referencedColumns: ["id","offer_case_id"]
    }
                  ]
                },"offer_case_members": {
                  Row: {
                    "id": string,"member_id": string,"member_role": string,"offer_case_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"member_id": string,"member_role"?: string,"offer_case_id": string
                  }
                  Update: {
                    "id"?: string,"member_id"?: string,"member_role"?: string,"offer_case_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "offer_case_members_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "eficen_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_case_members_offer_case_id_fkey"
      columns: ["offer_case_id"]
isOneToOne: false
      referencedRelation: "offer_cases"
      referencedColumns: ["id"]
    }
                  ]
                },"offer_case_pliegos": {
                  Row: {
                    "byte_size": number | null,"changed_after_case": boolean,"checksum": string | null,"content_type": string | null,"created_at": string,"created_by": string | null,"fetch_error": string | null,"fetch_status": string | null,"fetched_at": string | null,"id": string,"notes": string | null,"offer_case_id": string,"pliego_type": string,"published_on": string | null,"source_hash": string | null,"source_key": string | null,"source_uri": string | null,"storage_path": string | null,"title": string,"updated_at": string,"url": string | null,"version_label": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "byte_size"?: number | null,"changed_after_case"?: boolean,"checksum"?: string | null,"content_type"?: string | null,"created_at"?: string,"created_by"?: string | null,"fetch_error"?: string | null,"fetch_status"?: string | null,"fetched_at"?: string | null,"id"?: string,"notes"?: string | null,"offer_case_id": string,"pliego_type": string,"published_on"?: string | null,"source_hash"?: string | null,"source_key"?: string | null,"source_uri"?: string | null,"storage_path"?: string | null,"title": string,"updated_at"?: string,"url"?: string | null,"version_label"?: string | null
                  }
                  Update: {
                    "byte_size"?: number | null,"changed_after_case"?: boolean,"checksum"?: string | null,"content_type"?: string | null,"created_at"?: string,"created_by"?: string | null,"fetch_error"?: string | null,"fetch_status"?: string | null,"fetched_at"?: string | null,"id"?: string,"notes"?: string | null,"offer_case_id"?: string,"pliego_type"?: string,"published_on"?: string | null,"source_hash"?: string | null,"source_key"?: string | null,"source_uri"?: string | null,"storage_path"?: string | null,"title"?: string,"updated_at"?: string,"url"?: string | null,"version_label"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "offer_case_pliegos_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_case_pliegos_offer_case_id_fkey"
      columns: ["offer_case_id"]
isOneToOne: false
      referencedRelation: "offer_cases"
      referencedColumns: ["id"]
    }
                  ]
                },"offer_cases": {
                  Row: {
                    "created_at": string,"created_by": string | null,"discard_reason": string | null,"go_decided_at": string | null,"go_decided_by": string | null,"go_decision": string | null,"go_reason": string | null,"id": string,"internal_deadline_at": string | null,"kind": string,"legacy_bid_case_id": string | null,"notes": string | null,"outcome_on": string | null,"owner_member_id": string | null,"preparation_started_on": string | null,"presented_on": string | null,"stage": string,"target_lots": NonNullable<Json>,"tender_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"discard_reason"?: string | null,"go_decided_at"?: string | null,"go_decided_by"?: string | null,"go_decision"?: string | null,"go_reason"?: string | null,"id"?: string,"internal_deadline_at"?: string | null,"kind"?: string,"legacy_bid_case_id"?: string | null,"notes"?: string | null,"outcome_on"?: string | null,"owner_member_id"?: string | null,"preparation_started_on"?: string | null,"presented_on"?: string | null,"stage"?: string,"target_lots"?: NonNullable<Json>,"tender_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"discard_reason"?: string | null,"go_decided_at"?: string | null,"go_decided_by"?: string | null,"go_decision"?: string | null,"go_reason"?: string | null,"id"?: string,"internal_deadline_at"?: string | null,"kind"?: string,"legacy_bid_case_id"?: string | null,"notes"?: string | null,"outcome_on"?: string | null,"owner_member_id"?: string | null,"preparation_started_on"?: string | null,"presented_on"?: string | null,"stage"?: string,"target_lots"?: NonNullable<Json>,"tender_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "offer_cases_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_cases_go_decided_by_fkey"
      columns: ["go_decided_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_cases_owner_member_id_fkey"
      columns: ["owner_member_id"]
isOneToOne: false
      referencedRelation: "eficen_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_cases_tender_id_fkey"
      columns: ["tender_id"]
isOneToOne: true
      referencedRelation: "tenders"
      referencedColumns: ["id"]
    }
                  ]
                },"offer_deliverables": {
                  Row: {
                    "created_at": string,"due_at": string | null,"envelope": string | null,"final_copy_url": string | null,"id": string,"notes": string | null,"offer_case_id": string,"owner_name": string | null,"owner_user_id": string | null,"page_limit": number | null,"parent_id": string | null,"points_max": number | null,"sort_order": number,"source_key": string | null,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"due_at"?: string | null,"envelope"?: string | null,"final_copy_url"?: string | null,"id"?: string,"notes"?: string | null,"offer_case_id": string,"owner_name"?: string | null,"owner_user_id"?: string | null,"page_limit"?: number | null,"parent_id"?: string | null,"points_max"?: number | null,"sort_order"?: number,"source_key"?: string | null,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"due_at"?: string | null,"envelope"?: string | null,"final_copy_url"?: string | null,"id"?: string,"notes"?: string | null,"offer_case_id"?: string,"owner_name"?: string | null,"owner_user_id"?: string | null,"page_limit"?: number | null,"parent_id"?: string | null,"points_max"?: number | null,"sort_order"?: number,"source_key"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "offer_deliverables_offer_case_id_fkey"
      columns: ["offer_case_id"]
isOneToOne: false
      referencedRelation: "offer_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_deliverables_owner_user_id_fkey"
      columns: ["owner_user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_deliverables_parent_case_fkey"
      columns: ["parent_id","offer_case_id"]
isOneToOne: false
      referencedRelation: "offer_deliverables"
      referencedColumns: ["id","offer_case_id"]
    }
                  ]
                },"offer_milestones": {
                  Row: {
                    "code": string | null,"completed_at": string | null,"created_at": string,"due_at": string | null,"id": string,"kind": string,"notes": string | null,"offer_case_id": string,"sort_order": number,"source_key": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code"?: string | null,"completed_at"?: string | null,"created_at"?: string,"due_at"?: string | null,"id"?: string,"kind": string,"notes"?: string | null,"offer_case_id": string,"sort_order"?: number,"source_key"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string | null,"completed_at"?: string | null,"created_at"?: string,"due_at"?: string | null,"id"?: string,"kind"?: string,"notes"?: string | null,"offer_case_id"?: string,"sort_order"?: number,"source_key"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "offer_milestones_offer_case_id_fkey"
      columns: ["offer_case_id"]
isOneToOne: false
      referencedRelation: "offer_cases"
      referencedColumns: ["id"]
    }
                  ]
                },"offer_requirement_evidence": {
                  Row: {
                    "created_at": string,"created_by": string | null,"document_id": string | null,"evidence_kind": string,"financial_id": string | null,"id": string,"notes": string | null,"person_id": string | null,"reference_id": string | null,"requirement_id": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"document_id"?: string | null,"evidence_kind": string,"financial_id"?: string | null,"id"?: string,"notes"?: string | null,"person_id"?: string | null,"reference_id"?: string | null,"requirement_id": string,"url"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"document_id"?: string | null,"evidence_kind"?: string,"financial_id"?: string | null,"id"?: string,"notes"?: string | null,"person_id"?: string | null,"reference_id"?: string | null,"requirement_id"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "offer_requirement_evidence_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_requirement_evidence_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "company_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_requirement_evidence_financial_id_fkey"
      columns: ["financial_id"]
isOneToOne: false
      referencedRelation: "company_financials"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_requirement_evidence_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "eficen_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_requirement_evidence_reference_id_fkey"
      columns: ["reference_id"]
isOneToOne: false
      referencedRelation: "company_references"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_requirement_evidence_requirement_id_fkey"
      columns: ["requirement_id"]
isOneToOne: false
      referencedRelation: "offer_requirements"
      referencedColumns: ["id"]
    }
                  ]
                },"offer_requirements": {
                  Row: {
                    "category": string,"compliance_status": string,"created_at": string,"envelope": string | null,"id": string,"internal_due_at": string | null,"legacy_checklist_item_id": string | null,"literal_text": string | null,"offer_case_id": string,"our_value": string | null,"owner_name": string | null,"owner_user_id": string | null,"pliego_id": string | null,"pliego_ref": string | null,"prep_status": string,"required_value": string | null,"requirement_type": string,"sort_order": number,"source_key": string | null,"source_kind": string,"title": string,"updated_at": string,"validated_at": string | null,"validated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string,"compliance_status"?: string,"created_at"?: string,"envelope"?: string | null,"id"?: string,"internal_due_at"?: string | null,"legacy_checklist_item_id"?: string | null,"literal_text"?: string | null,"offer_case_id": string,"our_value"?: string | null,"owner_name"?: string | null,"owner_user_id"?: string | null,"pliego_id"?: string | null,"pliego_ref"?: string | null,"prep_status"?: string,"required_value"?: string | null,"requirement_type"?: string,"sort_order"?: number,"source_key"?: string | null,"source_kind"?: string,"title": string,"updated_at"?: string,"validated_at"?: string | null,"validated_by"?: string | null
                  }
                  Update: {
                    "category"?: string,"compliance_status"?: string,"created_at"?: string,"envelope"?: string | null,"id"?: string,"internal_due_at"?: string | null,"legacy_checklist_item_id"?: string | null,"literal_text"?: string | null,"offer_case_id"?: string,"our_value"?: string | null,"owner_name"?: string | null,"owner_user_id"?: string | null,"pliego_id"?: string | null,"pliego_ref"?: string | null,"prep_status"?: string,"required_value"?: string | null,"requirement_type"?: string,"sort_order"?: number,"source_key"?: string | null,"source_kind"?: string,"title"?: string,"updated_at"?: string,"validated_at"?: string | null,"validated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "offer_requirements_offer_case_id_fkey"
      columns: ["offer_case_id"]
isOneToOne: false
      referencedRelation: "offer_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_requirements_owner_user_id_fkey"
      columns: ["owner_user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_requirements_pliego_case_fkey"
      columns: ["pliego_id","offer_case_id"]
isOneToOne: false
      referencedRelation: "offer_case_pliegos"
      referencedColumns: ["id","offer_case_id"]
    },{
      foreignKeyName: "offer_requirements_validated_by_fkey"
      columns: ["validated_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"offer_tasks": {
                  Row: {
                    "created_at": string,"done_at": string | null,"due_at": string | null,"id": string,"notes": string | null,"offer_case_id": string,"owner_name": string | null,"owner_user_id": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"done_at"?: string | null,"due_at"?: string | null,"id"?: string,"notes"?: string | null,"offer_case_id": string,"owner_name"?: string | null,"owner_user_id"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"done_at"?: string | null,"due_at"?: string | null,"id"?: string,"notes"?: string | null,"offer_case_id"?: string,"owner_name"?: string | null,"owner_user_id"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "offer_tasks_offer_case_id_fkey"
      columns: ["offer_case_id"]
isOneToOne: false
      referencedRelation: "offer_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offer_tasks_owner_user_id_fkey"
      columns: ["owner_user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"recent_searches": {
                  Row: {
                    "criteria": NonNullable<Json>,"criteria_signature": string,"id": string,"searched_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criteria": NonNullable<Json>,"criteria_signature": string,"id"?: string,"searched_at"?: string,"user_id": string
                  }
                  Update: {
                    "criteria"?: NonNullable<Json>,"criteria_signature"?: string,"id"?: string,"searched_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recent_searches_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_searches": {
                  Row: {
                    "created_at": string,"criteria": NonNullable<Json>,"id": string,"name": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"criteria"?: NonNullable<Json>,"id"?: string,"name": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"criteria"?: NonNullable<Json>,"id"?: string,"name"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_searches_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"source_artifacts": {
                  Row: {
                    "artifact_key": string,"byte_size": number | null,"checksum": string,"content_type": string | null,"created_at": string,"downloaded_at": string,"id": string,"source_code": string,"source_url": string | null,"storage_path": string | null,"sync_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "artifact_key": string,"byte_size"?: number | null,"checksum": string,"content_type"?: string | null,"created_at"?: string,"downloaded_at"?: string,"id"?: string,"source_code": string,"source_url"?: string | null,"storage_path"?: string | null,"sync_id"?: string | null
                  }
                  Update: {
                    "artifact_key"?: string,"byte_size"?: number | null,"checksum"?: string,"content_type"?: string | null,"created_at"?: string,"downloaded_at"?: string,"id"?: string,"source_code"?: string,"source_url"?: string | null,"storage_path"?: string | null,"sync_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "source_artifacts_sync_id_fkey"
      columns: ["sync_id"]
isOneToOne: false
      referencedRelation: "source_sync"
      referencedColumns: ["id"]
    }
                  ]
                },"source_sync": {
                  Row: {
                    "checksum": string | null,"created_at": string,"cursor": string | null,"error_message": string | null,"finished_at": string | null,"id": string,"last_artifact": string | null,"records_failed": number,"records_new": number,"records_seen": number,"records_updated": number,"run_id": string,"source_code": string,"started_at": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "checksum"?: string | null,"created_at"?: string,"cursor"?: string | null,"error_message"?: string | null,"finished_at"?: string | null,"id"?: string,"last_artifact"?: string | null,"records_failed"?: number,"records_new"?: number,"records_seen"?: number,"records_updated"?: number,"run_id": string,"source_code": string,"started_at"?: string,"status"?: string
                  }
                  Update: {
                    "checksum"?: string | null,"created_at"?: string,"cursor"?: string | null,"error_message"?: string | null,"finished_at"?: string | null,"id"?: string,"last_artifact"?: string | null,"records_failed"?: number,"records_new"?: number,"records_seen"?: number,"records_updated"?: number,"run_id"?: string,"source_code"?: string,"started_at"?: string,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"suppliers": {
                  Row: {
                    "country": string,"created_at": string,"id": string,"identity_confidence": string,"municipality": string | null,"name": string,"name_normalized": string | null,"tax_id": string | null,"tax_id_country": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "country"?: string,"created_at"?: string,"id"?: string,"identity_confidence"?: string,"municipality"?: string | null,"name": string,"name_normalized"?: string | null,"tax_id"?: string | null,"tax_id_country"?: string,"updated_at"?: string
                  }
                  Update: {
                    "country"?: string,"created_at"?: string,"id"?: string,"identity_confidence"?: string,"municipality"?: string | null,"name"?: string,"name_normalized"?: string | null,"tax_id"?: string | null,"tax_id_country"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"tender_cpvs": {
                  Row: {
                    "cpv_code": string,"tender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cpv_code": string,"tender_id": string
                  }
                  Update: {
                    "cpv_code"?: string,"tender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tender_cpvs_tender_id_fkey"
      columns: ["tender_id"]
isOneToOne: false
      referencedRelation: "tenders"
      referencedColumns: ["id"]
    }
                  ]
                },"tender_events": {
                  Row: {
                    "created_at": string,"event_status": string | null,"event_type": string,"id": string,"occurred_at": string,"payload": Json | null,"source_code": string | null,"tender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_status"?: string | null,"event_type": string,"id"?: string,"occurred_at"?: string,"payload"?: Json | null,"source_code"?: string | null,"tender_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_status"?: string | null,"event_type"?: string,"id"?: string,"occurred_at"?: string,"payload"?: Json | null,"source_code"?: string | null,"tender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tender_events_tender_id_fkey"
      columns: ["tender_id"]
isOneToOne: false
      referencedRelation: "tenders"
      referencedColumns: ["id"]
    }
                  ]
                },"tender_ratings": {
                  Row: {
                    "created_at": string,"interest_kind": string | null,"score": number,"tender_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"interest_kind"?: string | null,"score": number,"tender_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"interest_kind"?: string | null,"score"?: number,"tender_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tender_ratings_tender_id_fkey"
      columns: ["tender_id"]
isOneToOne: false
      referencedRelation: "tenders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tender_ratings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"tender_recommendations": {
                  Row: {
                    "computed_at": string,"profile_kind": string | null,"reason": NonNullable<Json>,"score": number,"tender_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "computed_at"?: string,"profile_kind"?: string | null,"reason"?: NonNullable<Json>,"score": number,"tender_id": string,"user_id": string
                  }
                  Update: {
                    "computed_at"?: string,"profile_kind"?: string | null,"reason"?: NonNullable<Json>,"score"?: number,"tender_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tender_recommendations_tender_id_fkey"
      columns: ["tender_id"]
isOneToOne: false
      referencedRelation: "tenders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tender_recommendations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"tender_sources": {
                  Row: {
                    "artifact_id": string | null,"created_at": string,"id": string,"match_candidate_tender_id": string | null,"match_method": string | null,"match_score": number | null,"matched_at": string | null,"review_status": string,"source_code": string,"source_tender_id": string,"source_url": string | null,"tender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "artifact_id"?: string | null,"created_at"?: string,"id"?: string,"match_candidate_tender_id"?: string | null,"match_method"?: string | null,"match_score"?: number | null,"matched_at"?: string | null,"review_status"?: string,"source_code": string,"source_tender_id": string,"source_url"?: string | null,"tender_id": string
                  }
                  Update: {
                    "artifact_id"?: string | null,"created_at"?: string,"id"?: string,"match_candidate_tender_id"?: string | null,"match_method"?: string | null,"match_score"?: number | null,"matched_at"?: string | null,"review_status"?: string,"source_code"?: string,"source_tender_id"?: string,"source_url"?: string | null,"tender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tender_sources_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "source_artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tender_sources_match_candidate_tender_id_fkey"
      columns: ["match_candidate_tender_id"]
isOneToOne: false
      referencedRelation: "tenders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tender_sources_tender_id_fkey"
      columns: ["tender_id"]
isOneToOne: false
      referencedRelation: "tenders"
      referencedColumns: ["id"]
    }
                  ]
                },"tenders": {
                  Row: {
                    "canonical_source_code": string,"contract_type": string | null,"contracting_authority_id": string | null,"created_at": string,"currency": string,"deadline_at": string | null,"description": string | null,"estimated_value": number | null,"id": string,"place_ccaa_code": string | null,"place_municipality_code": string | null,"place_nuts_code": string | null,"procedure_type": string | null,"publication_date": string | null,"search_vector": unknown,"status": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "canonical_source_code": string,"contract_type"?: string | null,"contracting_authority_id"?: string | null,"created_at"?: string,"currency"?: string,"deadline_at"?: string | null,"description"?: string | null,"estimated_value"?: number | null,"id"?: string,"place_ccaa_code"?: string | null,"place_municipality_code"?: string | null,"place_nuts_code"?: string | null,"procedure_type"?: string | null,"publication_date"?: string | null,"search_vector"?: never,"status"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "canonical_source_code"?: string,"contract_type"?: string | null,"contracting_authority_id"?: string | null,"created_at"?: string,"currency"?: string,"deadline_at"?: string | null,"description"?: string | null,"estimated_value"?: number | null,"id"?: string,"place_ccaa_code"?: string | null,"place_municipality_code"?: string | null,"place_nuts_code"?: string | null,"procedure_type"?: string | null,"publication_date"?: string | null,"search_vector"?: never,"status"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenders_contracting_authority_id_fkey"
      columns: ["contracting_authority_id"]
isOneToOne: false
      referencedRelation: "contracting_authorities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tenders_place_ccaa_code_fkey"
      columns: ["place_ccaa_code"]
isOneToOne: false
      referencedRelation: "geo_ccaa"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "tenders_place_municipality_code_fkey"
      columns: ["place_municipality_code"]
isOneToOne: false
      referencedRelation: "geo_municipio"
      referencedColumns: ["code"]
    }
                  ]
                },"users": {
                  Row: {
                    "auth_user_id": string,"created_at": string,"digest_frequency": string,"display_name": string | null,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth_user_id": string,"created_at"?: string,"digest_frequency"?: string,"display_name"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Update: {
                    "auth_user_id"?: string,"created_at"?: string,"digest_frequency"?: string,"display_name"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "count_unread_favorite_status_notifications":
{ Args: { "p_user_id": string }; Returns: number
                           },
"count_unread_notifications":
{ Args: { "p_user_id": string }; Returns: number
                           },
"f_unaccent":
{ Args: { "txt": string }; Returns: string
                           },
"has_unread_favorite_status_notifications":
{ Args: { "p_user_id": string }; Returns: boolean
                           },
"has_unread_notifications":
{ Args: { "p_user_id": string }; Returns: boolean
                           },
"hide_favorite_share":
{ Args: { "p_share_id": string }; Returns: undefined
                           },
"is_app_user":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"list_place_municipalities":
{ Args: { "p_ccaa_code": string }; Returns: {
              "code": string,"name": string
            }[]
                           },
"list_recent_favorite_status_notifications":
{ Args: { "p_limit"?: number,"p_user_id": string }; Returns: {
              "detected_at": string,"event_id": string,"new_status": string,"occurred_at": string,"previous_status": string,"source_code": string,"tender_id": string,"title": string,"unread": boolean
            }[]
                           },
"list_tender_filter_options":
{ Args: Record<PropertyKey, never>; Returns: {
              "kind": string,"value": string
            }[]
                           },
"reactivate_favorite_share":
{ Args: { "p_kind": string,"p_notes"?: string,"p_tender_id": string,"p_to_user_id": string }; Returns: string
                           },
"record_recent_search":
{ Args: { "p_criteria": Json,"p_signature": string }; Returns: undefined
                           },
"search_tenders":
{ Args: { "p_authority_ids"?: (string)[],"p_authority_name_contains"?: string,"p_authority_tax_ids"?: (string)[],"p_ccaa_codes"?: (string)[],"p_contract_types"?: (string)[],"p_countries"?: (string)[],"p_cpv_codes"?: (string)[],"p_cpv_match"?: string,"p_deadline_from"?: string,"p_deadline_to"?: string,"p_estimated_value_max"?: number,"p_estimated_value_min"?: number,"p_keywords"?: (string)[],"p_known_total"?: number,"p_limit"?: number,"p_municipalities"?: (string)[],"p_municipality_codes"?: (string)[],"p_offset"?: number,"p_open_for_submission"?: boolean,"p_procedure_types"?: (string)[],"p_publication_date_from"?: string,"p_publication_date_to"?: string,"p_query"?: string,"p_sort_by"?: string,"p_sort_dir"?: string,"p_statuses"?: (string)[] }; Returns: {
              "contract_type": string,"contracting_authority_id": string,"cpv_codes": (string)[],"created_at": string,"currency": string,"deadline_at": string,"description": string,"estimated_value": number,"id": string,"match_kind": string,"procedure_type": string,"publication_date": string,"rank": number,"status": string,"title": string,"total_count": number,"updated_at": string
            }[]
                           },
"unhide_favorite_share":
{ Args: { "p_share_id": string }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
