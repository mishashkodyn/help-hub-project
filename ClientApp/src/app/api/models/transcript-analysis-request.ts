export type TranscriptAnalysisAction =
  | 'summarize'
  | 'emotions'
  | 'patterns'
  | 'questions'
  | 'risks'
  | 'explain'
  | 'rephrase'
  | 'intervention'
  | 'custom';

export interface TranscriptAnalysisRequest {
  transcript: string;
  action: TranscriptAnalysisAction;
  userName?: string;
  selectedText?: string;
  timeRangeLabel?: string;
  instruction?: string;
}
