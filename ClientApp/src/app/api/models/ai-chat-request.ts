export interface AiChatRequest{
    userName: string;
    provider: string;
    messages: AiMessage[];
}

export interface AiMessage {
    role: string;
    content: string;
}