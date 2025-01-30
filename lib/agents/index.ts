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
    subject = '',
    additionalInstructions = ''
  }: GenerateStudyMaterialParams) {
    try {
      if (!documentText) {
        throw new Error("No document text provided");
      }

      // Split the document into chunks
      const chunks = await this.chunker.splitDocument(documentText);
      console.log(`Document split into ${chunks.length} chunks`);

      // Create the processing function
      const processor = async (chunk: string) => {
        return await this.processChunk(chunk, materialType);
      };

      // Choose combination strategy based on material type
      const combineStrategy = materialType === 'summary' ? 'summarize' : 'concatenate';

      // Process all chunks and combine results
      const processedContent = await this.chunker.processChunksWithModel(
        chunks,
        processor,
        combineStrategy
      );

      // Final formatting based on material type
      let finalContent = processedContent;
      if (materialType === 'practice_quiz') {
        // Additional processing for quiz format
        const formatPrompt = `Format the following content as a clear quiz with numbered questions:
          ${processedContent}`;
        const formattedResponse = await this.model.invoke(formatPrompt);
        finalContent = formattedResponse.content as string;
      }

      return {
        success: true,
        content: finalContent,
        materialType,
        chunkCount: chunks.length
      };

    } catch (error) {
      console.error("Error generating study material:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        materialType
      };
    }
  }
}

// Export a singleton instance
export const studyAgent = new StudyAgent(); 