import { useState, useEffect, useRef } from "react";
import { Check, Calendar, MapPin, Home, Sparkles } from "lucide-react";

interface Message {
  id: number;
  type: "lead" | "ai";
  text: string;
  timestamp: string;
  showBooking?: boolean;
}

const chatMessages: Message[] = [
  {
    id: 1,
    type: "lead",
    text: "Hi! Is the 2BR apartment on Oak Street still available?",
    timestamp: "2:34 PM",
  },
  {
    id: 2,
    type: "ai",
    text: "Hi there! Yes, the 2BR at 456 Oak Street is available! It's $1,850/month, 950 sq ft with in-unit laundry. Would you like to schedule a tour?",
    timestamp: "2:34 PM",
  },
  {
    id: 3,
    type: "lead",
    text: "Yes! Can I see it this Saturday?",
    timestamp: "2:35 PM",
  },
  {
    id: 4,
    type: "ai",
    text: "Perfect! I have availability on Saturday. What time works best for you - 10am, 1pm, or 3pm?",
    timestamp: "2:35 PM",
  },
  {
    id: 5,
    type: "lead",
    text: "1pm works great",
    timestamp: "2:36 PM",
  },
  {
    id: 6,
    type: "ai",
    text: "You're all set! Tour confirmed for Saturday at 1pm at 456 Oak Street. I'll send you a reminder. What's the best number to reach you?",
    timestamp: "2:36 PM",
    showBooking: true,
  },
];

export function AnimatedChatDemo() {
  const [visibleMessages, setVisibleMessages] = useState<Message[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentIndex < chatMessages.length) {
      const nextMessage = chatMessages[currentIndex];

      if (nextMessage.type === "ai") {
        setIsTyping(true);
        const typingTimeout = setTimeout(() => {
          setIsTyping(false);
          setVisibleMessages((prev) => [...prev, nextMessage]);
          setCurrentIndex((prev) => prev + 1);
        }, 1500);
        return () => clearTimeout(typingTimeout);
      } else {
        const messageTimeout = setTimeout(() => {
          setVisibleMessages((prev) => [...prev, nextMessage]);
          setCurrentIndex((prev) => prev + 1);
        }, 1000);
        return () => clearTimeout(messageTimeout);
      }
    } else {
      const resetTimeout = setTimeout(() => {
        setVisibleMessages([]);
        setCurrentIndex(0);
      }, 4000);
      return () => clearTimeout(resetTimeout);
    }
  }, [currentIndex]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleMessages, isTyping]);

  return (
    <div className="w-full max-w-md mx-auto" data-testid="chat-demo-v4">
      <div className="bg-card rounded-t-2xl border border-border p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full lv4-gradient-messenger flex items-center justify-center flex-shrink-0">
          <Home className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-foreground truncate" data-testid="text-chat-property-name">Oakwood Properties</span>
            <div className="w-1.5 h-1.5 rounded-full lv4-bg-success animate-pulse flex-shrink-0" />
          </div>
          <span className="text-xs text-muted-foreground">Usually responds instantly</span>
        </div>
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full lv4-bg-facebook-10 lv4-border-facebook-20 border flex-shrink-0">
          <svg className="w-3 h-3 lv4-text-facebook" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.936 1.444 5.544 3.7 7.254V22l3.3-1.8c.88.244 1.819.377 2.8.377h.2c5.523 0 10-4.145 10-9.257S17.523 2 12 2z"/>
          </svg>
          <span className="text-[10px] font-medium lv4-text-facebook">Messenger</span>
        </div>
      </div>

      <div ref={chatScrollRef} className="bg-card/50 border-x border-border h-[460px] p-4 space-y-3 overflow-y-auto overflow-x-hidden">
        {visibleMessages.map((message, index) => (
          <div
            key={message.id}
            className={`flex ${message.type === "lead" ? "justify-end" : "justify-start"} lv4-chat-bubble-enter`}
            style={{ animationDelay: `${index * 0.1}s` }}
            data-testid={`chat-message-${message.id}`}
          >
            <div className={`max-w-[85%] ${message.type === "lead" ? "order-1" : "order-2"}`}>
              <div
                className={`px-3 py-2.5 rounded-xl ${
                  message.type === "lead"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-secondary text-secondary-foreground rounded-bl-md"
                }`}
              >
                {message.type === "ai" && (
                  <div className="flex items-center gap-1 mb-1">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-medium text-primary">AI Agent</span>
                  </div>
                )}
                <p className="text-sm leading-relaxed">{message.text}</p>
              </div>

              {message.showBooking && (
                <div className="mt-2 p-2.5 lv4-bg-success-10 lv4-border-success-20 border rounded-lg lv4-chat-bubble-enter" data-testid="badge-tour-booked">
                  <div className="flex items-center gap-2 lv4-text-success">
                    <div className="w-5 h-5 rounded-full lv4-bg-success flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs font-semibold">Tour Booked!</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <Calendar className="w-2.5 h-2.5 flex-shrink-0" /> Saturday, 1pm
                    </span>
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5 flex-shrink-0" /> 456 Oak St
                    </span>
                  </div>
                </div>
              )}

              <span className="text-[10px] text-muted-foreground mt-1 block px-0.5">
                {message.timestamp}
              </span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start lv4-chat-bubble-enter" data-testid="typing-indicator-v4">
            <div className="bg-secondary px-3 py-2.5 rounded-xl rounded-bl-md">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full lv4-animate-typing" style={{ animationDelay: "0s" }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full lv4-animate-typing" style={{ animationDelay: "0.2s" }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full lv4-animate-typing" style={{ animationDelay: "0.4s" }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-b-2xl border border-t-0 border-border p-3 flex items-center gap-3" data-testid="chat-input-area-v4">
        <div className="flex-1 bg-secondary rounded-full px-4 py-2.5 text-sm text-muted-foreground" data-testid="chat-input-placeholder-v4">
          Aa
        </div>
        <div className="w-10 h-10 rounded-full lv4-gradient-messenger flex items-center justify-center flex-shrink-0" data-testid="chat-send-icon-v4">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </div>
      </div>
    </div>
  );
}
