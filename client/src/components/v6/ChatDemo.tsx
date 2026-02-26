import { useEffect, useState } from "react";
import { MessageSquare, Send, CheckCircle } from "lucide-react";

const chatMessages = [
  { role: "visitor" as const, text: "Hi, I'm interested in your services. What do you offer?" },
  { role: "ai" as const, text: "Welcome! We help businesses capture more leads. What's your business about?" },
  { role: "visitor" as const, text: "I run a dental clinic. Need more patients." },
  { role: "ai" as const, text: "Great! I can help grow your patient base. Can I get your name and email to set up a free consultation?" },
  { role: "visitor" as const, text: "Sure! It's Dr. Smith, drsmith@email.com" },
  { role: "ai" as const, text: "Perfect, Dr. Smith! Our team will reach out within 24 hours. You're going to love the results!" },
];

const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-3 py-2.5">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="w-1.5 h-1.5 rounded-full bg-blue-500/50"
        style={{ animation: `v6-typing-dot 1.4s ease-in-out ${i * 0.2}s infinite` }}
      />
    ))}
  </div>
);

const ChatDemo = () => {
  const [visibleMessages, setVisibleMessages] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);

  useEffect(() => {
    if (visibleMessages >= chatMessages.length) {
      setTimeout(() => setLeadCaptured(true), 800);
      return;
    }
    const nextMsg = chatMessages[visibleMessages];
    const delay = visibleMessages === 0 ? 1200 : nextMsg.role === "ai" ? 2000 : 1500;
    const timer = setTimeout(() => {
      if (nextMsg.role === "ai") {
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          setVisibleMessages((v) => v + 1);
        }, 1200);
      } else {
        setVisibleMessages((v) => v + 1);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [visibleMessages]);

  useEffect(() => {
    const reset = setTimeout(() => {
      if (leadCaptured) {
        setVisibleMessages(0);
        setLeadCaptured(false);
      }
    }, 5000);
    return () => clearTimeout(reset);
  }, [leadCaptured]);

  return (
    <div className="relative w-full max-w-md mx-auto v6-animate-float" data-testid="chat-demo">
      {/* Browser frame */}
      <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-lg">
        {/* Browser bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-muted border-b border-border">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-400/60" />
            <span className="w-3 h-3 rounded-full bg-yellow-400/60" />
            <span className="w-3 h-3 rounded-full bg-green-400/60" />
          </div>
          <div className="flex-1 ml-2">
            <div className="bg-background rounded-md px-3 py-1 text-xs text-muted-foreground font-mono">
              yourbusiness.com
            </div>
          </div>
        </div>

        {/* Website mock content */}
        <div className="relative p-5 bg-background min-h-[360px]">
          {/* Fake nav */}
          <div className="flex items-center gap-2 mb-4">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="ml-auto flex gap-2">
              <div className="h-3 w-10 rounded bg-muted" />
              <div className="h-3 w-10 rounded bg-muted" />
              <div className="h-3 w-10 rounded bg-muted" />
            </div>
          </div>
          {/* Fake hero */}
          <div className="space-y-2 mb-4">
            <div className="h-7 w-3/4 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted/60" />
            <div className="h-3 w-5/6 rounded bg-muted/60" />
          </div>
          <div className="flex gap-2 mb-6">
            <div className="h-8 w-20 rounded bg-blue-500/20" />
            <div className="h-8 w-20 rounded bg-muted" />
          </div>
          <div className="space-y-1.5">
            <div className="h-2.5 w-full rounded bg-muted/40" />
            <div className="h-2.5 w-4/5 rounded bg-muted/40" />
            <div className="h-2.5 w-full rounded bg-muted/40" />
            <div className="h-2.5 w-3/4 rounded bg-muted/40" />
          </div>

          {/* Chat widget - overlaid bottom-right */}
          <div className="absolute bottom-3 right-3 w-[250px] rounded-xl overflow-hidden border border-border bg-card shadow-md">
            {/* Chat header */}
            <div className="v6-bg-gradient px-3 py-2 flex items-center gap-2">
              <div className="relative">
                <MessageSquare className="w-4 h-4 text-white" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full border border-white/30" />
              </div>
              <span className="text-xs font-semibold text-white">AI Assistant</span>
              <span className="text-[10px] text-white/70 ml-auto">Online</span>
            </div>

            {/* Messages */}
            <div className="p-2 space-y-1.5 bg-background min-h-[190px] max-h-[190px] overflow-hidden">
              {chatMessages.slice(0, visibleMessages).map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "visitor" ? "justify-end" : "justify-start"}`}
                  style={{ animation: "v6-chat-appear 0.35s ease-out forwards" }}
                >
                  <div
                    className={`max-w-[85%] px-2.5 py-1.5 rounded-xl text-[10px] leading-relaxed ${
                      msg.role === "visitor"
                        ? "v6-bg-gradient text-white rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-xl rounded-bl-sm">
                    <TypingIndicator />
                  </div>
                </div>
              )}
            </div>

            {/* Input bar */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-t border-border bg-background">
              <div className="flex-1 bg-muted rounded-md px-2 py-1.5 text-[10px] text-muted-foreground">
                Type a message...
              </div>
              <button className="p-1.5 rounded-md v6-bg-gradient text-white">
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lead captured notification */}
      {leadCaptured && (
        <div
          className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl px-5 py-3 flex items-center gap-3 shadow-md whitespace-nowrap"
          style={{ animation: "v6-chat-appear 0.4s ease-out forwards" }}
        >
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <span
              className="absolute inset-0 rounded-full bg-green-400/25"
              style={{ animation: "v6-pulse-ring 1.5s ease-out infinite" }}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">New Lead Captured!</p>
            <p className="text-xs text-muted-foreground">Dr. Smith — drsmith@email.com</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatDemo;
