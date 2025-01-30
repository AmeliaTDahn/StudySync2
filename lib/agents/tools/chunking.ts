import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";

export class DocumentChunker {
  private splitter: RecursiveCharacterTextSplitter;

  constructor() {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 2000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", " ", ""], // Order from most to least aggressive
    });
  }

  async splitDocument(text: string): Promise<Document[]> {
    try {
      return await this.splitter.createDocuments([text]);
    } catch (error) {
      console.error("Error splitting document:", error);
      throw error;
    }
  }

  async processChunksWithModel(
    chunks: Document[],
    processor: (chunk: string) => Promise<string>,
    combineStrategy: 'concatenate' | 'summarize' = 'concatenate'
  ): Promise<string> {
    try {
      // Process each chunk
      const processedChunks = await Promise.all(
        chunks.map(async (chunk, index) => {
          console.log(`Processing chunk ${index + 1}/${chunks.length}`);
          return await processor(chunk.pageContent);
        })
      );

      // Combine processed chunks based on strategy
      if (combineStrategy === 'concatenate') {
        return processedChunks.join('\n\n');
      } else {
        // For summarization, we might need to process the combined chunks again
        const combinedText = processedChunks.join('\n\n');
        return await processor(combinedText);
      }
    } catch (error) {
      console.error("Error processing chunks:", error);
      throw error;
    }
  }
} 