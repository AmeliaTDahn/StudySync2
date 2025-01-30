import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Verify LangChain environment
export function verifyLangChainEnv() {
  const required = [
    'LANGCHAIN_API_KEY',
    'LANGCHAIN_PROJECT',
    'LANGCHAIN_ENDPOINT'
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing LangChain environment variables: ${missing.join(', ')}`);
  }
} 