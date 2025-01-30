import OpenAI from 'openai';

export interface ExplanationParams {
  question: string;
  answer: string;
  context: string;
  subject?: string;
  complexity?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
}

export interface DetailedExplanation {
  steps: string[];
  conceptsUsed: string[];
  additionalNotes?: string;
}

export class ExplanationTool {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  private getPromptForComplexity(complexity: string = 'INTERMEDIATE'): string {
    switch (complexity) {
      case 'BEGINNER':
        return "Compare this to something from everyday life. Use simple 'like when you...' examples. Avoid technical terms.";
      case 'INTERMEDIATE':
        return "Explain using a mix of real-world examples and field-specific concepts. Compare with a related but different concept.";
      case 'ADVANCED':
        return "Analyze the theoretical framework, highlight critical nuances, and discuss relationships with other advanced concepts.";
      default:
        return "Explain using clear examples and highlight key relationships.";
    }
  }

  async generateExplanation({
    question,
    answer,
    context,
    subject,
    complexity = 'INTERMEDIATE'
  }: ExplanationParams): Promise<DetailedExplanation> {
    try {
      const basePrompt = this.getPromptForComplexity(complexity);
      const subjectContext = subject ? ` in the context of ${subject}` : '';

      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an engaging tutor${subjectContext} who makes complex ideas relatable. ${basePrompt}
              Never just restate the question. Instead:
              1. Use vivid examples or analogies
              2. Compare with opposite or related concepts
              3. Explain practical implications
              
              Format your response as JSON with:
              {
                "steps": [
                  "Use a relatable analogy or real-world example",
                  "Compare with an opposite concept to show the distinction",
                  "Explain a practical implication or why this matters"
                ],
                "conceptsUsed": ["2-3 core concepts that illuminate the answer"],
                "additionalNotes": "one memorable fact or common misconception to avoid"
              }
              
              For multiple choice:
              - Explain why the correct answer makes sense logically
              - Point out why a tempting wrong answer is incorrect
              - Give a memorable way to remember the distinction`
          },
          {
            role: "user",
            content: `Question: ${question}\nAnswer: ${answer}\n\nMake this concept clear and memorable using this context:\n${context}`
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No explanation generated');
      }

      return JSON.parse(content);
    } catch (error) {
      console.error('Error generating explanation:', error);
      throw new Error('Failed to generate explanation');
    }
  }

  formatExplanation(explanation: DetailedExplanation): string {
    let formatted = "Step-by-Step Explanation:\n";
    explanation.steps.forEach((step, index) => {
      formatted += `${index + 1}. ${step}\n`;
    });

    formatted += "\nKey Concepts Used:\n";
    explanation.conceptsUsed.forEach(concept => {
      formatted += `• ${concept}\n`;
    });

    if (explanation.additionalNotes) {
      formatted += "\nAdditional Notes:\n";
      formatted += explanation.additionalNotes;
    }

    return formatted;
  }
} 