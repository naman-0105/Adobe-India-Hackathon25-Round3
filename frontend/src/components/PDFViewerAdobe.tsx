import { useEffect, useRef } from "react";


// ------------------------
// Type Declarations
// ------------------------
export interface AdobeViewerSecondLevelAPIs {
  gotoLocation(pageNumber: number): void;
  search(term: string): Promise<void>;
  getSelectedContent(): Promise<{ type: string; data: string } | { text: string }>;
}

export interface AdobeViewerAPIs {
  getAPIs(): Promise<AdobeViewerSecondLevelAPIs>;
  executeCommand: unknown;
  getAnnotationManager: unknown;
}

declare global {
  interface Window {
    AdobeDC: {
      View: {
        new (options: { clientId: string; divId: string; locale?: string }): AdobeDCView;
        Enum: {
          CallbackType: { EVENT_LISTENER: string };
          Events: {
            PAGE_VIEW: string;
            DOCUMENT_OPEN: string;
            DOCUMENT_CLOSE: string;
            TEXT_COPY: string;
            ANNOTATION_ADDED: string;
            ANNOTATION_UPDATED: string;
            ANNOTATION_DELETED: string;
            [key: string]: string;
          };
        };
      };
    };
  }

  interface AdobeDCView {
    previewFile(
      previewArgs: {
        content: { promise?: Promise<ArrayBuffer>; location?: { url: string } };
        metaData: { fileName: string };
      },
      config: Record<string, unknown>
    ): Promise<AdobeViewerAPIs>;

    registerCallback(
      type: string,
      callback: (event: AdobeDCEvent) => void,
      options: { listenOn?: string[]; enableFilePreviewEvents?: boolean }
    ): void;
  }

  interface AdobeDCEvent {
    type: string;
    data: {
      pageNumber?: number;
      [key: string]: unknown;
    };
  }
}

// ------------------------
// Props Interface
// ------------------------
export type PDFViewerAdobeProps = {
  file?: Blob;
  url?: string;
  fileName?: string;
  onApisReady?: (apis: AdobeViewerSecondLevelAPIs) => void;
  onPageChange?: (pageNumber: number) => void;
  onTextSelection?: (selectedText: string) => void;
};

