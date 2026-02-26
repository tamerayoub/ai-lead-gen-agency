import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, CheckCircle, MessageSquare, User } from "lucide-react";

const serviceColors: Record<string, string> = {
  "Consultation": "bg-blue-500/15 text-blue-600 border-blue-500/30",
  "Strategy Call": "bg-orange-500/15 text-orange-600 border-orange-500/30",
  "Onboarding": "bg-cyan-500/15 text-cyan-600 border-cyan-500/30",
  "Follow-up": "bg-violet-500/15 text-violet-600 border-violet-500/30",
  "Discovery": "bg-sky-500/15 text-sky-600 border-sky-500/30",
  "Review": "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
};

interface Appointment {
  day: number;
  time: string;
  name: string;
  service: string;
}

const appointmentWaves: Appointment[][] = [
  [
    { day: 2, time: "9 AM", name: "Sarah M.", service: "Consultation" },
    { day: 2, time: "11 AM", name: "Tom W.", service: "Strategy Call" },
    { day: 3, time: "10 AM", name: "Lisa K.", service: "Onboarding" },
    { day: 5, time: "2 PM", name: "James P.", service: "Follow-up" },
    { day: 6, time: "9 AM", name: "Maria G.", service: "Discovery" },
    { day: 6, time: "3 PM", name: "David C.", service: "Review" },
  ],
  [
    { day: 9, time: "10 AM", name: "Rachel B.", service: "Consultation" },
    { day: 9, time: "1 PM", name: "Mike R.", service: "Strategy Call" },
    { day: 10, time: "9 AM", name: "Karen S.", service: "Onboarding" },
    { day: 10, time: "2 PM", name: "Steve L.", service: "Follow-up" },
    { day: 12, time: "11 AM", name: "Amy T.", service: "Discovery" },
    { day: 13, time: "3 PM", name: "Chris N.", service: "Review" },
  ],
  [
    { day: 16, time: "9 AM", name: "Emma D.", service: "Consultation" },
    { day: 16, time: "2 PM", name: "Brian F.", service: "Strategy Call" },
    { day: 17, time: "10 AM", name: "Nicole H.", service: "Onboarding" },
    { day: 18, time: "1 PM", name: "Ryan J.", service: "Follow-up" },
    { day: 19, time: "11 AM", name: "Olivia P.", service: "Discovery" },
    { day: 20, time: "9 AM", name: "Kevin Q.", service: "Review" },
  ],
  [
    { day: 23, time: "10 AM", name: "Laura V.", service: "Consultation" },
    { day: 23, time: "3 PM", name: "Daniel A.", service: "Strategy Call" },
    { day: 24, time: "9 AM", name: "Sophie E.", service: "Onboarding" },
    { day: 25, time: "2 PM", name: "Marcus I.", service: "Follow-up" },
    { day: 26, time: "11 AM", name: "Julia O.", service: "Discovery" },
    { day: 27, time: "1 PM", name: "Alex U.", service: "Review" },
  ],
];

