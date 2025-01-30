import { createTracedLLM } from './lib/utils/langsmith-setup';

async function main() {
  try {
    const llm = await createTracedLLM();
    console.log('LLM created, testing...');
    
    // Make an actual call to the LLM
    const response = await llm.invoke("What is LangSmith tracing and why is it useful?");
    console.log('Response:', response.content);
    
    console.log('✅ Check smith.langchain.com for the trace');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

main(); 