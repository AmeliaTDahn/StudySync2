import mammoth from 'mammoth';
import { getDocument, GlobalWorkerOptions, version } from 'pdfjs-dist';

// Dynamically import PDF.js worker
if (typeof window !== 'undefined') {
  // Use a dynamic import for the worker
  import('pdfjs-dist/build/pdf.worker.entry');
  GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
}

export async function parseDocument(file: File): Promise<string> {
  try {
    // For text files
    if (file.type === 'text/plain') {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
      });
    }
    
    // For PDF files
    if (file.type === 'application/pdf') {
      try {
        // Convert file to Uint8Array
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Load the PDF
        const loadingTask = getDocument({ data: uint8Array });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        
        // Extract text from each page
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          fullText += pageText + '\n\n'; // Add extra newline between pages
        }
        
        return fullText.trim();
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        throw new Error('Unable to parse PDF file');
      }
    }
    
    // For DOCX files
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ 
        arrayBuffer: buffer,
        includeDefaultStyleMap: true
      });
      return result.value;
    }
    
    throw new Error('Unsupported file type');
  } catch (error) {
    console.error('Error parsing document:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to parse document: ${error.message}`);
    }
    throw new Error('Failed to parse document');
  }
} 