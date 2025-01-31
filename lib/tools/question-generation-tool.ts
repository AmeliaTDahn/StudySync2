import OpenAI from 'openai';
import { ExplanationTool, type DetailedExplanation } from './explanation-tool';

export type QuestionFormat = 'MCQ' | 'OPEN_ENDED' | 'FILL_IN_THE_BLANK';
export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export interface QuestionGenerationParams {
  text: string;
  format?: QuestionFormat;
  skillLevel?: SkillLevel;
  numberOfQuestions?: number;
  subject?: string;
}

export interface Question {
  question: string;
  answer: string;
  options?: string[];  // For MCQ
  explanation?: string;
  detailedExplanation?: DetailedExplanation;
}

export class QuestionGenerationTool {
  private openai: OpenAI;
  private explanationTool: ExplanationTool;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
    this.explanationTool = new ExplanationTool(apiKey);
  }

  private getPromptForFormat(format: QuestionFormat, skillLevel: SkillLevel, numQuestions: number): string {
    const levelContext = {
      BEGINNER: "using simple language and basic concepts",
      INTERMEDIATE: "incorporating field-specific terminology and moderate complexity",
      ADVANCED: "using advanced concepts and challenging application of knowledge"
    }[skillLevel];

    switch (format) {
      case 'MCQ':
        return `Create exactly ${numQuestions} multiple-choice questions ${levelContext}. For each question:
          1. Write a clear question
          2. Provide 4 options (A, B, C, D)
          3. Indicate the correct answer
          4. Add a brief explanation of why it's correct
          Format as JSON with fields: question, options (array), correctAnswer, explanation`;
      
      case 'OPEN_ENDED':
        return `Create exactly ${numQuestions} open-ended questions ${levelContext}. For each question:
          1. Write a thought-provoking question that requires explanation
          2. Provide a model answer
          3. Include key points that should be addressed
          Format as JSON with fields: question, modelAnswer, keyPoints`;
      
      case 'FILL_IN_THE_BLANK':
        return `Create exactly ${numQuestions} fill-in-the-blank questions ${levelContext}. For each question:
          1. Write a sentence with a key term or concept blanked out
          2. Provide the correct answer
          3. Add a brief explanation of the concept
          Format as JSON with fields: question, answer, explanation`;
      
      default:
        return `Create exactly ${numQuestions} mixed-format questions ${levelContext}`;
    }
  }

  async generateQuestions({
    text,
    format = 'MCQ',
    skillLevel = 'INTERMEDIATE',
    numberOfQuestions = 10,
    subject
  }: QuestionGenerationParams): Promise<Question[]> {
    try {
      const numQuestions = 10; // Force exactly 10 questions
      console.log('Starting question generation, forcing 10 questions');

      // Split text into 3 sections
      const sections = this.splitIntoSections(text, 3);
      console.log(`Split text into ${sections.length} sections`);

      // Calculate exact questions per section (3,3,4)
      const questionsPerSection = [3, 3, 4];
      const allQuestions: Question[] = [];

      // Process each section
      for (let i = 0; i < sections.length; i++) {
        const questionsNeeded = questionsPerSection[i];
        console.log(`Section ${i + 1}: Requesting ${questionsNeeded} questions`);

        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          try {
            const response = await this.openai.chat.completions.create({
              model: "gpt-3.5-turbo",
              messages: [
                {
                  role: "system",
                  content: `You are a precise question generator that must generate EXACTLY ${questionsNeeded} questions.
                    
                    CRITICAL REQUIREMENTS:
                    1. Generate EXACTLY ${questionsNeeded} questions - no more, no less
                    2. Questions must be from this section only
                    3. Each question must be unique
                    4. Format: ${format}
                    5. Difficulty: ${skillLevel}
                    
                    ${this.getPromptForFormat(format, skillLevel, questionsNeeded)}`
                },
                {
                  role: "user",
                  content: `Generate EXACTLY ${questionsNeeded} questions from this section:

                    Section ${i + 1}/3:
                    ${sections[i]}
                    
                    You MUST return EXACTLY ${questionsNeeded} questions.`
                }
              ],
              temperature: 0.7,
              max_tokens: 2000,
              response_format: { type: "json_object" }
            });

            const content = response.choices[0]?.message?.content;
            if (!content) throw new Error('No content returned');

            const parsedContent = JSON.parse(content);
            if (!Array.isArray(parsedContent.questions)) {
              throw new Error('Questions is not an array');
            }

            if (parsedContent.questions.length !== questionsNeeded) {
              throw new Error(`Got ${parsedContent.questions.length} questions instead of ${questionsNeeded}`);
            }

            const sectionQuestions = this.formatQuestions(parsedContent.questions, format);
            if (sectionQuestions.length === questionsNeeded) {
              allQuestions.push(...sectionQuestions);
              console.log(`Section ${i + 1}: Successfully got ${questionsNeeded} questions`);
              break;
            }

            throw new Error('Formatted questions count mismatch');
          } catch (error) {
            attempts++;
            console.warn(`Section ${i + 1}: Attempt ${attempts} failed:`, error);
            if (attempts === maxAttempts) {
              throw new Error(`Failed to get correct number of questions after ${maxAttempts} attempts`);
            }
          }
        }
      }

      // Final validation
      if (allQuestions.length !== 10) {
        throw new Error(`Failed to generate exactly 10 questions (got ${allQuestions.length})`);
      }

      console.log('Successfully generated exactly 10 questions');
      return allQuestions;
    } catch (error) {
      console.error('Error in question generation:', error);
      throw error;
    }
  }

  private splitIntoSections(text: string, targetSections: number): string[] {
    // Clean the text
    const cleanText = text.replace(/\s+/g, ' ').trim();
    
    // Calculate approximate section size
    const sectionSize = Math.ceil(cleanText.length / targetSections);
    
    // Split into sections of roughly equal size
    const sections: string[] = [];
    let currentSection = '';
    let currentLength = 0;
    
    // Split by sentences first
    const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
    
    for (const sentence of sentences) {
      if (currentLength + sentence.length > sectionSize && currentSection) {
        sections.push(currentSection.trim());
        currentSection = '';
        currentLength = 0;
      }
      currentSection += (currentLength > 0 ? ' ' : '') + sentence;
      currentLength += sentence.length;
    }
    
    if (currentSection) {
      sections.push(currentSection.trim());
    }

    console.log(`Created ${sections.length} sections with lengths:`, 
      sections.map(s => s.length));
    
    return sections;
  }

  private formatQuestions(questions: any[], format: QuestionFormat): Question[] {
    return questions.map(q => {
      const formattedQuestion = {
        question: `📝 ${q.question}`,
        options: q.options?.map((opt: string, i: number) => 
          `   ${String.fromCharCode(65 + i)}. ${opt}`),
        answer: `✅ ${q.answer}`,
        explanation: q.explanation ? `💡 Explanation:\n   ${q.explanation}` : undefined
      };

      if (format === 'MCQ') {
        return {
          ...formattedQuestion,
          options: q.options,
          answer: q.correctAnswer,
          explanation: q.explanation
        };
      } else if (format === 'OPEN_ENDED') {
        return {
          ...formattedQuestion,
          answer: q.modelAnswer,
          explanation: q.keyPoints.join('\n   • ')
        };
      } else {
        return {
          ...formattedQuestion,
          answer: q.answer,
          explanation: q.explanation
        };
      }
    });
  }

  async generateQuestionsWithExplanations({
    text,
    format = 'MCQ',
    skillLevel = 'INTERMEDIATE',
    numberOfQuestions = 10,
    subject
  }: QuestionGenerationParams): Promise<Question[]> {
    console.log('generateQuestionsWithExplanations called with:', { numberOfQuestions });
    
    // Ensure numberOfQuestions is a valid number
    const numQuestions = Number(numberOfQuestions);
    if (isNaN(numQuestions) || numQuestions < 1) {
      throw new Error(`Invalid number of questions requested: ${numberOfQuestions}`);
    }

    // Generate questions with exact count
    const questions = await this.generateQuestions({
      text,
      format,
      skillLevel,
      numberOfQuestions: numQuestions,
      subject
    });

    if (questions.length !== numQuestions) {
      console.warn(`Question count mismatch - Requested: ${numQuestions}, Generated: ${questions.length}`);
    }

    // Generate explanations for exactly the number requested
    const questionsWithExplanations = await Promise.all(
      questions.slice(0, numQuestions).map(async (question) => {
        try {
          const detailedExplanation = await this.explanationTool.generateExplanation({
            question: question.question,
            answer: question.answer,
            context: text,
            subject,
            complexity: skillLevel
          });

          return {
            ...question,
            detailedExplanation
          };
        } catch (error) {
          console.error('Error generating explanation for question:', error);
          return question;
        }
      })
    );

    console.log(`Returning exactly ${questionsWithExplanations.length} questions with explanations`);
    return questionsWithExplanations;
  }
}