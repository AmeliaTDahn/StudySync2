import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { Question } from "./question-tools";
import { AnswerExplanation } from "./explanation-tools";

export type SkillLevel = "beginner" | "intermediate" | "advanced";
export type ContentType = "question" | "explanation" | "summary";

interface AdjustmentGuidelines {
  vocabulary: string[];
  conceptDepth: string;
  exampleComplexity: string;
  assumedKnowledge: string[];
}

const SKILL_LEVEL_GUIDELINES: Record<SkillLevel, AdjustmentGuidelines> = {
  beginner: {
    vocabulary: ["basic", "fundamental", "introductory"],
    conceptDepth: "Focus on core concepts with simple explanations",
    exampleComplexity: "Use straightforward examples with minimal variables",
    assumedKnowledge: ["basic arithmetic", "simple logic"]
  },
  intermediate: {
    vocabulary: ["moderate", "applied", "analytical"],
    conceptDepth: "Include underlying principles and some theoretical background",
    exampleComplexity: "Use multi-step problems with real-world applications",
    assumedKnowledge: ["algebra", "basic principles", "terminology"]
  },
  advanced: {
    vocabulary: ["complex", "theoretical", "comprehensive"],
    conceptDepth: "Explore advanced concepts and edge cases",
    exampleComplexity: "Use complex scenarios with multiple variables",
    assumedKnowledge: ["advanced concepts", "theoretical foundations"]
  }
};

export const createDifficultyAdjusterTool = () => {
  const llm = new ChatOpenAI({
    modelName: "gpt-4",
    temperature: 0.4,
  });

  return new DynamicStructuredTool({
    name: "adjust_difficulty",
    description: "Adjust the difficulty level of questions, explanations, or summaries",
    schema: z.object({
      content: z.any().describe("The content to adjust (question, explanation, or summary)"),
      contentType: z.enum(["question", "explanation", "summary"]).describe("Type of content"),
      currentSkillLevel: z.enum(["beginner", "intermediate", "advanced"]).describe("Current difficulty level"),
      targetSkillLevel: z.enum(["beginner", "intermediate", "advanced"]).describe("Desired difficulty level"),
      preserveCore: z.boolean().optional().default(true).describe("Whether to preserve core concepts"),
    }),
    func: async ({ content, contentType, currentSkillLevel, targetSkillLevel, preserveCore }) => {
      try {
        const guidelines = SKILL_LEVEL_GUIDELINES[targetSkillLevel];
        
        const prompt = `
          Adjust the following ${contentType} from ${currentSkillLevel} level to ${targetSkillLevel} level.
          
          Original Content:
          ${JSON.stringify(content, null, 2)}
          
          Target Level Guidelines:
          - Vocabulary Level: ${guidelines.vocabulary.join(', ')}
          - Concept Depth: ${guidelines.conceptDepth}
          - Example Complexity: ${guidelines.exampleComplexity}
          - Assumed Knowledge: ${guidelines.assumedKnowledge.join(', ')}
          
          Additional Instructions:
          ${preserveCore ? '- Maintain core concepts while adjusting complexity' : ''}
          - Adjust language and examples to match target level
          - Maintain the same basic structure and format
          - Ensure accuracy and clarity at the new level
          
          Return the adjusted content in the same JSON structure as the input.
        `;

        const response = await llm.invoke(prompt);
        // Parse the response as string since it's a ChatMessage
        const adjustedContent = JSON.parse(response.content.toString());

        // Validate the adjusted content maintains required structure
        validateAdjustedContent(adjustedContent, contentType);

        return {
          adjustedContent,
          metadata: {
            originalLevel: currentSkillLevel,
            targetLevel: targetSkillLevel,
            contentType,
            adjustments: {
              vocabularyLevel: guidelines.vocabulary[0],
              conceptDepth: guidelines.conceptDepth,
              preserved: preserveCore
            }
          }
        };
      } catch (error) {
        console.error('Error in adjust_difficulty:', error);
        throw new Error('Failed to adjust difficulty level');
      }
    },
  });
};

// Helper function to validate adjusted content
function validateAdjustedContent(content: any, contentType: ContentType) {
  switch (contentType) {
    case 'question':
      if (!content.question || !content.type || !content.difficulty) {
        throw new Error('Adjusted question missing required fields');
      }
      break;
    case 'explanation':
      if (!content.explanation || !content.steps || !content.learningPoints) {
        throw new Error('Adjusted explanation missing required fields');
      }
      break;
    case 'summary':
      if (typeof content !== 'string' && !content.content) {
        throw new Error('Adjusted summary in invalid format');
      }
      break;
  }
} 