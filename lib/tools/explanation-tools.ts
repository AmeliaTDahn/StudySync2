import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { Question } from "./question-tools";

export interface StepByStepExplanation {
  steps: {
    step: number;
    description: string;
    reasoning?: string;
  }[];
  relatedConcepts: string[];
  commonMistakes: string[];
}

export interface AnswerExplanation {
  questionId: string;
  correctAnswer: string;
  explanation: StepByStepExplanation;
  hints: string[];
  difficulty: string;
  learningPoints: string[];
}

export const createExplanationTool = () => {
  const llm = new ChatOpenAI({
    modelName: "gpt-4",
    temperature: 0.5,
  });

  return new DynamicStructuredTool({
    name: "generate_answer_explanation",
    description: "Generate detailed answer explanations with step-by-step solutions",
    schema: z.object({
      question: z.any().describe("The question object to explain"),
      context: z.string().describe("The relevant content for context"),
      detailLevel: z.enum(["basic", "detailed", "comprehensive"]).describe("Level of explanation detail"),
      includeHints: z.boolean().optional().default(true).describe("Whether to include hints"),
    }),
    func: async ({ question, context, detailLevel, includeHints }) => {
      try {
        const prompt = `
          Generate a detailed explanation for the following question:
          ${JSON.stringify(question, null, 2)}

          Context from the source material:
          ${context}

          Detail Level: ${detailLevel}
          ${includeHints ? 'Include helpful hints for solving similar problems.' : ''}

          Guidelines:
          - Break down the solution into clear, logical steps
          - Explain the reasoning behind each step
          - Identify related concepts and common mistakes
          - ${detailLevel === 'comprehensive' ? 'Include additional examples and edge cases' : ''}
          - ${detailLevel === 'basic' ? 'Focus on core concepts and simple explanations' : ''}

          Return the explanation in the following JSON structure:
          {
            "questionId": "string",
            "correctAnswer": "string",
            "explanation": {
              "steps": [
                {
                  "step": number,
                  "description": "string",
                  "reasoning": "string"
                }
              ],
              "relatedConcepts": ["string"],
              "commonMistakes": ["string"]
            },
            "hints": ["string"],
            "difficulty": "string",
            "learningPoints": ["string"]
          }
        `;

        const response = await llm.invoke(prompt);
        const explanation: AnswerExplanation = JSON.parse(response.content);

        return {
          explanation,
          metadata: {
            detailLevel,
            questionType: question.type,
            hasHints: includeHints,
          }
        };
      } catch (error) {
        console.error('Error in generate_answer_explanation:', error);
        throw new Error('Failed to generate explanation');
      }
    },
  });
}; 