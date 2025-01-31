import OpenAI from 'openai';
import { SkillLevel } from './question-generation-tool';

export interface StudyGuideParams {
  text: string;
  subject?: string;
  skillLevel?: SkillLevel;
  complexity?: string;
}

export class StudyGuideTool {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  async generateStudyGuide({
    text,
    complexity = 'INTERMEDIATE'
  }: StudyGuideParams): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k",
        messages: [
          {
            role: "system",
            content: `Create a detailed study guide with the following sections. Each section must start with its title in ALL CAPS:

            MAIN IDEAS & THEMES
            - List and explain major concepts
            - Include supporting details
            - Number each main idea

            IMPORTANT DETAILS
            - List key facts and information
            - Use bullet points

            EXAMPLES & APPLICATIONS
            - Provide concrete examples
            - Show practical applications

            REVIEW QUESTIONS
            - Create thought-provoking questions
            - Include brief answers

            SUMMARY POINTS
            - List key takeaways
            - Use bullet points

            Format each section with its title in ALL CAPS followed by content.
            Use clear formatting and spacing between sections.`
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.5,
        max_tokens: 2000,
        presence_penalty: 0,
        frequency_penalty: 0
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content generated');
      }

      console.log('Generated study guide content:', content); // Add this for debugging

      return content;
    } catch (error) {
      console.error('Error in study guide generation:', error);
      throw error;
    }
  }
} 