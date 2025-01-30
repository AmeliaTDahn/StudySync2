import OpenAI from 'openai';

export class StudyGuideTool {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }

  async generateStudyGuide({
    text,
    subject,
    skillLevel,
    sectionNumber,
    totalSections
  }: {
    text: string;
    subject?: string;
    skillLevel?: string;
    sectionNumber?: number;
    totalSections?: number;
  }) {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k",  // Use 16k model for longer context
        messages: [
          {
            role: "system",
            content: `You are a study guide creator that breaks down complex topics into clear, organized sections.
            Create a detailed study guide that includes:
            - Main concepts and definitions
            - Key points and explanations
            - Examples and applications
            - Important relationships between concepts
            ${sectionNumber ? `This is section ${sectionNumber} of ${totalSections}.` : ''}`
          },
          {
            role: "user",
            content: `Create a comprehensive study guide for this ${subject || ''} content:\n\n${text}`
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Error generating study guide:', error);
      throw error;
    }
  }

  async generateConceptReview(sections: string[]): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Create a concise review of the key concepts from all sections."
          },
          {
            role: "user",
            content: `Summarize the key concepts from these study guide sections:\n\n${sections.join('\n\n')}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Error generating concept review:', error);
      throw error;
    }
  }
} 