const chatScripts = [
  { from: "customer" as const, text: "Hi, I'd like to schedule a consultation this week." },
  { from: "ai" as const, text: "Of course! I have Monday the 2nd at 9 AM available. Shall I book that?" },
  { from: "customer" as const, text: "That works perfectly!" },
  { from: "ai" as const, text: "Done! You're booked for Monday the 2nd at 9 AM ✅" },
];

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SchedulingDemo() {
  const [bookedAppointments, setBookedAppointments] = useState<Appointment[]>([]);
  const [chatMessages, setChatMessages] = useState<number>(0);
  const [activeBooking, setActiveBooking] = useState<Appointment | null>(null);
  const [isRinging, setIsRinging] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];

    const runCycle = () => {
      setBookedAppointments([]);
      setChatMessages(0);
      setActiveBooking(null);
      setIsRinging(false);

      const scheduleWave = (waveIndex: number, baseDelay: number) => {
        const wave = appointmentWaves[waveIndex];
        if (!wave) return;

        timers.push(setTimeout(() => setIsRinging(true), baseDelay));
        timers.push(setTimeout(() => setIsRinging(false), baseDelay + 800));

        if (waveIndex === 0) {
          chatScripts.forEach((_, i) => {
            timers.push(setTimeout(() => setChatMessages(i + 1), baseDelay + 400 + i * 900));
          });
        }

        wave.forEach((apt, i) => {
          const delay = baseDelay + 600 + i * 500;
          timers.push(setTimeout(() => {
            setActiveBooking(apt);
            setBookedAppointments(prev => [...prev, apt]);
          }, delay));
        });

        timers.push(setTimeout(() => {
          setActiveBooking(null);
        }, baseDelay + 600 + wave.length * 500 + 400));
      };

      scheduleWave(0, 500);
      scheduleWave(1, 5000);
      scheduleWave(2, 9500);
      scheduleWave(3, 14000);
    };

    runCycle();

    const loopInterval = setInterval(() => {
      timers.forEach(clearTimeout);
      timers = [];
      runCycle();
    }, 19000);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(loopInterval);
    };
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [chatMessages]);

  const getAppointmentForDay = (day: number) =>
    bookedAppointments.filter(a => a.day === day);

  const isToday = (day: number) => day === 1;
  const startDay = 6;

  return (
    <div className="relative w-full max-w-5xl mx-auto" data-testid="v6-scheduling-demo">
      <div className="relative">
        <div className="bg-card rounded-2xl border border-border v6-shadow-glow overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-foreground">March 2026</h3>
              <p className="text-xs text-muted-foreground">AI-managed schedule • Auto-booking enabled</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 rounded-full bg-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-soft" />
                {bookedAppointments.length} appointments booked
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-border">
            {dayNames.map(d => (
              <div key={d} className="px-1 py-2 text-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {Array.from({ length: startDay }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[60px] md:min-h-[80px] border-b border-r border-border bg-muted/30" />
            ))}

            {Array.from({ length: 31 }).map((_, i) => {
              const day = i + 1;
              const dayAppts = getAppointmentForDay(day);
              const isActive = activeBooking?.day === day;

              return (
                <div
                  key={day}
                  className={`min-h-[60px] md:min-h-[80px] border-b border-r border-border p-1 transition-colors duration-300 relative ${
                    isActive ? "bg-blue-500/5" : ""
                  } ${isToday(day) ? "bg-secondary/50" : ""}`}
                >
                  <span className={`text-xs font-medium ${
                    isToday(day)
                      ? "w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center"
                      : "text-muted-foreground"
                  }`}>
                    {day}
                  </span>

                  <div className="mt-0.5 space-y-0.5">
                    <AnimatePresence>
                      {dayAppts.map((apt) => {
                        const colorClass = serviceColors[apt.service] || "bg-blue-500/15 text-blue-600 border-blue-500/30";
                        return (
                          <motion.div
                            key={`${apt.day}-${apt.name}`}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                            className={`rounded-md border px-1 py-0.5 text-[9px] md:text-[10px] leading-tight truncate ${colorClass}`}
                          >
                            <span className="font-medium">{apt.time}</span>
                            <span className="hidden lg:inline"> • {apt.name}</span>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0.6 }}
                      animate={{ opacity: 0 }}
                      transition={{ duration: 0.8 }}
                      className="absolute inset-0 bg-blue-500/10 rounded"
                    />
                  )}
                </div>
              );
            })}

            {Array.from({ length: (7 - ((startDay + 31) % 7)) % 7 }).map((_, i) => (
              <div key={`end-${i}`} className="min-h-[60px] md:min-h-[80px] border-b border-r border-border bg-muted/30" />
            ))}
          </div>
        </div>

        {/* AI Chat Widget */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="absolute -bottom-4 -right-2 md:bottom-4 md:right-4 w-72 md:w-80 z-10"
        >
          <div className="bg-card rounded-2xl border border-border v6-shadow-glow-strong overflow-hidden">
            <div className="v6-bg-gradient px-3 py-2.5 flex items-center gap-2">
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                  <MessageSquare className="w-3.5 h-3.5 text-white" />
                </div>
                {isRinging && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 1 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute inset-0 rounded-full border-2 border-white/50"
                  />
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Agency AI</p>
                <p className="text-[10px] text-white/70">
                  {isRinging ? "Incoming call..." : "Online • Booking available"}
                </p>
              </div>
              {isRinging && (
                <motion.div
                  animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
                  transition={{ duration: 0.6, repeat: 2 }}
                  className="ml-auto"
                >
                  <Phone className="w-4 h-4 text-white" />
                </motion.div>
              )}
            </div>

            <div
              ref={chatContainerRef}
              className="p-3 h-36 overflow-y-auto space-y-2 scrollbar-hide"
            >
              <AnimatePresence>
                {chatScripts.slice(0, chatMessages).map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex ${msg.from === "customer" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-2.5 py-1.5 text-[11px] leading-snug ${
                        msg.from === "customer"
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-secondary text-secondary-foreground rounded-bl-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {chatMessages > 0 && chatMessages < 4 && (
                <div className="flex justify-start">
                  <div className="bg-secondary rounded-xl rounded-bl-sm px-3 py-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse-soft" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse-soft" style={{ animationDelay: "200ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse-soft" style={{ animationDelay: "400ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Status Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="mt-12 md:mt-8 flex flex-wrap items-center justify-center gap-4 md:gap-6 text-xs text-muted-foreground"
        data-testid="v6-status-bar"
      >
        <span className="flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-blue-600" /> 24/7 call answering
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-green-600" /> Auto-conflict resolution
        </span>
        <span className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-blue-600" /> SMS confirmations sent
        </span>
      </motion.div>
    </div>
  );
}
