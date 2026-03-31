export interface User {
    id: string;
    name: string;
    surname: string;
    profilePicture: string;
    profileImage: string;
    isOnline: boolean;
    userName: string;
    connectionId: string;
    lastMessage: string;
    unreadCount: number;
    isTyping: boolean;
    preferredAiProvider: string;
    roles: string[];
}

export interface UserProfileDto {
    id: string;
    name: string;
    email: string;
    surname: string;
    profileImage: string;
    userName: string;
    userCategory: number;
    roles: string[];
}