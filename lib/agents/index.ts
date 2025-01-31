import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import { 
  SystemMessage,
  HumanMessage,
  AIMessage 
} from "@langchain/core/messages";
import { 
  ChatPromptTemplate, 
  MessagesPlaceholder 
} from "@langchain/core/prompts";
import { Document } from "langchain/document";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { DocumentChunker } from "./tools/chunking";

export type StudyMaterialType = 'summary' | 'study_guide' | 'practice_quiz';

interface GenerateStudyMaterialParams {
  documentText: string;
  materialType: StudyMaterialType;
  subject?: string;
  additionalInstructions?: string;
}

export interface StudyMaterialResponse {
  success: boolean;
  content: string;
  truncated?: boolean;
}

export class StudyAgent {
  private model: ChatOpenAI;
  private executor: AgentExecutor | null = null;
  private chunker: DocumentChunker;

  constructor() {
    this.model = new ChatOpenAI({
      modelName: "gpt-4-turbo-preview",
      temperature: 0.7,
      maxTokens: 4000,
    });
    this.chunker = new DocumentChunker();
  }

  async initialize() {
    try {
      // Get the agent prompt from LangChain hub
      const prompt = await pull<ChatPromptTemplate>("hwchase17/openai-tools-agent");

      // Initialize the agent with system message
      const systemMessage = `You are an expert educational AI assistant that helps students learn effectively.
        You can analyze documents and create various study materials including summaries, study guides, and practice quizzes.
        Always structure your responses clearly and focus on the most important concepts.`;

      const newPrompt = await ChatPromptTemplate.fromMessages([
        ["system", systemMessage],
        new MessagesPlaceholder("chat_history"),
        ["human", "{input}"],
        new MessagesPlaceholder("agent_scratchpad"),
      ]);

      // Create the agent
      const agent = await createOpenAIToolsAgent({
        llm: this.model,
        prompt: newPrompt,
        tools: [] // We'll add tools in future updates
      });

      this.executor = new AgentExecutor({
        agent,
        tools: [],
        verbose: true
      });

      return true;
    } catch (error) {
      console.error("Error initializing StudyAgent:", error);
      return false;
    }
  }

  private async processChunk(chunk: string, materialType: StudyMaterialType): Promise<string> {
    const prompt = `Process the following section of text and create part of a ${materialType}. 
    Focus on maintaining context and creating a coherent section that can be combined with other parts.
    
    Text section:
    ${chunk}`;

    const response = await this.model.invoke(prompt);
    return response.content as string;
  }

  async generateStudyMaterial({
    documentText,
    materialType,
    complexity,
    skillLevel,
    numberOfQuestions
  }: StudyMaterialRequest): Promise<StudyMaterialResponse> {
    try {
      const controller = new AbortController();
      // Increase timeout to 3 minutes
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      const response = await fetch('/api/study-material', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentText,
          materialType,
          complexity,
          skillLevel,
          numberOfQuestions
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate study material');
      }

      return await response.json();
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Request is taking too long. Try with a shorter text or break it into smaller parts.');
      }
      throw error;
    }
  }
}

// Export a singleton instance
export const studyAgent = new StudyAgent(); 