import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage } from "@langchain/core/messages";

export class LangChainClient {
  private static instance: LangChainClient;
  private llm: ChatOpenAI;

  private constructor() {
    this.llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      temperature: 0.7,
      modelName: "gpt-3.5-turbo",
    });
  }

  public static getInstance(): LangChainClient {
    if (!LangChainClient.instance) {
      LangChainClient.instance = new LangChainClient();
    }
    return LangChainClient.instance;
  }

  public async chat(message: string): Promise<string> {
    try {
      const response = await this.llm.invoke(message);
      if (typeof response === 'string') {
        return response;
      }
      return (response as BaseMessage).content as string;
    } catch (error) {
      console.error('LangChain chat error:', error);
      throw error;
    }
  }

  // Add more LangChain-specific methods here as needed
  public getLLM(): ChatOpenAI {
    return this.llm;
  }
}

// Example usage:
// const langchain = LangChainClient.getInstance();
// const response = await langchain.chat("Hello, world!"); 