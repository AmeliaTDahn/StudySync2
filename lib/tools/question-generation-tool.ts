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

  private getPromptForFormat(format: QuestionFormat, skillLevel: SkillLevel): string {
    const levelContext = {
      BEGINNER: "using simple language and basic concepts",
      INTERMEDIATE: "incorporating field-specific terminology and moderate complexity",
      ADVANCED: "using advanced concepts and challenging application of knowledge"
    }[skillLevel];

    switch (format) {
      case 'MCQ':
        return `Create multiple-choice questions ${levelContext}. For each question:
          1. Write a clear question
          2. Provide 4 options (A, B, C, D)
          3. Indicate the correct answer
          4. Add a brief explanation of why it's correct
          Format as JSON with fields: question, options (array), correctAnswer, explanation`;
      
      case 'OPEN_ENDED':
        return `Create open-ended questions ${levelContext}. For each question:
          1. Write a thought-provoking question that requires explanation
          2. Provide a model answer
          3. Include key points that should be addressed
          Format as JSON with fields: question, modelAnswer, keyPoints`;
      
      case 'FILL_IN_THE_BLANK':
        return `Create fill-in-the-blank questions ${levelContext}. For each question:
          1. Write a sentence with a key term or concept blanked out
          2. Provide the correct answer
          3. Add a brief explanation of the concept
          Format as JSON with fields: question, answer, explanation`;
      
      default:
        return `Create mixed-format questions ${levelContext}`;
    }
  }

  async generateQuestions({
    text,
    format = 'MCQ',
    skillLevel = 'INTERMEDIATE',
    numberOfQuestions = 5,
    subject
  }: QuestionGenerationParams): Promise<Question[]> {
    try {
      let numQuestions = Number(numberOfQuestions);
      console.log('Starting question generation with text length:', text.length);

      // Split text into sections (aim for 3-5 sections)
      const targetSections = Math.min(5, Math.max(3, Math.floor(numQuestions / 2)));
      const sections = this.splitIntoSections(text, targetSections);
      console.log(`Split text into ${sections.length} sections`);

      // Calculate exact questions per section
      const questionsPerSection = Math.floor(numQuestions / sections.length);
      // Calculate remaining questions to distribute
      const remainingQuestions = numQuestions % sections.length;
      
      console.log(`Generating ${questionsPerSection} questions per section, with ${remainingQuestions} extra`);

      const allQuestions: Question[] = [];

      // Process each section
      for (let i = 0; i < sections.length; i++) {
        // Add an extra question to early sections if we have remaining questions
        const extraQuestion = i < remainingQuestions ? 1 : 0;
        const questionsNeeded = questionsPerSection + extraQuestion;

        if (questionsNeeded === 0) continue;

        console.log(`Processing section ${i + 1}/${sections.length}, generating ${questionsNeeded} questions`);

        const response = await this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `Generate exactly ${questionsNeeded} questions from this section (${i + 1} of ${sections.length}).
                Do not reference information outside this specific section.
                
                Rules:
                1. Generate EXACTLY ${questionsNeeded} questions
                2. Questions must be specific to this section's content
                3. Each question must cover a different concept
                4. Format: ${format}
                5. Difficulty: ${skillLevel}
                
                ${this.getPromptForFormat(format, skillLevel)}`
            },
            {
              role: "user",
              content: `Section ${i + 1}/${sections.length}:\n\n${sections[i]}\n\nGenerate exactly ${questionsNeeded} questions from this section only.`
            }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) continue;

        try {
          const parsedContent = JSON.parse(content);
          if (!Array.isArray(parsedContent.questions)) continue;

          const sectionQuestions = this.formatQuestions(parsedContent.questions, format)
            .slice(0, questionsNeeded);
          
          if (sectionQuestions.length > 0) {
            console.log(`Added ${sectionQuestions.length} questions from section ${i + 1}`);
            allQuestions.push(...sectionQuestions);
          }
        } catch (error) {
          console.error(`Error processing section ${i + 1}:`, error);
        }
      }

      console.log(`Generated ${allQuestions.length} total questions across ${sections.length} sections`);
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
      switch (format) {
        case 'MCQ':
          return {
            question: q.question,
            options: q.options,
            answer: q.correctAnswer,
            explanation: q.explanation
          };
        case 'OPEN_ENDED':
          return {
            question: q.question,
            answer: q.modelAnswer,
            explanation: q.keyPoints.join('\n')
          };
        case 'FILL_IN_THE_BLANK':
          return {
            question: q.question,
            answer: q.answer,
            explanation: q.explanation
          };
        default:
          return q;
      }
    });
  }

  async generateQuestionsWithExplanations({
    text,
    format = 'MCQ',
    skillLevel = 'INTERMEDIATE',
    numberOfQuestions = 5,
    subject
  }: QuestionGenerationParams): Promise<Question[]> {
    console.log('generateQuestionsWithExplanations called with:', { numberOfQuestions });
    
    // Ensure numberOfQuestions is a number
    const numQuestions = Number(numberOfQuestions);
    if (isNaN(numQuestions) || numQuestions < 1) {
      throw new Error('Invalid number of questions requested');
    }

    // First generate questions
    const questions = await this.generateQuestions({
      text,
      format,
      skillLevel,
      numberOfQuestions: numQuestions,
      subject
    });

    console.log(`Generated ${questions.length} questions, adding explanations`);

    // Then generate detailed explanations for each question
    const questionsWithExplanations = await Promise.all(
      questions.map(async (question) => {
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

    console.log(`Returning ${questionsWithExplanations.length} questions with explanations`);
    return questionsWithExplanations;
  }
}