import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";

export type QuestionFormat = "multiple_choice" | "open_ended" | "fill_in_blank";
export type QuestionDifficulty = "easy" | "medium" | "hard";

interface QuestionBase {
  id: string;
  type: QuestionFormat;
  question: string;
  difficulty: QuestionDifficulty;
  topic: string;
}

interface MultipleChoiceQuestion extends QuestionBase {
  type: "multiple_choice";
  choices: string[];
  correctAnswer: number;
  explanation: string;
}

interface OpenEndedQuestion extends QuestionBase {
  type: "open_ended";
  sampleAnswer: string;
  keyPoints: string[];
}

interface FillInBlankQuestion extends QuestionBase {
  type: "fill_in_blank";
  blanks: string[];
  answers: string[];
  context: string;
}

export type Question = MultipleChoiceQuestion | OpenEndedQuestion | FillInBlankQuestion;

export const createQuestionGenerationTool = () => {
  const llm = new ChatOpenAI({
    modelName: "gpt-4",
    temperature: 0.7,
  });

  return new DynamicStructuredTool({
    name: "generate_questions",
    description: "Generate practice questions from provided content with specified format and difficulty",
    schema: z.object({
      content: z.string().describe("The text content to generate questions from"),
      format: z.enum(["multiple_choice", "open_ended", "fill_in_blank"]).describe("Question format"),
      difficulty: z.enum(["easy", "medium", "hard"]).describe("Question difficulty level"),
      count: z.number().min(1).max(10).describe("Number of questions to generate"),
      topics: z.array(z.string()).optional().describe("Specific topics to focus on"),
    }),
    func: async ({ content, format, difficulty, count, topics }) => {
      try {
        const prompt = `
          Generate ${count} ${difficulty} level ${format} questions from the following content.
          ${topics ? `Focus on these topics: ${topics.join(', ')}` : ''}
          
          Format Guidelines:
          ${format === 'multiple_choice' ? `
            - Each question should have 4 choices
            - Include explanation for correct answer
            - Ensure one clearly correct answer
          ` : ''}
          ${format === 'open_ended' ? `
            - Include sample answer
            - List key points to look for
            - Questions should encourage critical thinking
          ` : ''}
          ${format === 'fill_in_blank' ? `
            - Provide meaningful context
            - Ensure blanks test key concepts
            - Include clear correct answers
          ` : ''}
          
          Difficulty Guidelines (${difficulty}):
          - Easy: Basic recall and understanding
          - Medium: Application and analysis
          - Hard: Synthesis and evaluation
          
          Content:
          ${content}
          
          Return the questions in the following JSON structure:
          {
            "questions": [
              {
                "id": "unique_id",
                "type": "${format}",
                "question": "question_text",
                "difficulty": "${difficulty}",
                "topic": "relevant_topic",
                ${format === 'multiple_choice' ? `
                "choices": ["choice1", "choice2", "choice3", "choice4"],
                "correctAnswer": 0,
                "explanation": "why_this_is_correct"
                ` : ''}
                ${format === 'open_ended' ? `
                "sampleAnswer": "ideal_response",
                "keyPoints": ["point1", "point2", "point3"]
                ` : ''}
                ${format === 'fill_in_blank' ? `
                "blanks": ["blank1", "blank2"],
                "answers": ["answer1", "answer2"],
                "context": "surrounding_text"
                ` : ''}
              }
            ]
          }
        `;

        const response = await llm.invoke(prompt);
        const questions: Question[] = JSON.parse(response.content).questions;

        return {
          questions,
          metadata: {
            format,
            difficulty,
            count: questions.length,
            topics,
          }
        };
      } catch (error) {
        console.error('Error in generate_questions:', error);
        throw new Error('Failed to generate questions');
      }
    },
  });
}; 