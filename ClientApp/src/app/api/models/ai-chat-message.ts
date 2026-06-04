export interface AiChatMessage {
  text: string;
  isUser: boolean;
  timestamp: Date;
  // Companion-mode extras (floating widget): tappable quick replies and feature shortcuts.
  suggestions?: string[];
  actions?: AiAssistantAction[];
}

export interface AiAssistantAction {
  label: string;
  route: string;
  icon: string;
}
