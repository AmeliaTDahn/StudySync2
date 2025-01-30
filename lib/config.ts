export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  isServer: typeof window === 'undefined'
};

// Validate required environment variables
export function validateConfig() {
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY is not configured in environment variables');
  }
  
  if (!config.openai.apiKey.startsWith('sk-')) {
    throw new Error('OPENAI_API_KEY appears to be invalid');
  }
} 