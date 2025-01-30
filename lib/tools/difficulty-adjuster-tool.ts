import OpenAI from 'openai';

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export interface DifficultyAdjusterParams {
  content: string;
  targetSkillLevel: SkillLevel;
  contentType: 'SUMMARY' | 'QUESTIONS' | 'EXPLANATION';
  subject?: string;
}

export class DifficultyAdjusterTool {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  private getPromptForSkillLevel(level: SkillLevel, contentType: string): string {
    const baseInstructions = {
      BEGINNER: {
        vocabulary: "Use simple, everyday language. Replace technical terms with basic explanations.",
        examples: "Use familiar, real-world situations that anyone can understand.",
        structure: "Focus on fundamental concepts and basic recall.",
        quiz: `
          - Simplify questions to test basic understanding
          - Use straightforward multiple choice options
          - Focus on definition and basic concept recognition
          - Include helpful context in the question
          - Make distractors clearly different from correct answers`
      },
      INTERMEDIATE: {
        vocabulary: "Use a mix of technical and everyday terms, explaining complex concepts clearly.",
        examples: "Balance theoretical and practical examples.",
        structure: "Test both recall and application of concepts.",
        quiz: `
          - Include questions that test understanding and application
          - Create plausible but distinct multiple choice options
          - Test relationships between concepts
          - Require some analysis but maintain clarity
          - Include some challenging distractors`
      },
      ADVANCED: {
        vocabulary: "Use proper technical terminology and academic language.",
        examples: "Focus on complex scenarios and theoretical applications.",
        structure: "Emphasize analysis, evaluation, and synthesis of concepts.",
        quiz: `
          - Create questions that require deep analysis
          - Test application of multiple concepts together
          - Include sophisticated distractors that test common misconceptions
          - Require evaluation of complex scenarios
          - Challenge understanding of nuanced distinctions`
      }
    }[level];

    const contentSpecific = {
      SUMMARY: "Adjust the depth and breadth of concepts covered.",
      QUESTIONS: `
        Modify questions according to these guidelines:
        ${baseInstructions.quiz}
        
        For Multiple Choice:
        - BEGINNER: Clear options with obvious differences
        - INTERMEDIATE: Plausible options requiring understanding
        - ADVANCED: Sophisticated options testing deep knowledge
        
        For Open-Ended:
        - BEGINNER: Direct questions with guided response structure
        - INTERMEDIATE: Questions requiring explanation and examples
        - ADVANCED: Analysis questions with multiple valid approaches
        
        For Fill-in-the-Blank:
        - BEGINNER: Complete basic definitions or simple facts
        - INTERMEDIATE: Complete explanations of relationships
        - ADVANCED: Complete complex theoretical statements`,
      EXPLANATION: "Adapt explanation depth and conceptual connections."
    }[contentType];

    return `${baseInstructions.vocabulary} ${baseInstructions.examples} ${baseInstructions.structure} ${contentSpecific}`;
  }

  async adjustDifficulty({
    content,
    targetSkillLevel,
    contentType,
    subject
  }: DifficultyAdjusterParams): Promise<string> {
    try {
      const adjustmentPrompt = this.getPromptForSkillLevel(targetSkillLevel, contentType);
      const subjectContext = subject ? ` in the context of ${subject}` : '';

      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an expert at adjusting educational content to different skill levels${subjectContext}.
              ${adjustmentPrompt}
              
              For ${targetSkillLevel} level:
              1. Maintain the same format but adjust difficulty
              2. Keep the core concepts but modify:
                 - Question complexity
                 - Answer options (for MCQ)
                 - Required analysis level
                 - Language complexity
              3. Ensure questions align with Bloom's Taxonomy:
                 - BEGINNER: Remember, Understand
                 - INTERMEDIATE: Apply, Analyze
                 - ADVANCED: Evaluate, Create
              
              Return the adjusted content preserving all formatting.`
          },
          {
            role: "user",
            content: `Adjust these questions to ${targetSkillLevel} level while maintaining the format:\n\n${content}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      return response.choices[0]?.message?.content || content;
    } catch (error) {
      console.error('Error adjusting difficulty:', error);
      throw new Error('Failed to adjust content difficulty');
    }
  }
} 