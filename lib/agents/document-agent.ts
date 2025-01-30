import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { Document } from "langchain/document";
import { z } from "zod";
import { createDocumentChunkingTool } from '../tools/document-tools';
import { createSummarizationTool } from '../tools/summary-tools';
import { createQuestionGenerationTool, type Question, type QuestionFormat, type QuestionDifficulty } from '../tools/question-tools';
import { createExplanationTool, type AnswerExplanation } from '../tools/explanation-tools';
import { createDifficultyAdjusterTool, type SkillLevel } from '../tools/difficulty-tools';
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

export type DocumentProcessingMode = "summary" | "study_guide" | "practice_quiz";
export type SummaryLength = "short" | "medium" | "long";
export type ComplexityLevel = "basic" | "intermediate" | "advanced";

// Add to existing types
export type { QuestionFormat, QuestionDifficulty };

// Define the base tool for document processing
const createDocumentProcessingTool = (mode: DocumentProcessingMode) => {
  return new DynamicStructuredTool({
    name: `process_document_${mode}`,
    description: `Process a document and create a ${mode.replace('_', ' ')}`,
    schema: z.object({
      content: z.string().describe("The document content to process"),
      maxLength: z.number().optional().describe("Maximum length of the output")
    }),
    func: async ({ content, maxLength }) => {
      try {
        // Use the chunking tool for large documents
        const chunkingTool = createDocumentChunkingTool();
        const { relevantText } = await chunkingTool.func({
          content,
          query: `Key points for ${mode}`,
          chunkSize: 2000,
          overlap: 200
        });

        // Process the relevant chunks based on mode
        let response = '';
        switch (mode) {
          case 'summary':
            response = `Here's a summary of the key points: ${relevantText}`;
            break;
          case 'study_guide':
            response = `Study Guide based on the content:\n${relevantText}`;
            break;
          case 'practice_quiz':
            response = `Practice Quiz generated from the content:\n${relevantText}`;
            break;
        }

        return maxLength ? response.slice(0, maxLength) : response;
      } catch (error) {
        console.error(`Error in ${mode} processing:`, error);
        throw new Error(`Failed to process document in ${mode} mode`);
      }
    }
  });
};

export class DocumentAgent {
  private agent: AgentExecutor;
  private llm: ChatOpenAI;

  constructor() {
    // Get API key from environment variable
    console.log('Environment variables:', {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      openAIKeyLength: process.env.OPENAI_API_KEY?.length,
      envKeys: Object.keys(process.env)
    });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    this.llm = new ChatOpenAI({
      modelName: "gpt-4",
      temperature: 0.7,
      openAIApiKey: apiKey
    });
  }

