import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export const createDocumentChunkingTool = () => {
  return new DynamicStructuredTool({
    name: "chunk_and_retrieve",
    description: "Split a document into relevant chunks based on a query",
    schema: z.object({
      content: z.string().describe("The document content to chunk"),
      query: z.string().describe("The query to determine relevant chunks"),
      chunkSize: z.number().optional().default(1000).describe("Size of each chunk"),
      overlap: z.number().optional().default(200).describe("Overlap between chunks")
    }),
    func: async ({ content, query, chunkSize = 1000, overlap = 200 }) => {
      try {
        console.log('Chunking document of length:', content.length);
        
        const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: chunkSize,
          chunkOverlap: overlap,
          separators: ["\n\n", "\n", ". ", " "],
          lengthFunction: (text) => text.length,
        });

        const docs = await textSplitter.createDocuments([content]);
        console.log(`Created ${docs.length} chunks`);

        const relevantText = docs
          .map(doc => doc.pageContent.trim())
          .filter(chunk => chunk.length > 0)
          .join("\n\n");

        return {
          relevantText,
          metadata: {
            originalLength: content.length,
            chunks: docs.length,
            averageChunkSize: Math.round(relevantText.length / docs.length)
          }
        };
      } catch (error) {
        console.error('Error in document chunking:', error);
        throw new Error('Failed to chunk document: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  });
}; 