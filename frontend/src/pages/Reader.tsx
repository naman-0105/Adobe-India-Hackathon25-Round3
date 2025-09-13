import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import PDFViewerAdobe from "@/components/PDFViewerAdobe";
import PDFHeadingsSidebar from "@/components/PDFHeadingsSidebar";
import { type AdobeViewerSecondLevelAPIs } from "@/components/PDFViewerAdobe";
import { type PDFHeading, type PDFSection } from "@/components/PDFHeadingsSidebar";
import ChatWindow from "@/components/ChatWindow";
import PodcastPlayer from "@/components/PodcastPlayer";

import { getPdfBlob, getPdfMeta } from "@/utils/storage";
import { X } from "lucide-react";
import { type PDFStructure } from "@/components/PDFHeadingsSidebar";

interface HeadingsResponse extends PDFStructure { pdfFilename: string }

export default function Reader() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState<number | undefined>(
    undefined
  );
  const [apis, setApis] = useState<AdobeViewerSecondLevelAPIs | null>(null);
  const [activePage, setActivePage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addFileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingJump, setPendingJump] = useState<PDFSection | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState<string | undefined>(undefined);
  const [pdfFilename, setPdfFilename] = useState<string | undefined>(
    undefined
  );
  const [chatMode, setChatMode] = useState<"chat" | "insight">("chat");
  const [podcastScript, setPodcastScript] = useState<string | undefined>(undefined);
  const [podcastAudio, setPodcastAudio] = useState<string | undefined>(undefined);
  const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false);

  // Sections state for both manual and auto-fetched sections
  const [sections, setSections] = useState<PDFSection[]>([]);
  const [activeTab, setActiveTab] = useState<"Headings" | "Sections">("Headings");
  const [selectionStatus, setSelectionStatus] = useState<string>("");
  const [isDeepSearch, setIsDeepSearch] = useState(false); // Deep search state for text selection

  const cleanTextForSearch = (text: string): string => {
    // Remove bullet points
    let cleanedText = text.replace(/•/g, '');
    // Replace common ligatures (add more as needed)
    cleanedText = cleanedText.replace(/ﬀ/g, 'ff');
    cleanedText = cleanedText.replace(/ﬁ/g, 'fi');
    cleanedText = cleanedText.replace(/ﬂ/g, 'fl');
    // Normalize whitespace
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
    return cleanedText;
  };

  // Per-file extraction state
  const [structuresByName, setStructuresByName] = useState<Record<string, PDFStructure | null>>({});
  const [loadingByName, setLoadingByName] = useState<Record<string, boolean>>({});
  const [errorByName, setErrorByName] = useState<Record<string, string>>({});
  const [pdfFilenameByName, setPdfFilenameByName] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = "Reader | Intelligent PDF";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Open a PDF, get instant related sections, insights and podcast mode.",
      );
    }
  }, []);

  useEffect(() => {
    const id = params.get("id");
    if (id) {
      (async () => {
        const [blob, meta] = await Promise.all([
          getPdfBlob(id),
          getPdfMeta(id),
        ]);
        if (blob && meta) {
          const file = new File([blob], meta.name, { type: blob.type });
          setFiles([file]);
          setCurrentFileIndex(0);
        }
      })();
    }
  }, [params]);

  const currentFile =
    currentFileIndex !== undefined ? files[currentFileIndex] : undefined;

  const onJump = async (heading: PDFHeading) => {
    if (!apis) return;

    await apis.gotoLocation(heading.page + 1);

    apis.search(heading.text).catch((error) => {
      const errorMessage = String(error);
      console.error("Adobe search API error:", errorMessage); // Keep for debugging
    });
  };

  // Effect to handle pending jumps after APIs are ready
  useEffect(() => {
    if (apis && pendingJump) {
      (async () => {
        await apis.gotoLocation(pendingJump.page_number);
        console.log("Attempting to search for refined_text:", pendingJump.refined_text);

        const cleanedText = cleanTextForSearch(pendingJump.section_title);
        console.log("Cleaned text for search:", cleanedText);
        setTimeout(() => {
          apis.search(cleanedText).catch((error) => {
          console.error("Adobe search API error (pending jump):", error);
        });
          setPendingJump(null); // Clear the pending jump
        });
        })();
    }
  }, [apis, pendingJump]);

  // Helper to extract headings for a single file
  const extractHeadingsForFile = async (file: File): Promise<void> => {
    const fileName = file.name;
    if (loadingByName[fileName]) return;
    setLoadingByName((prev) => ({ ...prev, [fileName]: true }));
    setErrorByName((prev) => ({ ...prev, [fileName]: "" }));

    try {
      const formData = new FormData();
      formData.append("pdf", file);

      const response = await fetch("http://localhost:3001/api/extract-headings", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to extract headings");
      }
      const data: HeadingsResponse = await response.json();
      setStructuresByName((prev) => ({ ...prev, [fileName]: data }));
      if (data?.pdfFilename) {
        setPdfFilenameByName((prev) => ({ ...prev, [fileName]: data.pdfFilename }));
        if (currentFile && currentFile.name === fileName) {
          setPdfFilename(data.pdfFilename);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setErrorByName((prev) => ({ ...prev, [fileName]: message }));
      setStructuresByName((prev) => ({ ...prev, [fileName]: null }));
    } finally {
      setLoadingByName((prev) => ({ ...prev, [fileName]: false }));
    }
  };

  // Whenever files list changes, start extraction for any unprocessed files
  useEffect(() => {
    if (files.length === 0) return;
    const toProcess = files.filter((f) => structuresByName[f.name] === undefined && !loadingByName[f.name]);
    toProcess.forEach((f) => { void extractHeadingsForFile(f); });
  }, [files]);

  // Keep pdfFilename in sync with the current file
  useEffect(() => {
    if (!currentFile) return;
    const mapped = pdfFilenameByName[currentFile.name];
    if (mapped) setPdfFilename(mapped);
  }, [currentFile, pdfFilenameByName]);

  // Handle text selection from PDF viewer
  const handleTextSelection = async (selectedText: string) => {
    console.log("handleTextSelection called with:", selectedText);
    if (!currentFile || !selectedText.trim()) {
      console.log("No current file or empty text, returning");
      return;
    }
    
    console.log("Starting text selection processing...");
    setSelectionStatus("Searching for relevant sections...");
    
    // Auto-fetch sections using selected text as job and "search" as persona
    const formData = new FormData();
    formData.append("persona", "search");
    formData.append("job", selectedText.trim());
    formData.append("deepSearch", String(isDeepSearch)); // Include deep search state
    formData.append("pdfs", currentFile);

    try {
      console.log("Sending request to extract sections...");
      const response = await fetch(
        "http://localhost:3001/api/extract-sections",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch sections");
      }

      const data = await response.json();
      console.log("Sections response:", data);
      setSections(data.sections || []); // Update the sections state with the new results
      setActiveTab("Sections"); // Switch to Sections tab to show results
      setSelectionStatus(`Found ${data.sections?.length || 0} relevant sections${isDeepSearch ? ' (Deep Search)' : ''}`);
      
      // Clear status after 3 seconds
      setTimeout(() => setSelectionStatus(""), 3000);
    } catch (error) {
      console.error("Error fetching sections for selected text:", error);
      setSelectionStatus("Error fetching sections");
      setTimeout(() => setSelectionStatus(""), 3000);
    }
  };

  const handleHeadingClick = (heading: PDFHeading) => {
    onJump(heading);
  };

  const handleSectionClick = async (section: PDFSection) => {
    const fileIndex = files.findIndex((f) => f.name === section.file_name);
    if (fileIndex !== -1) {
      if (fileIndex !== currentFileIndex) {
        setCurrentFileIndex(fileIndex);
        setPendingJump(section); // Set the pending jump
      } else if (apis) {
        // If the file is already the current one, just jump
        await apis.gotoLocation(section.page_number);
        console.log("Attempting to search for refined_text (direct jump):", section.refined_text);
        const cleanedText = cleanTextForSearch(section.refined_text);
        console.log("Cleaned text for search (direct jump):", cleanedText);
        apis.search(cleanedText).catch((error) => {
          console.error("Adobe search API error (direct jump):", error);
        });
      }
    }
  };

  const handleOpenPdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = e.target.files;
    if (newFiles && newFiles.length > 0) {
      const arr = Array.from(newFiles);
      setFiles(arr);
      setCurrentFileIndex(0);
      // Auto-process all newly opened files
      arr.forEach((f) => { void extractHeadingsForFile(f); });
    }
  };

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = e.target.files;
    if (newFiles && newFiles.length > 0) {
      const newFilesArray = Array.from(newFiles);
      setFiles((prevFiles) => [...prevFiles, ...newFilesArray]);
      if (currentFileIndex === undefined) {
        setCurrentFileIndex(files.length);
      }
      // Auto-process all newly added files
      newFilesArray.forEach((f) => { void extractHeadingsForFile(f); });
    }
  };

  const handleGeneratePodcast = async () => {
    if (apis) {
      const selectedContent = await apis.getSelectedContent();
      if (selectedContent && ('data' in selectedContent || 'text' in selectedContent)) {
        const text = 'data' in selectedContent ? selectedContent.data : selectedContent.text;
        if (text) {
          setIsGeneratingPodcast(true);
          setPodcastScript(undefined);
          setPodcastAudio(undefined);

          try {
            const response = await fetch("http://localhost:3001/api/podcast-stream", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                pdfFilename,
                question: text,
              }),
            });

            if (!response.body) {
              throw new Error("Response body is null");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let script = "";
            let done = false;

            while (!done) {
              const { value, done: readerDone } = await reader.read();
              done = readerDone;
              const chunk = decoder.decode(value, { stream: true });

              const lines = chunk.split('\n\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const jsonString = line.substring(6);
                  if (jsonString.trim()) {
                    const data = JSON.parse(jsonString);
                    if (data.output_text) {
                      script += data.output_text;
                    }
                  }
                }
              }
            }

            if (script.includes("I cannot fulfill this request")) {
              console.error("Error generating podcast script: The model refused to generate a script.");
              setPodcastScript(undefined);
            } else {
              setPodcastScript(script);
            }
          } catch (error) {
            console.error("Error generating podcast script:", error);
          } finally {
            setIsGeneratingPodcast(false);
          }
        }
      }
    }
  };


  const getPodcastAudio = async (script: string) => {
    if (!script.trim()) {
      return;
    }

    // Helper function to escape characters that are invalid in SSML
    const sanitizeForSSML = (text: string) => {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    };

    const speakerAVoice = "en-US-DavisNeural";
    const speakerBVoice = "en-US-JennyNeural";

    const ssmlParts = script.split('\n').filter(line => line.trim()).map(line => {
      if (line.startsWith("Speaker A:")) {
        const text = line.substring("Speaker A:".length).trim();
        // Sanitize the text before inserting it into the voice tag
        return `<voice name='${speakerAVoice}'>${sanitizeForSSML(text)}</voice>`;
      }
      if (line.startsWith("Speaker B:")) {
        const text = line.substring("Speaker B:".length).trim();
        // Sanitize the text before inserting it into the voice tag
        return `<voice name='${speakerBVoice}'>${sanitizeForSSML(text)}</voice>`;
      }
      return ""; // Ignore any lines that don't match the format
    }).filter(part => part);

    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
                    ${ssmlParts.join(' ')}
                </speak>`;

    try {
      const response = await fetch("http://localhost:3001/api/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ssml }),
      });

      if (!response.ok) {
        const errorData = await response.json(); // Get the safe error message from our fixed backend
        throw new Error(`HTTP error! status: ${response.status} - ${errorData.detail}`);
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      setPodcastAudio(audioUrl);
    } catch (error) {
      console.error("Error getting podcast audio:", error);
    }
  };

  useEffect(() => {
    if (podcastScript) {
      getPodcastAudio(podcastScript);
    }
  }, [podcastScript]);

  const handleDeleteFile = (index: number) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
    if (currentFileIndex === index) {
      if (files.length > 1) {
        setCurrentFileIndex(0);
      } else {
        setCurrentFileIndex(undefined);
      }
    } else if (currentFileIndex && currentFileIndex > index) {
      setCurrentFileIndex(currentFileIndex - 1);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b sticky top-0 z-10 bg-background/80 backdrop-blur">
        <div className="container mx-auto py-3 flex items-center gap-3">
          <Link to="/" className="font-semibold">
            PDF Intelligence
          </Link>
          {selectionStatus && (
            <div className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
              {selectionStatus}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="hero"
              onClick={() => fileInputRef.current?.click()}
            >
              Open PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (apis) {
                  const selectedContent = await apis.getSelectedContent();
                  const text = selectedContent && ('data' in selectedContent ? selectedContent.data : selectedContent.text);
                  if (text) {
                    // Set the mode to 'insight' and provide the selected text as the initial query
                    setChatMode("insight"); 
                    setInitialQuery(text); // The query is now just the text, not the prompt + text
                    setIsChatOpen(true);
                  } else {
                    console.log("No text found in selection");
                  }
                }
              }}
            >
              Insights
            </Button>
            <Button variant="outline" size="sm" onClick={handleGeneratePodcast} disabled={isGeneratingPodcast}>
              {isGeneratingPodcast ? "Generating..." : "Podcast"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              multiple
              onChange={handleOpenPdf}
            />
            <input
              ref={addFileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              multiple
              onChange={handleAddFiles}
            />
          </div>
        </div>
      </header>

      <main className="grid grid-cols-12 gap-0">
        <div className="col-span-12 md:col-span-3 border-r">
          <div className="p-3 space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Uploaded Files</h3>
                <Button variant="outline" size="sm" onClick={() => addFileInputRef.current?.click()}>Add PDF</Button>
              </div>
              <ul>
                {files.map((f, index) => (
                  <li key={index} className="flex items-center justify-between">
                    <Button
                      variant={
                        index === currentFileIndex ? "secondary" : "ghost"
                      }
                      onClick={() => setCurrentFileIndex(index)}
                      className="flex-grow text-left justify-start"
                    >
                      {f.name}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteFile(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="col-span-12 md:col-span-6 h-[calc(100vh-56px)]">
          {currentFile ? (
            <PDFViewerAdobe
              file={currentFile}
              fileName={currentFile?.name}
              onApisReady={setApis}
              onPageChange={setActivePage}
              onTextSelection={handleTextSelection}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              Select a PDF to view
            </div>
          )}
        </div>
        <div className="col-span-12 md:col-span-3">
          <PDFHeadingsSidebar
            structure={currentFile ? (structuresByName[currentFile.name] ?? null) : null}
            onHeadingClick={handleHeadingClick}
            onSectionClick={handleSectionClick}
            isLoading={currentFile ? !!loadingByName[currentFile.name] : false}
            isViewerReady={!!apis}
            activePage={activePage}
            files={files}
            pdfFilename={pdfFilename}
            onChatToggle={() => setIsChatOpen(!isChatOpen)}
            sections={sections}
            setSections={setSections}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isDeepSearch={isDeepSearch}
            setIsDeepSearch={setIsDeepSearch}
          />
        </div>
      </main>
      {isChatOpen && pdfFilename && (
        <ChatWindow
        pdfFilename={pdfFilename}
        onClose={() => {
            setIsChatOpen(false);
            setChatMode("chat"); // Reset to default mode on close
        }}
        initialQuery={initialQuery}
        onInitialQueryConsumed={() => setInitialQuery(undefined)}
        mode={chatMode} // Pass the mode here
      />
      )}
      {podcastAudio && (
        <PodcastPlayer
          audioUrl={podcastAudio}
          onClose={() => setPodcastAudio(undefined)}
        />
      )}
    </div>
  );
}





