export interface Message {
  id?: string;
  senderId?: string | null;
  senderName?: string;
  receiverId?: string | null;
  content?: string | null;
  createdDate?: string;
  replyMessageId?: string;
  replyMessageContent?: string;
  replyMessageSenderName?: string;
  isRead?: boolean;
  attachments?: Attachments[];
  isPending?: boolean;
  localId?: string;
  messageType?: number; // 0 = text, 1 = videoCall
  callDurationSeconds?: number | null;
}

export interface Attachments {
  path: string;
  type: string;
  name: string;
}
