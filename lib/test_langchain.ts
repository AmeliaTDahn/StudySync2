import { ChatOpenAI } from "@langchain/openai";
import dotenv from 'dotenv';
import { Client } from "langsmith";

// Load environment variables
dotenv.config();

// Initialize LangSmith client
const client = new Client({
  apiKey: process.env.LANGSMITH_API_KEY,
  projectName: "studyapp" // Changed to your actual project name
});

async function testLangChain() {
  try {
    const llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      temperature: 0.9
    });
    
    const result = await llm.invoke("Hello, world!", {
      tags: ["test"],
      metadata: { environment: "development" }
    });
    console.log("LangChain Response:", result);
  } catch (error) {
    console.error("Error testing LangChain:", error);
  }
}

// Run the test
testLangChain(); 