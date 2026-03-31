export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string | Date;
  isRead: boolean;
}