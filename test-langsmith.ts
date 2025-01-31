import { createTracedLLM } from './lib/utils/langsmith-setup';

async function main() {
  const llm = await createTracedLLM();
  const response = await llm.invoke("Explain what LangSmith is in one sentence.");
  console.log('Response:', response.content);
}

main().catch(console.error); 