// ------------------------
// Component
// ------------------------
export default function PDFViewerAdobe({
  file,
  url,
  fileName = "document.pdf",
  onApisReady,
  onPageChange,
  onTextSelection
}: PDFViewerAdobeProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const apisRef = useRef<AdobeViewerSecondLevelAPIs | null>(null);

  // Get clientId from environment
  const clientId = process.env.ADOBE_EMBED_API_KEY as string;

  useEffect(() => {
    if (!clientId || !divRef.current) return;

    const ensureReady = () =>
      new Promise<void>((resolve) => {
        if (window.AdobeDC) return resolve();
        document.addEventListener("adobe_dc_view_sdk.ready", () => resolve(), { once: true });
      });

    const load = async () => {
      await ensureReady();

      const AdobeDC = window.AdobeDC;
      const divId = "adobe-dc-view";
      divRef.current!.id = divId;

      // Create viewer instance
      const view = new AdobeDC.View({ clientId, divId, locale: "en-US" });

      // Add global event listener for debugging
      document.addEventListener("adobe_dc_view_sdk_ready", () => {
        console.log("Adobe DC View SDK is ready");
      });

      // Full Window embed mode
      const config = {
        embedMode: "FULL_WINDOW",
        showDownloadPDF: true,
        showPrintPDF: true,
        showAnnotationTools: true,
        defaultViewMode: "FIT_PAGE",
        enableSearchAPIs: true,
        enableTextSelection: true,
        enableFilePreviewEvents: true
      };

      const previewArgs = {
        metaData: { fileName },
        content: {} as { promise?: Promise<ArrayBuffer>; location?: { url: string } }
      };

      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        previewArgs.content = { promise: Promise.resolve(arrayBuffer) };
      } else if (url) {
        previewArgs.content = { location: { url } };
      }

      // Register text selection callback BEFORE previewing the file (following index.html pattern)
      if (onTextSelection) {
        console.log("Setting up text selection listener (index.html pattern)...");
        
        view.registerCallback(
          AdobeDC.View.Enum.CallbackType.EVENT_LISTENER,
          function (event: AdobeDCEvent) {
            // console.log("Adobe event received:", event.type, event);
            
            // Listen for text selection events
            if (event.type === "PREVIEW_SELECTION_END") {
              // console.log("PREVIEW_SELECTION_END event detected!");
              // Use the stored APIs reference instead of calling previewFile again
              if (apisRef.current) {
                apisRef.current.getSelectedContent().then(function (result) {
                  // console.log("Selected content (index.html pattern):", result);
                  if (result && 'data' in result && result.data) {
                    // console.log("Selected text:", result.data);
                    onTextSelection(result.data);
                  }
                }).catch(function (error) {
                  console.error("Error getting selected content:", error);
                });
              } else {
                console.log("APIs not ready yet");
              }
            }
          },
          { enableFilePreviewEvents: true }
        );
      }

      const initialApis = await view.previewFile(previewArgs, config);
      if (initialApis) {
        const finalApis = await initialApis.getAPIs();
        apisRef.current = finalApis;
        if (onApisReady) {
          onApisReady(finalApis);
        }
      }

      // Add fallback text selection handling using mouse events
      if (onTextSelection) {
        // console.log("Setting up fallback text selection handler...");
        
        const handleTextSelection = async () => {
          if (apisRef.current) {
            try {
              const selectedContent = await apisRef.current.getSelectedContent();
              // console.log("Fallback - Selected content:", selectedContent);
              if (selectedContent && 'data' in selectedContent && selectedContent.data) {
                // console.log("Fallback - Selected text:", selectedContent.data);
                onTextSelection(selectedContent.data);
              } else if (selectedContent && 'text' in selectedContent && selectedContent.text) {
                // console.log("Fallback - Selected text:", selectedContent.text);
                onTextSelection(selectedContent.text);
              }
            } catch (error) {
              console.log("Fallback - No text selected or error:", error);
            }
          }
        };

        // Add mouse up event listener as fallback
        const handleMouseUp = () => {
          // Add a small delay to ensure selection is complete
          setTimeout(handleTextSelection, 100);
        };

        document.addEventListener('mouseup', handleMouseUp);
        
        // Clean up the event listener when component unmounts
        return () => {
          document.removeEventListener('mouseup', handleMouseUp);
        };
      }

      // Listen to all Adobe events
      view.registerCallback(
        AdobeDC.View.Enum.CallbackType.EVENT_LISTENER,
        (event: AdobeDCEvent) => {
          // console.log("Adobe event received:", event.type, event);
          if (event.type === AdobeDC.View.Enum.Events.PAGE_VIEW && onPageChange) {
            onPageChange(event.data.pageNumber!);
          }
        },
        { listenOn: [AdobeDC.View.Enum.Events.PAGE_VIEW] }
      );

      // Add specific event listener for the PDF viewer div
      if (onTextSelection && divRef.current) {
        const handleViewerMouseUp = (e: MouseEvent) => {
          // Only handle events within the PDF viewer area
          if (divRef.current && divRef.current.contains(e.target as Node)) {
            // console.log("PDF viewer mouse up detected");
            setTimeout(async () => {
              if (apisRef.current) {
                try {
                  const selectedContent = await apisRef.current.getSelectedContent();
                  console.log("Viewer-specific - Selected content:", selectedContent);
                  if (selectedContent && 'data' in selectedContent && selectedContent.data) {
                    console.log("Viewer-specific - Selected text:", selectedContent.data);
                    onTextSelection(selectedContent.data);
                  } else if (selectedContent && 'text' in selectedContent && selectedContent.text) {
                    console.log("Viewer-specific - Selected text:", selectedContent.text);
                    onTextSelection(selectedContent.text);
                  }
                } catch (error) {
                  console.log("Viewer-specific - No text selected or error:", error);
                }
              }
            }, 150);
          }
        };

        divRef.current.addEventListener('mouseup', handleViewerMouseUp);
        
        // Clean up the event listener when component unmounts
        return () => {
          if (divRef.current) {
            divRef.current.removeEventListener('mouseup', handleViewerMouseUp);
          }
        };
      }
    };

    load();
  }, [file, url, fileName, clientId, onApisReady]);

  if (!clientId) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        Adobe Client ID is missing in environment variables.
      </div>
    );
  }

  return (
    <div 
      ref={divRef} 
      className="w-full h-full" 
      onClick={() => {
        console.log("PDF viewer div clicked");
        console.log("APIs ref current:", apisRef.current);
        if (apisRef.current) {
          console.log("APIs are available");
        } else {
          console.log("APIs are not available yet");
        }
      }}
    />
  );
}