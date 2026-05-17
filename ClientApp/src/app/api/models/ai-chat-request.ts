export interface AiChatRequest{
    userName: string;
    provider: string;
    messages: AiMessage[];
    context?: string;
}

export interface AiMessage {
    role: string;
    content: string;
}