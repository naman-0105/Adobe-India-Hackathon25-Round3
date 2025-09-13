import { useState, useCallback } from "react";
import { PDFStructure } from "@/components/PDFHeadingsSidebar";

interface UseHeadingsExtractionReturn {
  structure: PDFStructure | null;
  isLoading: boolean;
  error: string | null;
  extractHeadings: (file: File) => Promise<PDFStructure | null>;
  clearError: () => void;
}
export function useHeadingsExtraction(): UseHeadingsExtractionReturn {
  const [structure, setStructure] = useState<PDFStructure | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractHeadings = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("pdf", file);

      const response = await fetch("http://localhost:3001/api/extract-headings", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to extract headings");
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setStructure(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setStructure(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    structure,
    isLoading,
    error,
    extractHeadings,
    clearError,
  };
}
