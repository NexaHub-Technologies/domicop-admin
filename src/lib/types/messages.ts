export type MessageStatus = "open" | "in_progress" | "resolved" | "closed"

export interface Message {
  id: string
  member_id: string
  member_name: string
  subject: string
  body: string
  status: MessageStatus
  admin_id?: string
  replies?: MessageReply[]
  created_at: string
  updated_at: string
}

export interface MessageReply {
  id: string
  body: string
  sender_type: "member" | "admin"
  created_at: string
}

export interface ReplyToMessageInput {
  body: string
}

export interface UpdateMessageStatusInput {
  status: MessageStatus
}

export interface MessagesListResponse {
  data: Message[]
  total: number | null
}

export interface GetMessagesParams {
  status?: string
}
