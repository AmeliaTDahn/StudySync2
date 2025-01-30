import OpenAI from 'openai';
import { SkillLevel } from './question-generation-tool';

export interface StudyGuideParams {
  text: string;
  subject?: string;
  skillLevel?: SkillLevel;
}

export class StudyGuideTool {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  async generateStudyGuide({
    text,
    subject,
    skillLevel = 'INTERMEDIATE'
  }: StudyGuideParams): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an expert study guide creator. Create a well-structured study guide following this exact format:

              📚 STUDY GUIDE ${skillLevel} LEVEL
              ${subject ? `Subject: ${subject}\n` : ''}
              ──────────────────────────────

              🎯 KEY CONCEPTS
              • [Concept 1]: [Clear definition]
              • [Concept 2]: [Clear definition]
              ...

              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

              📌 MAIN IDEAS & THEMES
              1. [Main idea 1]
                 • Supporting point
                 • Supporting point
              2. [Main idea 2]
                 • Supporting point
                 • Supporting point
              ...

              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

              💡 IMPORTANT DETAILS
              • [Detail 1 with explanation]
              • [Detail 2 with explanation]
              ...

              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

              📝 EXAMPLES & APPLICATIONS
              1. [Example 1]
                 • Context: [brief context]
                 • Application: [how it's used]
              2. [Example 2]
                 • Context: [brief context]
                 • Application: [how it's used]
              ...

              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

              ❓ REVIEW QUESTIONS
              1. [Question 1]
                 • Answer: [Concise answer]
              2. [Question 2]
                 • Answer: [Concise answer]
              ...

              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

              📌 SUMMARY POINTS
              • [Key takeaway 1]
              • [Key takeaway 2]
              ...

              Use this exact structure with emojis, separators, and formatting.
              Make the content clear, concise, and easy to read.
              Include the separator lines (━━━) between each main section.
              Adapt language complexity to ${skillLevel} level.`
          },
          {
            role: "user",
            content: `Create a detailed study guide from this text, following the exact format specified:

              ${text}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content generated');
      }

      // Add extra formatting to the content
      const formattedContent = `
╔════════════════════════════════════════════════════════════════
${content.split('\n').map(line => {
  const trimmedLine = line.trim();
  if (trimmedLine.startsWith('•')) {
    // For bullet points, add 2 spaces after the border
    return `║  ${trimmedLine}`;
  } else if (/^\d+\./.test(trimmedLine)) {
    // For numbered items, add 1 space after the border
    return `║ ${trimmedLine}`;
  } else if (trimmedLine.startsWith('─') || trimmedLine.startsWith('━')) {
    // For separator lines, no extra space
    return `║${trimmedLine}`;
  } else {
    // For regular lines, add 1 space after the border
    return `║ ${trimmedLine}`;
  }
}).join('\n')}
╚════════════════════════════════════════════════════════════════
`.trim();

      return formattedContent;
    } catch (error) {
      console.error('Error generating study guide:', error);
      throw error;
    }
  }
} 