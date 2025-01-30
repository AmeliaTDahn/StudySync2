import OpenAI from 'openai';
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log('API Key available:', !!process.env.OPENAI_API_KEY);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting study material generation...');
    
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key missing');
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key is not configured'
      });
    }

    const { documentText, materialType, subject } = req.body;
    console.log('Request details:', {
      materialType,
      subject,
      textLength: documentText?.length || 0,
      hasText: !!documentText
    });

    if (!documentText || documentText.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No document text provided'
      });
    }

    // Limit the text size to a more manageable chunk
    const maxLength = 4000; // Reduced to ~1000 tokens
    const truncatedText = documentText.slice(0, maxLength);
    
    console.log('Processing document:', {
      originalLength: documentText.length,
      truncatedLength: truncatedText.length,
      materialType,
      subject
    });

    const prompt = generatePrompt(truncatedText, materialType, subject);
    console.log('Generated prompt length:', prompt.length);
    
    try {
      console.log('Calling OpenAI API...');
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful study assistant that creates study materials from documents."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000, // Reduced token limit
      });

      console.log('OpenAI API response received');
      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        console.error('No content in OpenAI response');
        return res.status(500).json({
          success: false,
          error: 'No content generated from OpenAI'
        });
      }

      console.log('Sending successful response, content length:', content.length);
      return res.status(200).json({ 
        success: true, 
        content,
        truncated: documentText.length > maxLength
      });

    } catch (openaiError: any) {
      console.error('OpenAI API error:', {
        message: openaiError.message,
        type: openaiError.type,
        stack: openaiError.stack
      });
      
      return res.status(500).json({
        success: false,
        error: `OpenAI API error: ${openaiError.message}`
      });
    }

  } catch (error: any) {
    console.error('General error:', {
      message: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({ 
      success: false, 
      error: `Failed to generate study material: ${error.message}` 
    });
  }
}

function generatePrompt(text: string, type: string, subject?: string): string {
  const subjectContext = subject ? ` for ${subject}` : '';
  
  switch (type) {
    case 'summary':
      return `Create a concise summary${subjectContext} of the following text:\n\n${text}`;
    case 'study_guide':
      return `Create a detailed study guide${subjectContext} from the following text. Include key concepts, definitions, and important points:\n\n${text}`;
    case 'practice_quiz':
      return `Create a practice quiz${subjectContext} based on the following text. Include 5-10 questions with answers:\n\n${text}`;
    default:
      return `Summarize the following text${subjectContext}:\n\n${text}`;
  }
} 