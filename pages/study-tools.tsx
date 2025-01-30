import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { User } from '@supabase/supabase-js';
import { supabase, getProfile, type Profile } from '../lib/supabase';
import { DocumentAgent } from '../lib/agents';
import type { DocumentProcessingMode } from '../lib/agents/document-agent';
import { Upload } from 'lucide-react';
import { parseDocument } from '../lib/document-parser';
import { testLangSmithConnection } from '../lib/test_langchain';
import { Client } from "langsmith";

// Add supported file types
const SUPPORTED_FILES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt'
};

// Increase max content length to handle larger documents
const MAX_CONTENT_LENGTH = 500000; // Increased from 50000 to 500000 characters

// Move LangSmith client initialization outside component
const langsmith = new Client({
  apiUrl: process.env.NEXT_PUBLIC_LANGCHAIN_ENDPOINT || "https://api.smith.langchain.com",
  apiKey: process.env.NEXT_PUBLIC_LANGCHAIN_API_KEY
});

export default function StudyTools() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [uploadedContent, setUploadedContent] = useState<string>(''); // For AI processing
  const [mode, setMode] = useState<DocumentProcessingMode>('summary');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data: profileData } = await getProfile(user.id);
        if (profileData) {
          setProfile(profileData);
          // Redirect tutors away from this page
          if (profileData.user_type === 'tutor') {
            router.push('/tutor');
          }
        }
      } else {
        router.push('/signin');
      }
    };

    checkUser();
  }, []);

  const handleProcess = async () => {
    if (!uploadedContent) {
      setError('Please upload a document to process');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const agent = new DocumentAgent();
      await agent.initialize();
      
      // Process in chunks if content is long
      const response = await agent.processDocument(uploadedContent, mode);
      
      if (response.success && response.result) {
        setResult(response.result);
      } else {
        setError(response.error || 'Failed to process document');
      }
    } catch (err) {
      console.error('Processing error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during processing');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!Object.keys(SUPPORTED_FILES).includes(file.type)) {
      setError('Unsupported file type. Please upload a PDF, DOCX, or TXT file.');
      return;
    }

    // Increased file size limit to 20MB
    if (file.size > 20 * 1024 * 1024) {
      setError('File is too large. Maximum size is 20MB.');
      return;
    }

    setLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      const text = await parseDocument(file);

      // Remove the content length check since we're using chunking
      setUploadedContent(text);
    } catch (err) {
      setError('Failed to read file content. Please try a different file.');
      console.error('File reading error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInputRef.current.files = dataTransfer.files;
      handleFileUpload({ target: { files: dataTransfer.files } } as any);
    }
  };

  const handleTestLangSmith = async () => {
    try {
      const result = await testLangSmithConnection();
      if (result.success) {
        alert("LangSmith connection successful! Check console for details.");
      } else {
        alert("LangSmith connection failed. Check console for error details.");
      }
    } catch (error) {
      console.error("Error testing LangSmith:", error);
      alert("Error testing LangSmith connection");
    }
  };

  // Add a loading indicator component
  const LoadingSpinner = () => (
    <div className="flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">Study Tools</h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/student')}
              className="text-blue-600 hover:text-blue-800"
            >
              Back to Dashboard
            </button>
            <span className="text-gray-600">
              {profile?.username || user?.email}
            </span>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Processing Mode
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as DocumentProcessingMode)}
              className="w-full p-2 border rounded-md"
            >
              <option value="summary">Summary</option>
              <option value="study_guide">Study Guide</option>
              <option value="practice_quiz">Practice Quiz</option>
            </select>
          </div>

          <div
            className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center ${
              loading ? 'opacity-50' : ''
            }`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept={Object.values(SUPPORTED_FILES).join(',')}
              className="hidden"
              disabled={loading}
            />
            <div className="space-y-2">
              {loading ? (
                <LoadingSpinner />
              ) : (
                <>
                  <Upload className="w-12 h-12 mx-auto text-gray-400" />
                  <div className="flex flex-col items-center text-gray-600">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                      disabled={loading}
                    >
                      Click to upload
                    </button>
                    <span className="text-sm">or drag and drop</span>
                    <span className="text-sm text-gray-500">
                      PDF, DOCX, or TXT files (max 20MB)
                    </span>
                  </div>
                </>
              )}
              {fileName && !loading && (
                <div className="mt-2 text-sm text-gray-600">
                  Selected file: {fileName}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}

          <button
            onClick={handleProcess}
            disabled={loading || !uploadedContent}
            className={`w-full py-2 px-4 rounded-md text-white ${
              loading || !uploadedContent
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Processing...' : 'Process Document'}
          </button>

          {result && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-2">Result</h2>
              <div className="p-4 bg-gray-50 rounded-md whitespace-pre-wrap">
                {result}
              </div>
            </div>
          )}

          <div className="mt-4">
            <button
              onClick={handleTestLangSmith}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Test LangSmith Connection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 