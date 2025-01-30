import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";

export type SummaryLength = "short" | "medium" | "long";
export type ComplexityLevel = "basic" | "intermediate" | "advanced";

export const createSummarizationTool = () => {
  const llm = new ChatOpenAI({
    modelName: "gpt-4",
    temperature: 0.5,
  });

  return new DynamicStructuredTool({
    name: "summarize_text",
    description: "Create a concise summary of the provided text at the specified length and complexity level",
    schema: z.object({
      content: z.string().describe("The text content to summarize"),
      length: z.enum(["short", "medium", "long"]).describe("Desired summary length"),
      complexity: z.enum(["basic", "intermediate", "advanced"]).describe("Desired complexity level"),
      focusAreas: z.array(z.string()).optional().describe("Specific topics or areas to focus on"),
    }),
    func: async ({ content, length, complexity, focusAreas }) => {
      try {
        // Define target word counts based on length
        const wordCounts = {
          short: 150,
          medium: 300,
          long: 600,
        };

        // Create prompt based on parameters
        const prompt = `
          Summarize the following text in approximately ${wordCounts[length]} words.
          Complexity level: ${complexity}
          ${focusAreas ? `Focus on these areas: ${focusAreas.join(', ')}` : ''}
          
          Use these guidelines:
          ${complexity === 'basic' ? '- Use simple language and clear structure' : ''}
          ${complexity === 'intermediate' ? '- Include key terminology and moderate detail' : ''}
          ${complexity === 'advanced' ? '- Maintain technical depth and sophisticated analysis' : ''}
          
          Text to summarize:
          ${content}
        `;

        const response = await llm.invoke(prompt);

        return {
          summary: response.content,
          metadata: {
            length,
            complexity,
            focusAreas,
            approximateWordCount: response.content.split(' ').length,
          }
        };
      } catch (error) {
        console.error('Error in summarize_text:', error);
        throw new Error('Failed to generate summary');
      }
    },
  });
}; 