import OpenAI from 'openai';
import type { NextApiRequest, NextApiResponse } from 'next';
import { SummarizationTool } from '../../lib/tools/summarization-tool';
import { QuestionGenerationTool } from '../../lib/tools/question-generation-tool';
import { DifficultyAdjusterTool } from '../../lib/tools/difficulty-adjuster-tool';
import { StudyGuideTool } from '../../lib/tools/study-guide-tool';
import { FillInBlankTool } from '../../lib/tools/fill-in-blank-tool';
import { OpenEndedTool } from '../../lib/tools/open-ended-tool';

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
      const format = questionFormat || 'MCQ';
      let questions;

      try {
        const questionGenerator = new QuestionGenerationTool(process.env.OPENAI_API_KEY!);
        const questions = await questionGenerator.generateQuestionsWithExplanations({
          text: cleanedText,
          skillLevel: skillLevel || 'INTERMEDIATE',
          numberOfQuestions: 10,
          subject
        });

        // Add logging to check the response
        console.log('Questions generated:', questions?.length);
        
        if (!questions || questions.length === 0) {
          throw new Error('No questions were generated');
        }

        content = formatQuestionsWithExplanations(questions);
        
        // Add logging to check formatted content
        console.log('Content formatted successfully');
      } catch (error) {
        console.error('Error generating quiz:', error);
        throw new Error(`Failed to generate quiz: ${error.message}`);
      }
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
    } else if (materialType === 'study_guide') {
      try {
        // Process entire text in manageable chunks
        const maxChunkSize = 8000;
        const chunks = [];
        
        // Split text into chunks while preserving context
        for (let i = 0; i < cleanedText.length; i += maxChunkSize) {
          chunks.push(cleanedText.slice(i, i + maxChunkSize));
        }

        // Process each chunk and combine results
        const studyGuideSections = await Promise.all(chunks.map(async (chunk, index) => {
          const studyGuideTool = new StudyGuideTool(process.env.OPENAI_API_KEY!);
          const sectionGuide = await studyGuideTool.generateStudyGuide({
            text: chunk,
            subject,
            skillLevel: skillLevel || 'INTERMEDIATE',
            sectionNumber: index + 1,
            totalSections: chunks.length
          });
          return sectionGuide;
        }));

        // Combine sections with proper formatting
        content = `
# Comprehensive Study Guide
${studyGuideSections.join('\n\n')}

## Key Concepts Review
${await generateKeyConceptsReview(studyGuideSections)}
`;
      } catch (error) {
        console.error('Error generating study guide:', error);
        throw error;
      }
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
            content: generatePrompt(textChunks[0], materialType, subject, numberOfQuestions)
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
      content: content,
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

function generatePrompt(text: string, type: string, subject?: string, numberOfQuestions?: number): string {
  const subjectContext = subject ? ` for ${subject}` : '';
  
  switch (type) {
    case 'summary':
      return `Create a concise summary${subjectContext} of the following text:\n\n${text}`;
    case 'study_guide':
      return `Create a detailed study guide${subjectContext} from the following text. Include key concepts, definitions, and important points:\n\n${text}`;
    case 'practice_quiz':
      return `Create a practice quiz${subjectContext} based on the following text. Generate exactly ${numberOfQuestions || 10} questions with answers:\n\n${text}`;
    default:
      return `Summarize the following text${subjectContext}:\n\n${text}`;
  }
}

function formatQuestionsWithExplanations(questions: Question[]): string {
  return `
📚 PRACTICE QUIZ
═══════════════════════════════════════════════

${questions.map((q, index) => `
Question ${index + 1}
──────────────
${q.question}

${q.options ? q.options.map(opt => `${opt}`).join('\n') : ''}

Answer: ${q.answer}

${q.detailedExplanation ? `
Explanation:
${q.detailedExplanation.steps.map(step => `• ${step}`).join('\n')}

Key Concepts: ${q.detailedExplanation.conceptsUsed?.join(', ')}
${q.detailedExplanation.additionalNotes ? `\nTip: ${q.detailedExplanation.additionalNotes}` : ''}` : 
q.explanation ? `Explanation:\n${q.explanation}` : ''}
───────────────────────────────────────────────
`).join('\n')}
`.trim();
}

async function generateKeyConceptsReview(sections: string[]): Promise<string> {
  // Extract and summarize key concepts from all sections
  const studyGuideTool = new StudyGuideTool(process.env.OPENAI_API_KEY!);
  return studyGuideTool.generateConceptReview(sections);
} 