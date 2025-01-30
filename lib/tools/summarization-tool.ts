import OpenAI from 'openai';

export type SummaryComplexity = 'beginner' | 'intermediate' | 'advanced';

interface SummarizeOptions {
  text: string;
  complexity: SummaryComplexity;
  subject?: string;
}

export class SummarizationTool {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  private getPromptForComplexity(complexity: SummaryComplexity): string {
    switch (complexity) {
      case 'beginner':
        return "Create a simple, easy-to-understand summary using basic vocabulary and clear explanations. Avoid technical terms where possible.";
      case 'intermediate':
        return "Create a detailed summary that balances technical accuracy with accessibility. Include key terminology with brief explanations.";
      case 'advanced':
        return "Create a comprehensive summary using field-specific terminology and advanced concepts. Assume reader has strong background knowledge.";
      default:
        return "Create a balanced summary of the following text.";
    }
  }

  async summarize({ text, complexity, subject }: SummarizeOptions): Promise<string> {
    const basePrompt = this.getPromptForComplexity(complexity);
    const subjectContext = subject ? ` in the context of ${subject}` : '';
    
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an expert at creating summaries${subjectContext}. ${basePrompt}`
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Error in summarization:', error);
      throw new Error('Failed to generate summary');
    }
  }
} 