  async initialize() {
    // Create tools array with all tools
    const tools = [
      createDocumentChunkingTool(),
      createSummarizationTool(),
      createQuestionGenerationTool(),
      createExplanationTool(),
      createDifficultyAdjusterTool(),
      createDocumentProcessingTool("summary"),
      createDocumentProcessingTool("study_guide"),
      createDocumentProcessingTool("practice_quiz")
    ];

    // Create a custom prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful AI assistant that processes documents and creates educational content."],
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]);

    // Create the agent
    const agent = await createOpenAIFunctionsAgent({
      llm: this.llm,
      tools,
      prompt
    });

    this.agent = AgentExecutor.fromAgentAndTools({
      agent,
      tools,
      verbose: true
    });
  }

  async processDocument(
    content: string,
    mode: DocumentProcessingMode,
    options?: { maxLength?: number }
  ) {
    try {
      const result = await this.agent.invoke({
        input: `Process this document and create a ${mode.replace('_', ' ')}: ${content}`,
        maxLength: options?.maxLength
      });

      return {
        success: true,
        result: result.output,
        error: null
      };
    } catch (error) {
      console.error('Error processing document:', error);
      return {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async summarizeDocument(
    content: string, 
    options: { 
      length?: SummaryLength, 
      complexity?: ComplexityLevel,
      focusAreas?: string[]
    } = {}
  ) {
    try {
      // First chunk the document if it's large
      const chunkedContent = await this.agent.invoke({
        input: "chunk_and_retrieve",
        content,
        query: options.focusAreas?.join(' ') || "main points",
      });

      // Then summarize the relevant chunks
      const result = await this.agent.invoke({
        input: "summarize_text",
        content: chunkedContent.relevantText,
        length: options.length || "medium",
        complexity: options.complexity || "intermediate",
        focusAreas: options.focusAreas,
      });

      return {
        success: true,
        result: result.summary,
        metadata: result.metadata,
        error: null
      };
    } catch (error) {
      console.error('Error summarizing document:', error);
      return {
        success: false,
        result: null,
        metadata: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async generateQuestions(
    content: string,
    options: {
      format?: QuestionFormat,
      difficulty?: QuestionDifficulty,
      count?: number,
      topics?: string[]
    } = {}
  ) {
    try {
      // First chunk the document if it's large
      const chunkedContent = await this.agent.invoke({
        input: "chunk_and_retrieve",
        content,
        query: options.topics?.join(' ') || "key concepts",
      });

      // Generate questions from the relevant chunks
      const result = await this.agent.invoke({
        input: "generate_questions",
        content: chunkedContent.relevantText,
        format: options.format || "multiple_choice",
        difficulty: options.difficulty || "medium",
        count: options.count || 5,
        topics: options.topics,
      });

      return {
        success: true,
        questions: result.questions as Question[],
        metadata: result.metadata,
        error: null
      };
    } catch (error) {
      console.error('Error generating questions:', error);
      return {
        success: false,
        questions: null,
        metadata: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async generateExplanations(
    questions: Question[],
    context: string,
    options: {
      detailLevel?: "basic" | "detailed" | "comprehensive";
      includeHints?: boolean;
    } = {}
  ) {
    try {
      const explanations: AnswerExplanation[] = [];

      for (const question of questions) {
        // Get relevant context for this specific question
        const relevantContext = await this.agent.invoke({
          input: "chunk_and_retrieve",
          content: context,
          query: `${question.topic} ${question.question}`,
        });

        // Generate explanation for the question
        const result = await this.agent.invoke({
          input: "generate_answer_explanation",
          question,
          context: relevantContext.relevantText,
          detailLevel: options.detailLevel || "detailed",
          includeHints: options.includeHints ?? true,
        });

        explanations.push(result.explanation);
      }

      return {
        success: true,
        explanations,
        metadata: {
          questionCount: questions.length,
          detailLevel: options.detailLevel || "detailed",
          hasHints: options.includeHints ?? true,
        },
        error: null
      };
    } catch (error) {
      console.error('Error generating explanations:', error);
      return {
        success: false,
        explanations: null,
        metadata: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Helper method to generate questions with explanations in one call
  async generateQuizWithExplanations(
    content: string,
    options: {
      format?: QuestionFormat;
      difficulty?: QuestionDifficulty;
      count?: number;
      topics?: string[];
      explanationDetail?: "basic" | "detailed" | "comprehensive";
      includeHints?: boolean;
    } = {}
  ) {
    // First generate questions
    const questionsResult = await this.generateQuestions(content, {
      format: options.format,
      difficulty: options.difficulty,
      count: options.count,
      topics: options.topics,
    });

    if (!questionsResult.success || !questionsResult.questions) {
      return questionsResult;
    }

    // Then generate explanations for each question
    const explanationsResult = await this.generateExplanations(
      questionsResult.questions,
      content,
      {
        detailLevel: options.explanationDetail || "detailed",
        includeHints: options.includeHints,
      }
    );

    return {
      success: true,
      quiz: {
        questions: questionsResult.questions,
        explanations: explanationsResult.explanations,
      },
      metadata: {
        ...questionsResult.metadata,
        explanations: explanationsResult.metadata,
      },
      error: null
    };
  }

  async adjustContentDifficulty<T extends Question | AnswerExplanation | string>(
    content: T,
    options: {
      contentType: "question" | "explanation" | "summary";
      currentLevel: SkillLevel;
      targetLevel: SkillLevel;
      preserveCore?: boolean;
    }
  ) {
    try {
      const result = await this.agent.invoke({
        input: "adjust_difficulty",
        content,
        contentType: options.contentType,
        currentSkillLevel: options.currentLevel,
        targetSkillLevel: options.targetLevel,
        preserveCore: options.preserveCore ?? true,
      });

      return {
        success: true,
        adjustedContent: result.adjustedContent as T,
        metadata: result.metadata,
        error: null
      };
    } catch (error) {
      console.error('Error adjusting difficulty:', error);
      return {
        success: false,
        adjustedContent: null,
        metadata: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Helper method to adjust an entire quiz
  async adjustQuizDifficulty(
    quiz: { questions: Question[]; explanations?: AnswerExplanation[] },
    options: {
      currentLevel: SkillLevel;
      targetLevel: SkillLevel;
      preserveCore?: boolean;
    }
  ) {
    try {
      const adjustedQuestions = await Promise.all(
        quiz.questions.map(question =>
          this.adjustContentDifficulty(question, {
            contentType: "question",
            ...options
          })
        )
      );

      let adjustedExplanations: typeof quiz.explanations = undefined;
      if (quiz.explanations) {
        adjustedExplanations = (await Promise.all(
          quiz.explanations.map(explanation =>
            this.adjustContentDifficulty(explanation, {
              contentType: "explanation",
              ...options
            })
          )
        )).map(result => result.success ? result.adjustedContent! : null).filter(Boolean);
      }

      return {
        success: true,
        adjustedQuiz: {
          questions: adjustedQuestions.map(result => result.success ? result.adjustedContent! : null).filter(Boolean),
          explanations: adjustedExplanations
        },
        metadata: {
          originalLevel: options.currentLevel,
          targetLevel: options.targetLevel,
          adjustedQuestions: adjustedQuestions.length,
          adjustedExplanations: adjustedExplanations?.length
        },
        error: null
      };
    } catch (error) {
      console.error('Error adjusting quiz difficulty:', error);
      return {
        success: false,
        adjustedQuiz: null,
        metadata: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
} 