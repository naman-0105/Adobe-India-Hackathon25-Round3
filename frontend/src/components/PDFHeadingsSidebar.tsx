import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, FileText, Lightbulb } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface PDFHeading {
  level: "H1" | "H2" | "H3";
  text: string;
  page: number;
}

export interface PDFStructure {
  title: string;
  outline: PDFHeading[];
}

export interface PDFSection {
  section_title: string;
  page_number: number;
  refined_text: string;
  file_name: string;
}

interface PDFSectionsSidebarProps {
  structure: PDFStructure | null;
  onHeadingClick: (heading: PDFHeading) => void;
  onSectionClick: (section: PDFSection) => void;
  isLoading?: boolean;
  isViewerReady?: boolean;
  activePage?: number;
  files: File[];
  pdfFilename?: string;
  onChatToggle: () => void;
  sections: PDFSection[];
  setSections: (sections: PDFSection[]) => void;
  activeTab: "Headings" | "Sections";
  setActiveTab: (tab: "Headings" | "Sections") => void;
  isDeepSearch?: boolean;
  setIsDeepSearch?: (enabled: boolean) => void;
}

export default function PDFSectionsSidebar({
  structure,
  onHeadingClick,
  onSectionClick,
  isLoading = false,
  isViewerReady = false,
  activePage = 1,
  files,
  pdfFilename,
  onChatToggle,
  sections,
  setSections,
  activeTab,
  setActiveTab,
  isDeepSearch = false,
  setIsDeepSearch,
}: PDFSectionsSidebarProps) {
  const [persona, setPersona] = useState("");
  const [job, setJob] = useState("");
  const [isFetchingSections, setIsFetchingSections] = useState(false);

  const handleSectionsSubmit = async () => {
    setIsFetchingSections(true);

    const formData = new FormData();
    formData.append("persona", persona);
    formData.append("job", job);
    formData.append("deepSearch", String(isDeepSearch)); // Use the passed deep search state
    files.forEach((file) => {
      formData.append("pdfs", file);
    });

    try {
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
      setSections(data.sections || []);
    } catch (error) {
      console.error("Error fetching sections:", error);
      // Handle error state in UI
    } finally {
      setIsFetchingSections(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-full border-l bg-background">
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Document Headings
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-1"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const getHeadingStyle = (level: string) => {
    switch (level) {
      case "H1":
        return "font-semibold text-sm";
      case "H2":
        return "font-medium text-sm ml-3";
      case "H3":
        return "font-normal text-sm ml-6";
      default:
        return "text-sm";
    }
  };

  const getHeadingIcon = (level: string) => {
    switch (level) {
      case "H1":
        return "●";
      case "H2":
        return "○";
      case "H3":
        return "▪";
      default:
        return "•";
    }
  };

  return (
    <div className="w-full h-full border-l bg-background">
      <div className="p-4 border-b">
        <div className="flex gap-2 mb-4">
          <Button
            onClick={() => setActiveTab("Headings")}
            variant={activeTab === "Headings" ? "secondary" : "ghost"}
            className="flex-1"
          >
            Headings
          </Button>
          <Button
            onClick={() => setActiveTab("Sections")}
            variant={activeTab === "Sections" ? "secondary" : "ghost"}
            className="flex-1"
          >
            Sections
          </Button>
          <Button
            onClick={onChatToggle}
            variant="ghost"
            size="icon"
            disabled={!pdfFilename}
          >
            <Lightbulb className="h-4 w-4" />
          </Button>
        </div>
        {activeTab === "Headings" && (
          <>
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Document Headings
            </h3>
            {structure?.title && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {structure.title}
              </p>
            )}
          </>
        )}
        {activeTab === "Sections" && (
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Relevant Sections
          </h3>
        )}
      </div>

      <ScrollArea className="h-[calc(100vh-180px)]">
        {activeTab === "Headings" && (
          <div className="p-2 space-y-1">
            {!structure || !structure.outline.length ? (
              <div className="p-4 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No headings found in this document</p>
              </div>
            ) : (
              structure.outline.map((heading, index) => {
                const isActive = heading.page + 1 === activePage;
                return (
                  <div
                    key={index}
                    onClick={
                      !isViewerReady ? undefined : () => onHeadingClick(heading)
                    }
                    className={`
              w-full flex items-center text-left h-auto p-2 rounded-md transition-colors
              ${getHeadingStyle(heading.level)}
              ${
                isActive
                  ? "bg-secondary"
                  : isViewerReady
                  ? "hover:bg-muted cursor-pointer"
                  : ""
              }
              ${!isViewerReady ? "opacity-50 cursor-not-allowed" : ""}
            `}
                    role="button"
                    tabIndex={isViewerReady ? 0 : -1}
                    onKeyDown={(e) => {
                      if (
                        isViewerReady &&
                        (e.key === "Enter" || e.key === " ")
                      ) {
                        onHeadingClick(heading);
                      }
                    }}
                  >
                    <span className="mr-2 text-muted-foreground">
                      {getHeadingIcon(heading.level)}
                    </span>
                    {/* The FIX: Removed 'truncate' and added 'min-w-0' */}
                    <span className="flex-1 min-w-0">{heading.text}</span>
                    <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                      p.{heading.page + 1}
                    </span>
                    <ChevronRight className="h-3 w-3 ml-1 text-muted-foreground flex-shrink-0" />
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "Sections" && (
          <div className="p-4 space-y-4">
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
              <p className="font-medium mb-1">Two ways to find relevant sections:</p>
              <p>1. <strong>Manual:</strong> Enter persona and job below</p>
              <p>2. <strong>Auto:</strong> Select text in PDF to search automatically</p>
              <p className="mt-1">💡 <strong>Deep Search:</strong> Enable for AI-powered refinement (up to 5 most relevant sections)</p>
            </div>
            <div>
              <label
                htmlFor="persona"
                className="text-sm font-medium text-muted-foreground"
              >
                Persona (Role)
              </label>
              <Input
                id="persona"
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                placeholder="e.g., Software Engineer"
              />
            </div>
            <div>
              <label
                htmlFor="job"
                className="text-sm font-medium text-muted-foreground"
              >
                Job (Task)
              </label>
              <Input
                id="job"
                value={job}
                onChange={(e) => setJob(e.target.value)}
                placeholder="e.g., Implement a new feature"
              />
            </div>
            {/* --- DEEP SEARCH TOGGLE --- */}
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="deep-search"
                checked={isDeepSearch}
                onCheckedChange={setIsDeepSearch}
              />
              <Label htmlFor="deep-search" className="cursor-pointer">
                Deep Search (slower, more accurate)
              </Label>
            </div>
            <Button
              onClick={handleSectionsSubmit}
              disabled={!persona || !job || isFetchingSections}
              className="w-full"
            >
              {isFetchingSections ? "Finding Sections..." : "Find Sections"}
            </Button>

            {isFetchingSections && (
              <div className="space-y-2 pt-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-1"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            )}

            {!isFetchingSections && sections.length > 0 && (
              <div className="pt-4 space-y-2">
                {sections.length > 0 && (
                  <div className="text-xs text-muted-foreground mb-2">
                    {persona && job 
                      ? `Manually fetched sections${isDeepSearch ? ' (Deep Search)' : ''}:` 
                      : `Auto-fetched from text selection${isDeepSearch ? ' (Deep Search)' : ''}:`
                    }
                  </div>
                )}
                {sections.map((section, index) => (
                  <div
                    key={index}
                    onClick={() => onSectionClick(section)}
                    // These classes make the div look and act like a flexible button
                    className="w-full flex justify-between items-start text-left h-auto p-2 rounded-md hover:bg-muted transition-colors cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        onSectionClick(section);
                      }
                    }}
                  >
                    {/* This inner structure can now expand freely */}
                    <div className="flex-1 pr-4">
                      <div className="flex items-start">
                        <span className="mr-2 mt-1 text-muted-foreground">
                          ▪
                        </span>
                        {/* The min-w-0 is a crucial flexbox fix that allows text to wrap inside a flex item */}
                        <span className="font-medium min-w-0">
                          {section.section_title}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground ml-5 mt-1 break-words">
                        {section.refined_text}
                      </p>
                    </div>
                    {/* Adjusted Chevron position slightly for better alignment */}
                    <ChevronRight className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}