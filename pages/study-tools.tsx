import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/auth';
import { studyAgent } from '../lib/agents';
import { StudyMaterialType } from '../lib/agents';
import type { SummaryComplexity } from '../lib/tools/summarization-tool';
import { extractTextFromFile } from '../lib/utils/document-parser';
import { QuestionFormat, SkillLevel } from '../lib/tools/question-generation-tool';
import { DifficultyAdjusterTool } from '../lib/tools/difficulty-adjuster-tool';

export default function StudyTools() {
  const { user, profile, loading } = useAuth();
  const [documentText, setDocumentText] = useState('');
  const [materialType, setMaterialType] = useState<StudyMaterialType>('summary');
  const [complexity, setComplexity] = useState<SummaryComplexity>('intermediate');
  const [subject, setSubject] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [questionFormat, setQuestionFormat] = useState<QuestionFormat>('MCQ');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('INTERMEDIATE');
  const [numberOfQuestions, setNumberOfQuestions] = useState(5);

  useEffect(() => {
    // Initialize the study agent
    studyAgent.initialize();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const text = await extractTextFromFile(file);
      
      // Clean up the text
      const cleanedText = text
        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
        .trim();               // Remove leading/trailing whitespace
      
      if (!cleanedText) {
        throw new Error('No readable text found in document');
      }
      
      setDocumentText(cleanedText);
    } catch (err: any) {
      setError(err.message || 'Error reading file');
      console.error('File processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setError(null);
    setResult(null);

    // Add logging
    console.log('Submitting with params:', {
      materialType,
      numberOfQuestions,
      questionFormat,
      skillLevel
    });

    try {
      const response = await studyAgent.generateStudyMaterial({
        documentText,
        materialType,
        subject,
        complexity,
        questionFormat,
        skillLevel,
        numberOfQuestions: Number(numberOfQuestions) // Here's where the number is passed
      });

      if (response.success) {
        setResult(response.content);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Error processing document');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  
  if (!user) {
    return <div>Please sign in to access study tools</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Study Tools</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Upload Document
          </label>
          <input
            type="file"
            onChange={handleFileUpload}
            accept=".pdf,.txt"  // Only allow PDF and text files
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
          <p className="mt-1 text-sm text-gray-500">
            Supported formats: PDF, TXT
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Material Type
          </label>
          <select
            value={materialType}
            onChange={(e) => setMaterialType(e.target.value as StudyMaterialType)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          >
            <option value="summary">Summary</option>
            <option value="study_guide">Study Guide</option>
            <option value="practice_quiz">Practice Quiz</option>
          </select>
        </div>

        {materialType === 'summary' && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Complexity Level
            </label>
            <select
              value={complexity}
              onChange={(e) => setComplexity(e.target.value as SummaryComplexity)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">
            Subject (Optional)
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
            placeholder="e.g., Biology, History, Mathematics"
          />
        </div>

        {materialType === 'practice_quiz' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">
                Question Format
              </label>
              <select
                value={questionFormat}
                onChange={(e) => setQuestionFormat(e.target.value as QuestionFormat)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              >
                <option value="MCQ">Multiple Choice</option>
                <option value="OPEN_ENDED">Open Ended</option>
                <option value="FILL_IN_THE_BLANK">Fill in the Blank</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Difficulty Level
              </label>
              <select
                value={skillLevel}
                onChange={(e) => setSkillLevel(e.target.value as SkillLevel)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              >
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">
                {skillLevel === 'BEGINNER' && "Simple language with everyday examples"}
                {skillLevel === 'INTERMEDIATE' && "Balanced technical and practical content"}
                {skillLevel === 'ADVANCED' && "In-depth analysis with field-specific terms"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Number of Questions
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={numberOfQuestions}
                onChange={(e) => setNumberOfQuestions(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={isProcessing || !documentText}
          className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
            ${isProcessing || !documentText 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isProcessing ? 'Processing...' : 'Generate Study Material'}
        </button>
      </form>

      {isProcessing && (
        <div className="mt-4 p-4 bg-blue-50 text-blue-700 rounded-md">
          Processing document...
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-white shadow rounded-lg">
          <pre className="whitespace-pre-wrap">{result}</pre>
        </div>
      )}
    </div>
  );
} 