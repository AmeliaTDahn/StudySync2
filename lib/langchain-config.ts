import { Client } from "langsmith";

export const initLangChain = () => {
  if (process.env.LANGCHAIN_TRACING_V2 === "true") {
    const client = new Client({
      apiUrl: process.env.LANGCHAIN_ENDPOINT,
      apiKey: process.env.LANGCHAIN_API_KEY,
    });

    console.log("LangChain tracing initialized for project:", process.env.LANGCHAIN_PROJECT);
  }
}; 