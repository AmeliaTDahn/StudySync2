import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/auth';
import { studyAgent } from '../lib/agents';
import { StudyMaterialType } from '../lib/agents';

export default function StudyTools() {
  const { user, profile, loading } = useAuth();
  const [documentText, setDocumentText] = useState('');
  const [materialType, setMaterialType] = useState<StudyMaterialType>('summary');
  const [subject, setSubject] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize the study agent
    studyAgent.initialize();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setDocumentText(text);
    } catch (err) {
      setError('Error reading file');
      console.error(err);
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
        subject,
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
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Study Tools</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Upload Document
            <input
              type="file"
              accept=".txt,.doc,.docx,.pdf"
              onChange={handleFileUpload}
              className="mt-1 block w-full"
            />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Material Type
            <select
              value={materialType}
              onChange={(e) => setMaterialType(e.target.value as StudyMaterialType)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            >
              <option value="summary">Summary</option>
              <option value="study_guide">Study Guide</option>
              <option value="practice_quiz">Practice Quiz</option>
            </select>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Subject (optional)
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              placeholder="e.g., Biology, History, etc."
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={!documentText || isProcessing}
          className={`px-4 py-2 rounded-md text-white ${
            !documentText || isProcessing
              ? 'bg-gray-400'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isProcessing ? 'Processing...' : 'Generate Study Material'}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Generated Content:</h2>
          <div className="bg-white p-6 rounded-lg shadow whitespace-pre-wrap">
            {result}
          </div>
        </div>
      )}
    </div>
  );
} 