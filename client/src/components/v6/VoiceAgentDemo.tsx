import { useEffect, useState } from "react";

const conversation = [
  { role: "agent", text: "Hi! This is Alex from Agency. Am I speaking with the property owner?" },
  { role: "lead", text: "Yes, I'm interested in renting a 2-bedroom unit." },
  { role: "agent", text: "Great! I can help with that. Are you available this Thursday for a showing?" },
  { role: "lead", text: "Thursday at 3pm works perfectly for me." },
  { role: "agent", text: "Perfect — I've booked you for Thursday at 3:00 PM. You'll get a confirmation text shortly!" },
];

const VoiceAgentDemo = () => {
  const [stage, setStage] = useState(0);
  const [typing, setTyping] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setStage((prev) => (prev + 1) % conversation.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const msg = conversation[stage].text;
    setTyping("");
    let i = 0;
    const typeInterval = setInterval(() => {
      setTyping(msg.slice(0, i + 1));
      i++;
      if (i >= msg.length) clearInterval(typeInterval);
    }, 22);
    return () => clearInterval(typeInterval);
  }, [stage]);

  return (
    <div className="relative w-full max-w-xl mx-auto v6-animate-float" data-testid="voice-agent-demo">
      <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-lg">
        {/* Browser chrome bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-muted border-b border-border">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
            <div className="w-3 h-3 rounded-full bg-green-400/60" />
          </div>
          <div className="flex-1 mx-4">
            <div className="bg-background rounded-md px-3 py-1 text-xs text-muted-foreground text-center">
              agency.app/ai-voice
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[340px] bg-card relative">
          {/* Pulse button in corner */}
          <div className="absolute bottom-5 right-5 z-10">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 v6-animate-pulse-ring" />
              <div className="absolute -inset-2 rounded-full bg-blue-500/10 v6-animate-pulse-ring" style={{ animationDelay: "0.5s" }} />
              <div className="relative w-12 h-12 rounded-full v6-bg-gradient flex items-center justify-center shadow-md">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" fill="currentColor" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Call UI */}
          <div className="bg-muted rounded-xl p-4 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-blue-600">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" fill="currentColor" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">AI Voice Agent — Alex</p>
                <p className="text-xs text-blue-600 font-medium">● Live Call</p>
              </div>
              {/* Voice wave bars */}
              <div className="ml-auto flex items-end gap-0.5 h-7">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-1 bg-blue-500 rounded-full v6-animate-voice-wave"
                    style={{ animationDelay: `${i * 0.15}s`, minHeight: "6px" }}
                  />
                ))}
              </div>
            </div>

            {/* Conversation bubbles */}
            <div className="space-y-2.5">
              {conversation.slice(0, stage + 1).map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "lead" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                      msg.role === "agent"
                        ? "v6-bg-gradient text-white rounded-bl-sm"
                        : "bg-card text-foreground border border-border rounded-br-sm"
                    }`}
                  >
                    {i === stage ? typing : msg.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lead qualified badge */}
          {stage >= 3 && (
            <div className="mt-3 flex items-center gap-2 bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-green-600 flex-shrink-0">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xs font-medium text-green-700">Showing Scheduled — Thursday 3:00 PM</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceAgentDemo;
