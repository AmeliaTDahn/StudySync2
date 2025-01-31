import OpenAI from 'openai';
import type { NextApiRequest, NextApiResponse } from 'next';
import { SummarizationTool } from '../../lib/tools/summarization-tool';
import { QuestionGenerationTool } from '../../lib/tools/question-generation-tool';
import { DifficultyAdjusterTool } from '../../lib/tools/difficulty-adjuster-tool';
import { StudyGuideTool } from '../../lib/tools/study-guide-tool';
import { ContentBoundaryDetector } from '../../lib/tools/content-boundary-detector';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    },
    responseLimit: false,
    externalResolver: true
  }
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log('API Key available:', !!process.env.OPENAI_API_KEY);

// Add test API call
async function testOpenAIConnection() {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Test" }],
      max_tokens: 5
    });
    console.log('OpenAI connection test successful');
    return true;
  } catch (error) {
    console.error('OpenAI connection test failed:', error);
    return false;
  }
}

// Add new type for output format
type OutputFormat = 'html' | 'markdown';

// Add this helper function at the top level
function cleanStudyGuideSection(section: string): string {
  return section
    ?.split('\n')
    .filter(line => !line.match(/[╔═╗╚╝║]|═+|╚═+|━+/)) // Filter out border lines
    .filter(line => !line.includes('STUDY GUIDE'))
    .filter(line => !line.includes('Use this exact structure'))
    .filter(line => !line.includes('Make the content clear'))
    .filter(line => !line.includes('Include the separator'))
    .filter(line => !line.includes('Adapt language'))
    .filter(line => !line.match(/^─+$/))
    .filter(line => line.trim())
    .map(line => `<li>${line.trim().replace(/^[•\-]\s*/, '')}</li>`)
    .join('\n') || '';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Add timeout handling
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=120');

  // Add connection test at start of handler
  const apiWorking = await testOpenAIConnection();
  if (!apiWorking) {
    return res.status(500).json({
      success: false,
      error: 'OpenAI API connection failed'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting study material generation...');
    console.log('Request body:', {
      materialType: req.body.materialType,
      textLength: req.body.documentText?.length,
      complexity: req.body.complexity,
      skillLevel: req.body.skillLevel
    });
    
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key missing');
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key is not configured'
      });
    }

    const { documentText, materialType, complexity, skillLevel, questionFormat, numberOfQuestions } = req.body;
    console.log('Request details:', {
      materialType,
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

    // After cleaning the text but before any processing
    let content: string;
    const boundaryDetector = new ContentBoundaryDetector(process.env.OPENAI_API_KEY!);
    const { mainContent, confidence, reason } = await boundaryDetector.detectMainContent(cleanedText);

    // Log the detection results
    console.log('Content boundary detection:', {
      originalLength: cleanedText.length,
      mainContentLength: mainContent.length,
      confidence,
      reason
    });

    // Use mainContent for all generation types
    const maxChunkSize = 8000;
    const textChunks = [];

    // Split text into chunks if it's too long
    for (let i = 0; i < mainContent.length; i += maxChunkSize) {
      textChunks.push(mainContent.slice(i, i + maxChunkSize));
    }

    if (materialType === 'summary') {
      // Use textChunks from mainContent for summary
      const summarizer = new SummarizationTool(process.env.OPENAI_API_KEY!);
      const summaries = [];
      
      // Process each chunk with error handling
      for (const chunk of textChunks) {
        try {
          const summary = await summarizer.summarize({
            text: chunk,
            complexity: complexity || 'intermediate',
          });
          summaries.push(summary);
        } catch (error) {
          console.error('Error processing chunk:', error);
          continue;
        }
      }
      
      // Combine summaries with appropriate transitions
      content = summaries.filter(Boolean).join('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');
      
      // If no summaries were generated successfully, throw error
      if (!content) {
        throw new Error('Failed to generate summary for the document');
      }

      // After generating summaries, wrap in HTML
      content = `
<!DOCTYPE html>
<html>
<head>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@500;600;700&display=swap');
  
  body {
    font-family: 'Inter', sans-serif;
    line-height: 1.8;
    max-width: 800px;
    margin: 40px auto;
    padding: 20px;
    color: #333;
    background: #f5f7fb;
  }
  .summary {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.07);
    padding: 40px;
  }
  h1 {
    font-family: 'Poppins', sans-serif;
    text-align: center;
    color: #1e40af;
    margin-bottom: 40px;
    font-size: 2em;
  }
  .section {
    margin-bottom: 30px;
    padding: 30px;
    border-radius: 12px;
    background: #f8fafc;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .section:last-child {
    margin-bottom: 0;
  }
  p {
    margin: 0 0 1.5em;
    text-align: justify;
    font-size: 1.05em;
  }
  p:last-child {
    margin-bottom: 0;
  }
  .divider {
    border-top: 2px solid #e5e7eb;
    margin: 35px 0;
  }
  .section-number {
    font-family: 'Poppins', sans-serif;
    color: #2563eb;
    font-weight: 600;
    margin-bottom: 15px;
    font-size: 1.1em;
  }
</style>
</head>
<body>
  <div class="summary">
    <h1>📝 Summary - ${complexity.charAt(0).toUpperCase() + complexity.slice(1)} Level</h1>
    ${summaries.map((summary, index) => `
      <div class="section">
        <div class="section-number">Part ${index + 1}</div>
        ${summary.split('\n\n').map(paragraph => `<p>${paragraph}</p>`).join('\n')}
      </div>
      ${index < summaries.length - 1 ? '<div class="divider"></div>' : ''}
    `).join('')}
  </div>
</body>
</html>`;
    } else if (materialType === 'practice_quiz') {
      console.log('Starting quiz generation...');
      const questionGenerator = new QuestionGenerationTool(process.env.OPENAI_API_KEY!);
      
      try {
        // Break content into smaller chunks
        const maxChunkSize = 4000;
        const chunks = [];
        
        // Split content into smaller pieces
        for (let i = 0; i < mainContent.length; i += maxChunkSize) {
          chunks.push(mainContent.slice(i, i + maxChunkSize));
        }

        // Generate questions from each chunk
        console.log(`Processing ${chunks.length} chunks for quiz...`);
        const allQuestions = await Promise.all(
          chunks.map(async (chunk, index) => {
            try {
              const chunkQuestions = await questionGenerator.generateQuestionsWithExplanations({
                text: chunk,
                format: 'MCQ',
                skillLevel: skillLevel || 'INTERMEDIATE',
                numberOfQuestions: Math.ceil((numberOfQuestions || 10) / chunks.length)
              });
              console.log(`Generated ${chunkQuestions.length} questions from chunk ${index + 1}`);
              return chunkQuestions;
            } catch (error) {
              console.error(`Error processing chunk ${index + 1}:`, error);
              return [];
            }
          })
        );

        // Flatten and limit to requested number of questions
        const questions = allQuestions
          .flat()
          .slice(0, numberOfQuestions || 10);

        if (!questions || questions.length === 0) {
          throw new Error('Failed to generate quiz questions');
        }

        console.log(`Successfully generated ${questions.length} questions`);

        // Format quiz HTML
        content = `
<!DOCTYPE html>
<html>
<head>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@500;600;700&display=swap');
  
  body {
    font-family: 'Inter', sans-serif;
    line-height: 1.8;
    max-width: 800px;
    margin: 40px auto;
    padding: 20px;
    color: #333;
    background: #f5f7fb;
  }
  .quiz {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.07);
    padding: 40px;
  }
  h1 {
    font-family: 'Poppins', sans-serif;
    text-align: center;
    color: #1e40af;
    margin-bottom: 30px;
    font-size: 2em;
  }
  .question {
    margin-bottom: 40px;
    padding: 20px;
    border-radius: 8px;
    background: #f8fafc;
  }
  .question-header {
    font-family: 'Poppins', sans-serif;
    font-weight: 600;
    color: #1e40af;
    margin-bottom: 15px;
  }
  .question-text {
    font-size: 1.1em;
    margin-bottom: 20px;
  }
  .options {
    display: grid;
    gap: 12px;
  }
  .option {
    padding: 12px 15px;
    border-radius: 8px;
    background: white;
    cursor: pointer;
    border: 1px solid #e5e7eb;
    transition: all 0.2s ease;
  }
  .option:hover {
    background: #f3f4f6;
    transform: translateX(5px);
  }
  .option.correct {
    background: #dcfce7;
    color: #15803d;
    border: 2px solid #15803d;
  }
  .option.incorrect {
    background: #fee2e2;
    color: #b91c1c;
    border: 2px solid #b91c1c;
  }
  .answer {
    display: none;
    margin-top: 20px;
    padding: 12px;
    background: #dcfce7;
    color: #15803d;
    border-radius: 8px;
  }
  .answer.visible {
    display: block;
  }
  .explanation {
    display: none;
    margin-top: 15px;
    padding: 15px;
    background: #f8fafc;
    border-radius: 8px;
    border-left: 4px solid #1e40af;
  }
  .explanation.visible {
    display: block;
  }
</style>
</head>
<body>
  <div class="quiz">
    <h1>📚 Practice Quiz</h1>
    ${questions.map((q, index) => {
      if (!q || !q.question || !q.options || !q.answer) {
        console.error(`Invalid question at index ${index}:`, q);
        return '';
      }
      return `
        <div id="question-${index}" class="question">
          <div class="question-header">Question ${index + 1}</div>
          <div class="question-text">${q.question}</div>
          <div class="options">
            ${q.options.map(opt => `
              <div class="option" 
                data-question="${index}"
                data-selected="${opt.replace(/"/g, '&quot;')}"
                data-answer="${q.answer.replace(/"/g, '&quot;')}"
                onclick="(function(e) {
                  try {
                    const element = e.currentTarget;
                    const questionIndex = element.getAttribute('data-question');
                    const selectedOption = element.getAttribute('data-selected');
                    const correctAnswer = element.getAttribute('data-answer');
                    
                    const questionDiv = document.getElementById('question-' + questionIndex);
                    if (!questionDiv) return;
                    
                    const options = questionDiv.getElementsByClassName('option');
                    const answer = questionDiv.getElementsByClassName('answer')[0];
                    const explanation = questionDiv.getElementsByClassName('explanation')[0];
                    
                    Array.from(options).forEach(opt => {
                      opt.classList.remove('correct', 'incorrect');
                    });
                    
                    if (selectedOption === correctAnswer) {
                      element.classList.add('correct');
                    } else {
                      element.classList.add('incorrect');
                      const correctOption = Array.from(options).find(opt => 
                        opt.getAttribute('data-selected') === correctAnswer
                      );
                      if (correctOption) {
                        correctOption.classList.add('correct');
                      }
                    }
                    
                    if (answer) answer.classList.add('visible');
                    if (explanation) explanation.classList.add('visible');
                  } catch (err) {
                    console.error('Error handling quiz option click:', err);
                  }
                })(event)"
              >${opt}</div>
            `).join('')}
          </div>
          <div class="answer">✓ Correct Answer: ${q.answer}</div>
          ${q.explanation ? `
            <div class="explanation">
              <strong>Explanation:</strong><br/>
              ${q.explanation}
            </div>
          ` : ''}
        </div>
      `;
    }).filter(Boolean).join('')}
  </div>
</body>
</html>`;

        // Set response headers
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 'no-store');

        return res.status(200).json({
          success: true,
          content: content,
          type: 'quiz',
          truncated: false
        });

      } catch (error) {
        console.error('Quiz generation error:', error);
        throw new Error('Failed to generate quiz. Please try with a shorter text or fewer questions.');
      }
    } else if (materialType === 'study_guide') {
      console.log('Starting study guide generation...');
      const studyGuideTool = new StudyGuideTool(process.env.OPENAI_API_KEY!);
      
      try {
        // Break content into smaller chunks
        const maxChunkSize = 3000; // Even smaller chunks for faster processing
        const chunks = [];
        
        // Split content into smaller pieces
        for (let i = 0; i < mainContent.length; i += maxChunkSize) {
          chunks.push(mainContent.slice(i, i + maxChunkSize));
        }

        // Process all chunks in parallel
        console.log(`Processing ${chunks.length} chunks in parallel...`);
        const guideChunks = await Promise.all(
          chunks.map(chunk => 
            studyGuideTool.generateStudyGuide({
              text: chunk,
              complexity: complexity || 'intermediate',
            }).catch(error => {
              console.error('Error processing chunk:', error);
              return null;
            })
          )
        );

        // Filter out failed chunks and combine results
        const guideSection = guideChunks
          .filter(Boolean)
          .join('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');

        if (!guideSection) {
          throw new Error('Failed to generate any content. Please try with a shorter text.');
        }

        // Format the combined guide sections into HTML
        content = `
<!DOCTYPE html>
<html>
<head>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@500;600;700&display=swap');
  
  body {
    font-family: 'Inter', sans-serif;
    line-height: 1.8;
    max-width: 800px;
    margin: 40px auto;
    padding: 20px;
    color: #333;
    background: #f5f7fb;
  }
  .study-guide {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.07);
    padding: 40px;
  }
  h1 {
    font-family: 'Poppins', sans-serif;
    text-align: center;
    color: #1e40af;
    margin-bottom: 30px;
    font-size: 2em;
  }
  .section {
    margin-bottom: 40px;
  }
  .section:last-child {
    margin-bottom: 0;
  }
  .section-title {
    font-family: 'Poppins', sans-serif;
    color: #1e40af;
    font-size: 1.8em;
    font-weight: 600;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid #e5e7eb;
  }
  .content {
    font-family: 'Inter', sans-serif;
    font-size: 1.05em;
    padding-left: 25px;
    margin-top: 15px;
  }
  .content-item {
    margin-bottom: 12px;
    line-height: 1.6;
  }
  .divider {
    margin: 30px 0;
    border: none;
    border-top: 2px solid #e5e7eb;
  }
</style>
</head>
<body>
  <div class="study-guide">
    <h1>📚 Study Guide</h1>
    
    <div class="section">
      <div class="section-title">📌 Main Ideas & Themes</div>
      <div class="content">
        ${guideSection
          .split('MAIN IDEAS & THEMES')[1]
          ?.split('IMPORTANT DETAILS')[0]
          ?.trim()
          .split('\n')
          .filter(line => line.trim())
          .map(line => `<div class="content-item">${line.trim()}</div>`)
          .join('\n')}
      </div>
    </div>

    <div class="divider"></div>

    <div class="section">
      <div class="section-title">💡 Important Details</div>
      <div class="content">
        ${guideSection
          .split('IMPORTANT DETAILS')[1]
          ?.split('EXAMPLES & APPLICATIONS')[0]
          ?.trim()
          .split('\n')
          .filter(line => line.trim())
          .map(line => `<div class="content-item">${line.trim()}</div>`)
          .join('\n')}
      </div>
    </div>

    <div class="divider"></div>

    <div class="section">
      <div class="section-title">📝 Examples & Applications</div>
      <div class="content">
        ${guideSection
          .split('EXAMPLES & APPLICATIONS')[1]
          ?.split('REVIEW QUESTIONS')[0]
          ?.trim()
          .split('\n')
          .filter(line => line.trim())
          .map(line => `<div class="content-item">${line.trim()}</div>`)
          .join('\n')}
      </div>
    </div>

    <div class="divider"></div>

    <div class="section">
      <div class="section-title">❓ Review Questions</div>
      <div class="content">
        ${guideSection
          .split('REVIEW QUESTIONS')[1]
          ?.split('SUMMARY POINTS')[0]
          ?.trim()
          .split('\n')
          .filter(line => line.trim())
          .map(line => `<div class="content-item">${line.trim()}</div>`)
          .join('\n')}
      </div>
    </div>

    <div class="divider"></div>

    <div class="section">
      <div class="section-title">📌 Summary Points</div>
      <div class="content">
        ${guideSection
          .split('SUMMARY POINTS')[1]
          ?.trim()
          .split('\n')
          .filter(line => line.trim())
          .map(line => `<div class="content-item">${line.trim()}</div>`)
          .join('\n')}
      </div>
    </div>
  </div>
</body>
</html>`;

      } catch (error) {
        console.error('Study guide generation error:', error);
        throw new Error('Failed to generate study guide. Please try with a shorter text or in multiple parts.');
      }

    } else {
      // For other types, use first chunk of mainContent
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful study assistant that creates study materials from documents."
          },
          {
            role: "user",
            content: generatePrompt(textChunks[0], materialType, numberOfQuestions)
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });
      
      content = response.choices[0]?.message?.content || '';
    }

    if (!content) {
      throw new Error('No content generated');
    }

    // First, set HTML content type for all responses
    res.setHeader('Content-Type', 'text/html');

    return res.status(200).json({
      success: true,
      content: content,
      truncated: cleanedText.length > 4000
    });

  } catch (processingError: any) {
    // Enhanced error logging
    console.error('Processing error details:', {
      message: processingError.message,
      name: processingError.name,
      stack: processingError.stack,
      cause: processingError.cause,
      type: processingError.type
    });
    
    // Check if it's an OpenAI API error
    if (processingError.response?.data) {
      console.error('OpenAI API error:', processingError.response.data);
    }
    
    return res.status(500).json({
      success: false,
      error: `Error processing document: ${processingError.message}`,
      details: process.env.NODE_ENV === 'development' ? processingError.stack : undefined
    });
  }
}

function generatePrompt(text: string, type: string, numberOfQuestions?: number): string {
  switch (type) {
    case 'summary':
      return `Create a concise summary of the following text:\n\n${text}`;
    case 'study_guide':
      return `Create a detailed study guide from the following text. Include key concepts, definitions, and important points:\n\n${text}`;
    default:
      return `Summarize the following text:\n\n${text}`;
  }
}