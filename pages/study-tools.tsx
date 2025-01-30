import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/auth';
import { studyAgent } from '../lib/agents';
import { StudyMaterialType } from '../lib/agents';
import type { SummaryComplexity } from '../lib/tools/summarization-tool';
import { extractTextFromFile } from '../lib/utils/document-parser';
import { QuestionFormat, SkillLevel } from '../lib/tools/question-generation-tool';
import { DifficultyAdjusterTool } from '../lib/tools/difficulty-adjuster-tool';
import Link from 'next/link';
import { StudyMaterialResponse } from '../lib/agents';

export default function StudyTools() {
  const { user, profile, loading } = useAuth();
  const [documentText, setDocumentText] = useState('');
  const [materialType, setMaterialType] = useState<StudyMaterialType>('summary');
  const [complexity, setComplexity] = useState<SummaryComplexity>('intermediate');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('INTERMEDIATE');
  const [numberOfQuestions, setNumberOfQuestions] = useState(10);

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

    try {
      const response = await studyAgent.generateStudyMaterial({
        documentText,
        materialType,
        complexity,
        questionFormat: 'MCQ',
        skillLevel,
        numberOfQuestions: 10
      });

      if (response.success && response.content) {
        setResult(response.content);
      } else {
        throw new Error('Failed to generate study material');
      }
    } catch (err: any) {
      setError(err.message || 'Error generating study material');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadStudyMaterial = () => {
    if (!result) return;

    // Create file content based on material type
    const fileName = `study_material_${materialType}_${new Date().toISOString().split('T')[0]}.txt`;
    
    // Create blob and download
    const blob = new Blob([result], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (loading) return <div>Loading...</div>;
  
  if (!user) {
    return <div>Please sign in to access study tools</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Study Tools</h1>
          <Link 
            href="/dashboard" 
            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5 mr-2" 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path 
                fillRule="evenodd" 
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" 
                clipRule="evenodd" 
              />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* File Upload Section */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Document
                </label>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept=".pdf,.txt"
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100
                    transition-all"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Supported formats: PDF, TXT
                </p>
              </div>

              {/* Material Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Material Type
                </label>
                <select
                  value={materialType}
                  onChange={(e) => setMaterialType(e.target.value as StudyMaterialType)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm 
                    focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="summary">Summary</option>
                  <option value="study_guide">Study Guide</option>
                  <option value="practice_quiz">Practice Quiz</option>
                </select>
              </div>

              {/* Conditional Sections */}
              {materialType === 'summary' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Complexity Level
                  </label>
                  <select
                    value={complexity}
                    onChange={(e) => setComplexity(e.target.value as SummaryComplexity)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm 
                      focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              )}

              {materialType === 'practice_quiz' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Difficulty Level
                    </label>
                    <select
                      value={skillLevel}
                      onChange={(e) => setSkillLevel(e.target.value as SkillLevel)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm 
                        focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value="BEGINNER">Beginner</option>
                      <option value="INTERMEDIATE">Intermediate</option>
                      <option value="ADVANCED">Advanced</option>
                    </select>
                    <p className="mt-2 text-sm text-gray-500">
                      {skillLevel === 'BEGINNER' && "Simple language with everyday examples"}
                      {skillLevel === 'INTERMEDIATE' && "Balanced technical and practical content"}
                      {skillLevel === 'ADVANCED' && "In-depth analysis with field-specific terms"}
                    </p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isProcessing || !documentText}
                className={`w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                  transition-colors
                  ${isProcessing || !documentText 
                    ? 'bg-gray-300 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {isProcessing ? 'Processing...' : 'Generate Study Material'}
              </button>
            </form>
          </div>
        </div>

        {/* Status Messages */}
        {isProcessing && (
          <div className="mt-6 p-4 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
            <div className="flex items-center">
              <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              Processing document...
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
            {error}
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="mt-6 space-y-4">
            <div className="flex justify-end">
              <button
                onClick={downloadStudyMaterial}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md 
                  hover:bg-green-700 transition-colors"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5 mr-2" 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" 
                    clipRule="evenodd" 
                  />
                </svg>
                Download Study Material
              </button>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <pre className="whitespace-pre-wrap text-gray-800">{result}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 