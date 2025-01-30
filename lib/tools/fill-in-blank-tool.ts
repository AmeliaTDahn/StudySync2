import OpenAI from 'openai';
import { SkillLevel } from './question-generation-tool';

export interface FillInBlankParams {
  text: string;
  numberOfQuestions?: number;
  skillLevel?: SkillLevel;
  subject?: string;
}

export interface FillInBlankQuestion {
  question: string;
  answer: string;
  explanation?: string;
}

export class FillInBlankTool {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  async generateQuestions({
    text,
    numberOfQuestions = 10,
    skillLevel = 'INTERMEDIATE',
    subject
  }: FillInBlankParams): Promise<FillInBlankQuestion[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an expert at creating fill-in-the-blank questions.
              
              Rules:
              1. Generate exactly ${numberOfQuestions} questions
              2. Each question should be a complete sentence with a key term blanked out
              3. The blanked term should be crucial to understanding
              4. Include a clear explanation for each answer
              5. Adapt to ${skillLevel} level
              6. Questions must be spread throughout the text
              
              Format each question as a JSON object with:
              - question: sentence with ___ for blank
              - answer: the correct word/phrase
              - explanation: why this answer is correct`
          },
          {
            role: "user",
            content: `Create ${numberOfQuestions} fill-in-the-blank questions${subject ? ` for ${subject}` : ''} from this text:\n\n${text}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content generated');
      }

      const parsedContent = JSON.parse(content);
      if (!Array.isArray(parsedContent.questions)) {
        throw new Error('Invalid response format');
      }

      return parsedContent.questions;
    } catch (error) {
      console.error('Error generating fill-in-blank questions:', error);
      throw error;
    }
  }

  formatQuestions(questions: FillInBlankQuestion[]): string {
    return `
📝 FILL IN THE BLANK QUIZ
═══════════════════════════════════════════════

${questions.map((q, index) => `
Question ${index + 1}
──────────────
${q.question}

Answer: ${q.answer}

${q.explanation ? `Explanation:
• ${q.explanation}` : ''}
───────────────────────────────────────────────
`).join('\n')}
`.trim();
  }
} 