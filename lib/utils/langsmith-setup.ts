import { ChatOpenAI } from "@langchain/openai";
import { ConsoleCallbackHandler } from "langchain/callbacks";
import { Client as LangChainTracer } from "langsmith";  // Import Client and rename it

// Make sure these ENV vars are set in your .env or environment
process.env.LANGCHAIN_TRACING_V2 = "true";
process.env.LANGCHAIN_PROJECT = "studyapp";

export async function createTracedLLM() {
  try {
    // Create a LangSmithCallbackHandler
    const langsmithHandler = new LangChainTracer({
      // These three lines are optional if you've set them in .env
      apiUrl: process.env.LANGCHAIN_ENDPOINT,  // e.g., "https://api.smith.langchain.com"
      apiKey: process.env.LANGCHAIN_API_KEY,
      project: process.env.LANGCHAIN_PROJECT,
    });

    // Add any other callbacks (like ConsoleCallbackHandler)
    const callbacks = [
      new ConsoleCallbackHandler(),
      langsmithHandler
    ];

    const llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      temperature: 0.7,
      callbacks,     // attach the callbacks
    });

    console.log("✅ LLM created with LangSmith tracing enabled");
    return llm;
  } catch (error) {
    console.error("❌ Error creating traced LLM:", error);
    throw error;
  }
}
