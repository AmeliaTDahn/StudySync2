import OpenAI from 'openai';

interface ContentBoundaryResponse {
  mainContent: string;
  trimmedContent: string | null;
  confidence: number;
  reason?: string;
}

export class ContentBoundaryDetector {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }

  async detectMainContent(text: string): Promise<ContentBoundaryResponse> {
    // Try pattern matching first for speed
    const patternIndex = this.detectCommonPatterns(text);
    if (patternIndex !== -1) {
      return {
        mainContent: text.slice(0, patternIndex).trim(),
        trimmedContent: text.slice(patternIndex).trim(),
        confidence: 0.9,
        reason: 'Found clear ending pattern'
      };
    }

    // Only use AI if patterns don't match
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo", // Use faster model
        messages: [
          {
            role: "system",
            content: `You are a content analyzer that precisely identifies where the main article content ends and 
            supplementary content begins. Look for these clear ending signals:

            FORMAT CHANGE INDICATORS:
            - Transition from paragraphs to bullet points
            - Sudden appearance of multiple short headings
            - Switch from narrative to list format
            - Change in text density or paragraph structure
            - Appearance of metadata-style content

            CONTENT ENDING MARKERS:
            - Conclusive statements followed by symbols like "♦" or "###"
            - Author bylines or biographical notes
            - "Read more" or "Related articles" sections
            - Newsletter signups or promotional content
            - Social media sharing sections
            - Lists of other article titles
            - Comment sections
            
            STRUCTURAL HINTS:
            - Main content has consistent paragraph formatting
            - Article usually ends with a clear concluding statement
            - Supplementary content has different formatting
            - Watch for abrupt style/density changes
            
            Return a JSON object with:
            - endIndex: the character index where the main article's natural conclusion occurs
            - confidence: 0-1 score
            - reason: explain the exact format or content change that signals the end`
          },
          {
            role: "user",
            content: text
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      return {
        mainContent: text.slice(0, result.endIndex).trim(),
        trimmedContent: text.slice(result.endIndex).trim(),
        confidence: result.confidence,
        reason: result.reason
      };
    } catch (error) {
      console.error('Error detecting content boundary:', error);
      // Fallback to pattern matching if API fails
      const fallbackIndex = this.detectCommonPatterns(text);
      return {
        mainContent: fallbackIndex !== -1 ? text.slice(0, fallbackIndex).trim() : text,
        trimmedContent: fallbackIndex !== -1 ? text.slice(fallbackIndex).trim() : null,
        confidence: 0.5,
        reason: 'Fallback to pattern matching due to API error'
      };
    }
  }

  private detectCommonPatterns(text: string): number {
    const patterns = [
      // Format change patterns
      /^[\s\n]*[•\-\*]\s/m,  // Sudden bullet points
      /(?:\n\n|\r\n\r\n)#{1,3}\s/m,  // Multiple short headings
      /♦\s*\n/,  // Common article end marker
      
      // Common ending phrases
      /New Yorker Favorites/i,
      /Read More/i,
      /Related Articles/i,
      /More from/i,
      /Sign up for our newsletter/i,
      /Share this article/i,
      /Follow us on/i,
      /About the Author/i,
      /\w+ is a staff writer/i,
      /Originally published/i,
      
      // Social and engagement patterns
      /Comments\s*$/im,
      /Sign up for our daily newsletter/i,
      /Subscribe now/i,
      /Your Privacy Choices/i
    ];

    let earliestIndex = text.length;
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match.index !== undefined && match.index < earliestIndex) {
        earliestIndex = match.index;
      }
    }

    // Also check for format changes
    const formatChangeIndex = this.detectFormatChange(text);
    if (formatChangeIndex !== -1 && formatChangeIndex < earliestIndex) {
      earliestIndex = formatChangeIndex;
    }

    return earliestIndex === text.length ? -1 : earliestIndex;
  }

  private detectFormatChange(text: string): number {
    // Split text into lines
    const lines = text.split('\n');
    let consecutiveShortLines = 0;
    let consecutiveHeadings = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for sudden change to short lines
      if (line.length < 50 && line.length > 0) {
        consecutiveShortLines++;
        if (consecutiveShortLines >= 3) {
          return lines.slice(0, i - 2).join('\n').length;
        }
      } else {
        consecutiveShortLines = 0;
      }

      // Check for sudden increase in headings
      if (line.match(/^[A-Z][^.!?]*$/) && line.length < 100) {
        consecutiveHeadings++;
        if (consecutiveHeadings >= 2) {
          return lines.slice(0, i - 1).join('\n').length;
        }
      } else {
        consecutiveHeadings = 0;
      }
    }

    return -1;
  }
} 