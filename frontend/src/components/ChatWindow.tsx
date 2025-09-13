import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from 'react-markdown';
// import { Send, X, Maximize2, Minimize2 } from "lucide-react";
// At the top of ChatWindow.tsx
import { PanelLeft, PanelRight, Send, X, Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  sender: "user" | "bot";
  text: string;
}

interface ChatWindowProps {
  pdfFilename: string;
  onClose: () => void;
  initialQuery?: string;
  onInitialQueryConsumed?: () => void;
  mode?: "chat" | "insight";
}

export default function ChatWindow({ pdfFilename, onClose, initialQuery, onInitialQueryConsumed, mode = "chat", }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  type DockState = 'right' | 'left' | 'maximized';
  const [dockState, setDockState] = useState<DockState>('right'); // Default to right
  const [lastDockState, setLastDockState] = useState<DockState>('right');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (initialQuery) {
      handleSend(initialQuery, true);
      if (onInitialQueryConsumed) {
        onInitialQueryConsumed();
      }
    }
  }, [initialQuery]);

  const toggleMaximize = () => {
    if (dockState === 'maximized') {
      // If it's already maximized, restore it to its last docked state
      setDockState(lastDockState);
    } else {
      // If it's docked, remember the current state and then maximize
      setLastDockState(dockState);
      setDockState('maximized');
    }
  };

  const handleDock = (position: 'left' | 'right') => {
    setDockState(position);
  };

  const handleSend = async (query?: string, isInitialQuery = false) => {
    const textToSend = query || input;
    if (!textToSend.trim()) return;

    if (!isInitialQuery) {
      const userMessage = { sender: "user" as const, text: textToSend };
      setMessages(prev => [...prev, userMessage]);
    }

    const botMessagePlaceholder = { sender: "bot" as const, text: "" };
    setMessages(prev => [...prev, botMessagePlaceholder]);
    setInput("");
    setIsLoading(true);

    try {
      const endpoint = mode === 'insight'
        ? '/api/insights-stream'
        : '/api/chat-stream';

      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pdfFilename, question: textToSend }),
      });

      if (!response.body) {
        throw new Error("Response body is null");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
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
                setMessages(prev => {
                  const lastMessage = prev[prev.length - 1];
                  if (lastMessage && lastMessage.sender === 'bot') {
                    const updatedMessages = [...prev];
                    updatedMessages[prev.length - 1] = {
                      ...lastMessage,
                      text: lastMessage.text + data.output_text,
                    };
                    return updatedMessages;
                  }
                  return prev;
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev.slice(0, -1), { sender: "bot", text: "Sorry, something went wrong." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getWindowStyle = (): React.CSSProperties => {
    switch (dockState) {
      case 'maximized':
        return {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '60vw',
          height: '75vh',
          zIndex: 1000,
          transition: 'none'
        };
      case 'left':
        return {
          position: 'fixed',
          left: 16,
          bottom: 16,
          width: 400,
          height: 500,
          zIndex: 1000,
          transition: 'none'
        };
      case 'right':
      default:
        return {
          position: 'fixed',
          right: 16,
          bottom: 16,
          width: 400,
          height: 500,
          zIndex: 1000,
          transition: 'none'
        };
    }
  };
  
  const windowStyle = getWindowStyle();

  return (
    <div 
      style={windowStyle}
      className={`bg-white border border-gray-200 shadow-2xl flex flex-col overflow-hidden transition-all duration-300
        ${dockState === 'left' ? 'rounded-lg' : ''}
        ${dockState === 'right' ? 'rounded-lg' : ''}
        ${dockState === 'maximized' ? 'rounded-lg' : ''}
        `}
    >
      {/* Header */}
      <div 
        className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-3 flex justify-between items-center select-none"
      >
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-sm">Chat with PDF</h3>
        </div>
        
        <div className="flex items-center space-x-1">
        {dockState !== 'left' && dockState !== 'maximized' && (
            <Button variant="ghost" size="sm" onClick={() => handleDock('left')} className="h-7 w-7 p-0 hover:bg-blue-400 text-white" title="Dock Left">
              <PanelLeft className="h-4 w-4" />
            </Button>
          )}
          {dockState !== 'right' && dockState !== 'maximized' && (
            <Button variant="ghost" size="sm" onClick={() => handleDock('right')} className="h-7 w-7 p-0 hover:bg-blue-400 text-white" title="Dock Right">
              <PanelRight className="h-4 w-4" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleMaximize}
            className="h-7 w-7 p-0 hover:bg-blue-400 text-white"
            title={dockState === 'maximized' ? "Minimize" : "Maximize"}
          >
            {dockState === 'maximized' ? <Minimize2 className="h-3 w-3"/> : <Maximize2 className="h-3 w-3" />}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="h-7 w-7 p-0 hover:bg-red-500 text-white"
            title="Close"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50 min-h-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <div className="bg-white rounded-lg p-4 shadow-sm border">
                  <h4 className="font-medium mb-2">Welcome to PDF Chat!</h4>
                  <p className="text-sm">Ask me anything about your PDF document.</p>
                </div>
              </div>
            )}
            
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm ${
                  message.sender === "user" 
                    ? "bg-blue-500 text-white rounded-br-md" 
                    : "bg-white border border-gray-200 rounded-bl-md text-gray-800"
                }`}> 
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  <ReactMarkdown>{message.text}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-bl-md shadow-sm">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-200">
          <div className="flex items-end space-x-2">
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Type your question here..."
                className="pr-12 resize-none border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-full"
                disabled={isLoading}
              />
            </div>
            <Button 
              onClick={() => handleSend()} 
              disabled={isLoading || !input.trim()}
              className="h-10 w-10 rounded-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50"
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
