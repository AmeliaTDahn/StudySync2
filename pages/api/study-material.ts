import OpenAI from 'openai';
import type { NextApiRequest, NextApiResponse } from 'next';
import { SummarizationTool } from '../../lib/tools/summarization-tool';
import { QuestionGenerationTool } from '../../lib/tools/question-generation-tool';
import { DifficultyAdjusterTool } from '../../lib/tools/difficulty-adjuster-tool';

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

    const { documentText, materialType, subject, complexity, skillLevel, questionFormat, numberOfQuestions } = req.body;
    console.log('Request details:', {
      materialType,
      subject,
      complexity,
      skillLevel,
      questionFormat,
      numberOfQuestions,
      textLength: documentText?.length || 0,
      hasText: !!documentText
    });

    if (!documentText || documentText.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No document text provided'
      });
    }

    // Clean and validate text
    const cleanedText = documentText
      .replace(/[^\x20-\x7E\n\r\t]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanedText.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid text content found in document'
      });
    }

    let content: string;
    // Remove the truncation
    const maxChunkSize = 8000; // Increased from 4000
    const textChunks = [];
    
    // Split text into chunks if it's too long
    for (let i = 0; i < cleanedText.length; i += maxChunkSize) {
      textChunks.push(cleanedText.slice(i, i + maxChunkSize));
    }

    console.log(`Processing text in ${textChunks.length} chunks`);

    if (materialType === 'practice_quiz') {
      const questionGenerator = new QuestionGenerationTool(process.env.OPENAI_API_KEY!);
      const numQuestions = Math.max(1, Math.min(20, parseInt(String(numberOfQuestions), 10) || 5));
      
      // Pass the full text to the question generator
      const questions = await questionGenerator.generateQuestionsWithExplanations({
        text: cleanedText, // Pass the full text
        format: questionFormat || 'MCQ',
        skillLevel: skillLevel || 'INTERMEDIATE',
        numberOfQuestions: numQuestions,
        subject
      });

      content = formatQuestionsWithExplanations(questions);
    } else if (materialType === 'summary') {
      // For summaries, process each chunk and combine
      const summaries = [];
      const summarizer = new SummarizationTool(process.env.OPENAI_API_KEY!);
      
      for (const chunk of textChunks) {
        const summary = await summarizer.summarize({
          text: chunk,
          complexity: complexity || 'intermediate',
          subject
        });
        summaries.push(summary);
      }
      
      content = summaries.join('\n\n');
    } else {
      // For other types, process first chunk only
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful study assistant that creates study materials from documents."
          },
          {
            role: "user",
            content: generatePrompt(textChunks[0], materialType, subject)
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });
      
      content = response.choices[0]?.message?.content || '';
    }

    // Only adjust difficulty if content was generated successfully
    if (content && skillLevel) {
      const difficultyAdjuster = new DifficultyAdjusterTool(process.env.OPENAI_API_KEY);
      content = await difficultyAdjuster.adjustDifficulty({
        content,
        targetSkillLevel: skillLevel,
        contentType: materialType === 'summary' ? 'SUMMARY' : 
                    materialType === 'practice_quiz' ? 'QUESTIONS' : 'EXPLANATION',
        subject
      });
    }

    if (!content) {
      throw new Error('No content generated');
    }

    return res.status(200).json({
      success: true,
      content,
      difficulty: skillLevel,
      truncated: cleanedText.length > 4000
    });

  } catch (processingError: any) {
    console.error('Processing error:', {
      message: processingError.message,
      stack: processingError.stack,
      type: processingError.type
    });
    
    return res.status(500).json({
      success: false,
      error: `Error processing document: ${processingError.message}`
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

function formatQuestionsWithExplanations(questions: Question[]): string {
  return questions.map((q, index) => {
    let output = `${index + 1}. ${q.question}\n`;
    
    if (q.options) {
      output += q.options.map((opt, i) => 
        `   ${String.fromCharCode(65 + i)}) ${opt}`
      ).join('\n') + '\n';
    }
    
    output += `\nAnswer: ${q.answer}\n`;
    
    if (q.detailedExplanation) {
      output += '\nExplanation:\n';
      
      // Format steps more concisely
      q.detailedExplanation.steps.forEach((step, i) => {
        output += `• ${step}\n`;
      });
      
      // Only show concepts if they exist and are meaningful
      if (q.detailedExplanation.conceptsUsed?.length > 0) {
        output += '\nKey Concepts: ';
        output += q.detailedExplanation.conceptsUsed.join(', ');
        output += '\n';
      }
      
      // Only show additional notes if they exist
      if (q.detailedExplanation.additionalNotes?.trim()) {
        output += `Tip: ${q.detailedExplanation.additionalNotes}\n`;
      }
    }
    
    return output + '\n-------------------\n';
  }).join('\n');
} 