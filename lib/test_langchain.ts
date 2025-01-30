import { ChatOpenAI } from "@langchain/openai";
import { Client } from "langsmith";
import { LLMChain } from "langchain/chains";
import { PromptTemplate } from "@langchain/core/prompts";

export async function testLangSmithConnection() {
  try {
    // First test the client connection
    const client = new Client({
      apiUrl: process.env.LANGCHAIN_ENDPOINT,
      apiKey: process.env.LANGCHAIN_API_KEY,
    });

    // Test project access
    const projects = await client.listProjects();
    console.log("Connected to LangSmith. Available projects:", projects);

    // Create a simple chain to test tracing
    const llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY  // Explicitly pass the OpenAI API key
    });

    const prompt = PromptTemplate.fromTemplate(
      "What is a simple explanation of {topic}?"
    );

    const chain = new LLMChain({
      llm,
      prompt,
      tags: ["test-connection"],
    });

    // Run the chain
    const result = await chain.invoke({
      topic: "LangSmith",
    });

    console.log("Test chain result:", result);
    console.log("Check your LangSmith dashboard to see the trace!");

    return {
      success: true,
      message: "Successfully connected to LangSmith and ran test chain",
      projects,
      result
    };

  } catch (error) {
    console.error("LangSmith connection test failed:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
      error
    };
  }
} 