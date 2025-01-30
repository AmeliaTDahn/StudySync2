export type StudyMaterialType = 'summary' | 'study_guide' | 'practice_quiz';

interface StudyMaterialRequest {
  documentText: string;
  materialType: StudyMaterialType;
  subject?: string;
}

interface StudyMaterialResponse {
  success: boolean;
  content?: string;
  error?: string;
}

export const studyAgent = {
  initialize() {
    // No initialization needed
  },

  async generateStudyMaterial({
    documentText,
    materialType,
    subject,
  }: StudyMaterialRequest): Promise<StudyMaterialResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch('/api/study-material', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentText,
          materialType,
          subject,
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 413) {
          return {
            success: false,
            error: 'Document is too large. Please try with a smaller document.'
          };
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.truncated) {
        console.warn('Document was truncated due to length');
      }
      return data;
    } catch (error) {
      console.error('Error generating study material:', error);
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timed out. Please try again.'
        };
      }
      return {
        success: false,
        error: 'Failed to generate study material. Please try again.'
      };
    }
  },

  generatePrompt(text: string, type: StudyMaterialType, subject?: string): string {
    const subjectContext = subject ? ` for ${subject}` : '';
    
    switch (type) {
      case 'summary':
        return `Create a concise summary${subjectContext} of the following text:\n\n${text}`;
      case 'study_guide':
        return `Create a detailed study guide${subjectContext} from the following text. Include key concepts, definitions, and important points:\n\n${text}`;
      case 'practice_quiz':
        return `Create a practice quiz${subjectContext} based on the following text. Include 5-10 questions with answers:\n\n${text}`;
      default:
        return `Summarize the following text${subjectContext}:\n\n${text}`;
    }
  }
}; 