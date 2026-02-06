import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MessageSquare, Users, TrendingUp, ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-hero-gradient">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-foreground rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary-foreground rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10 mx-auto px-4 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              <span className="text-sm font-medium text-primary-foreground">New: AI-Powered Lead Scoring</span>
            </div>

            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground leading-tight mb-6">
              Turn Facebook Marketplace Into Your{" "}
              <span className="relative">
                Lead Machine
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
                  <path d="M2 10C50 4 150 4 198 10" stroke="hsl(var(--accent))" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              </span>
            </h1>

            <p className="text-lg md:text-xl text-primary-foreground/80 mb-8 max-w-xl mx-auto lg:mx-0">
              Automatically capture, organize, and respond to every Facebook Marketplace inquiry. See your leads in action—no signup required.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/register">
                <Button variant="hero" size="xl" className="group bg-accent-gradient" data-testid="button-hero-cta">
                  See Your Leads Now
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/#live-preview">
                <Button variant="heroOutline" size="xl" className="border-primary-foreground/20 text-primary-foreground backdrop-blur-sm" data-testid="button-hero-demo">
                  Watch Demo
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-6 mt-12 pt-8 border-t border-primary-foreground/20">
              {[
                { icon: MessageSquare, value: "10K+", label: "Messages Synced" },
                { icon: Users, value: "2.5K", label: "Active Users" },
                { icon: TrendingUp, value: "340%", label: "Lead Increase" },
              ].map((stat, i) => (
                <div key={i} className="text-center lg:text-left">
                  <stat.icon className="w-5 h-5 text-accent mx-auto lg:mx-0 mb-2" />
                  <div className="font-display text-2xl font-bold text-primary-foreground" data-testid={`text-stat-value-${i}`}>{stat.value}</div>
                  <div className="text-sm text-primary-foreground/60">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <div className="relative bg-card rounded-2xl shadow-2xl overflow-hidden border border-border/50">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted border-b border-border">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 rounded-full bg-background text-xs text-muted-foreground">
                    lead2lease.ai/inbox
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-foreground">Inbox</h3>
                  <span className="px-2 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">
                    4 new
                  </span>
                </div>

                <div className="space-y-3">
                  {[
                    { name: "Sarah Mitchell", message: "Is this still available? I'm very interested!", time: "2m ago", unread: true },
                    { name: "Michael Chen", message: "What's the lowest you can go? Cash ready.", time: "15m ago", unread: true },
                    { name: "Emily Rodriguez", message: "Can you deliver to 123 Main St?", time: "1h ago", unread: false },
                  ].map((msg, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                      <div className="w-10 h-10 rounded-full bg-hero-gradient flex items-center justify-center text-xs font-semibold text-primary-foreground shrink-0">
                        {msg.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm ${msg.unread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                            {msg.name}
                          </span>
                          <span className="text-xs text-muted-foreground">{msg.time}</span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{msg.message}</p>
                      </div>
                      {msg.unread && (
                        <div className="w-2 h-2 rounded-full bg-accent mt-2" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="relative mt-4">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background z-10" />
                  <div className="opacity-50 blur-sm">
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                      <div className="w-10 h-10 rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-muted rounded w-24" />
                        <div className="h-3 bg-muted rounded w-full" />
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <Link href="/register">
                      <Button variant="hero" size="default" className="bg-accent-gradient" data-testid="button-unlock-messages">
                        Unlock All Messages
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -top-4 -right-4 p-4 bg-card rounded-xl shadow-card border border-border animate-float">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">New Leads</div>
                  <div className="font-display font-bold text-foreground">+12 today</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
