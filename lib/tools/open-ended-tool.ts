import { LangChainClient } from '../utils/langchain-client';
import { SkillLevel } from './question-generation-tool';

export interface OpenEndedParams {
  text: string;
  numberOfQuestions?: number;
  skillLevel?: SkillLevel;
  subject?: string;
}

export interface OpenEndedQuestion {
  question: string;
  modelAnswer: string;
  keyPoints: string[];
}

export class OpenEndedTool {
  async generateQuestions({
    text,
    numberOfQuestions = 10,
    skillLevel = 'INTERMEDIATE',
    subject
  }: OpenEndedParams): Promise<OpenEndedQuestion[]> {
    try {
      // Use LangChain instead of OpenAI directly
      const langchain = LangChainClient.getInstance();
      const llm = langchain.getLLM();

      const response = await llm.invoke(`You are an expert at creating thought-provoking open-ended questions.
        
        Rules:
        1. Generate exactly ${numberOfQuestions} questions
        2. Questions MUST be open-ended - never create multiple choice questions
        3. Questions should start with words like:
           - "Explain..."
           - "Analyze..."
           - "Compare and contrast..."
           - "What are the implications of..."
           - "How would you..."
           - "Why do you think..."
           - "Evaluate..."
           - "Discuss..."
        4. Questions should require detailed explanations and critical thinking
        5. Each question should explore different concepts from the text
        6. Adapt complexity to ${skillLevel} level
        7. Include comprehensive model answers
        8. List key points students should address
        
        Format each question as a JSON object with:
        - question: the open-ended question (must require explanation)
        - modelAnswer: a detailed, well-structured answer
        - keyPoints: array of main points that should be covered in the response
      `);

      const content = response.content;
      if (!content) {
        throw new Error('No content generated');
      }

      const parsedContent = JSON.parse(content);
      if (!Array.isArray(parsedContent.questions)) {
        throw new Error('Invalid response format');
      }

      // Validate that questions are truly open-ended
      const questions = parsedContent.questions.map(q => {
        if (q.question.includes('A)') || q.question.includes('B)') || 
            q.question.includes('Choose') || q.question.includes('Select')) {
          throw new Error('Generated question appears to be multiple choice');
        }
        return q;
      });

      return questions;
    } catch (error) {
      console.error('Error generating open-ended questions:', error);
      throw error;
    }
  }

  formatQuestions(questions: OpenEndedQuestion[]): string {
    return `
❓ OPEN-ENDED QUESTIONS
═══════════════════════════════════════════════

${questions.map((q, index) => `
Question ${index + 1}
──────────────
${q.question}

Model Answer:
${q.modelAnswer}

Key Points to Cover:
${q.keyPoints.map(point => `• ${point}`).join('\n')}
───────────────────────────────────────────────
`).join('\n')}
`.trim();
  }
} 