export interface DocumentProcessingResult {
  success: boolean;
  result: string | null;
  error: string | null;
}

export interface DocumentProcessingOptions {
  maxLength?: number;
  format?: 'markdown' | 'plain';
  focusAreas?: string[];
} 