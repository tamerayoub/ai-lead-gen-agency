import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MessageSquare, Users, TrendingUp, ArrowRight, Lock, ChevronRight } from "lucide-react";

const mockConversations = [
  {
    id: 1,
    name: "Sarah Mitchell",
    avatar: "SM",
    listing: "2019 Honda Civic - $15,000",
    lastMessage: "Is this still available? I'm very interested and can meet today!",
    time: "2 min ago",
    unread: 3,
    status: "hot",
  },
  {
    id: 2,
    name: "Michael Chen",
    avatar: "MC",
    listing: "Leather Sofa Set - $800",
    lastMessage: "What's the lowest you can go? I can pay cash.",
    time: "15 min ago",
    unread: 1,
    status: "warm",
  },
  {
    id: 3,
    name: "Emily Rodriguez",
    avatar: "ER",
    listing: "iPhone 14 Pro - $650",
    lastMessage: "Can you deliver to 123 Main St? I can add $20 for delivery.",
    time: "1 hour ago",
    unread: 0,
    status: "new",
  },
];

const mockLeads = [
  { name: "Sarah M.", value: "$15,000", status: "Ready to Buy", score: 95 },
  { name: "Michael C.", value: "$800", status: "Negotiating", score: 72 },
  { name: "Emily R.", value: "$650", status: "New Inquiry", score: 45 },
];

export function LivePreview() {
  const [activeTab, setActiveTab] = useState<"messages" | "leads" | "analytics">("messages");

  return (
    <section id="live-preview" className="py-20 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-block px-4 py-1.5 bg-accent/10 text-accent text-sm font-medium rounded-full mb-4">
            Live Preview
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            See What You're Missing
          </h2>
          <p className="text-lg text-muted-foreground">
            This is a preview of what your dashboard could look like. Connect your Facebook account to see your real data.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="bg-card rounded-2xl shadow-card border border-border overflow-hidden">
            <div className="flex border-b border-border">
              {[
                { id: "messages" as const, label: "Messages", icon: MessageSquare, count: 4 },
                { id: "leads" as const, label: "Leads", icon: Users, count: 12 },
                { id: "analytics" as const, label: "Analytics", icon: TrendingUp },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors relative ${
                    activeTab === tab.id
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`button-tab-${tab.id}`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count && (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {tab.count}
                    </span>
                  )}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
              ))}
            </div>

            <div className="p-6">
              {activeTab === "messages" && (
                <div className="space-y-4">
                  {mockConversations.map((conv, i) => (
                    <div
                      key={conv.id}
                      className={`flex items-start gap-4 p-4 rounded-xl transition-all cursor-pointer ${
                        i === 0
                          ? "bg-primary/5 border border-primary/20"
                          : "hover:bg-muted/50"
                      }`}
                      data-testid={`card-conversation-${conv.id}`}
                    >
                      <div className="w-12 h-12 rounded-full bg-hero-gradient flex items-center justify-center text-sm font-semibold text-primary-foreground shrink-0">
                        {conv.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{conv.name}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              conv.status === "hot"
                                ? "bg-destructive/10 text-destructive"
                                : conv.status === "warm"
                                ? "bg-accent/10 text-accent"
                                : "bg-primary/10 text-primary"
                            }`}>
                              {conv.status}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{conv.time}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">{conv.listing}</p>
                        <p className="text-sm text-foreground truncate">{conv.lastMessage}</p>
                      </div>
                      {conv.unread > 0 && (
                        <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-accent-foreground shrink-0">
                          {conv.unread}
                        </div>
                      )}
                      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-3" />
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "leads" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground">
                    <span>Name</span>
                    <span>Value</span>
                    <span>Status</span>
                    <span>Score</span>
                  </div>
                  {mockLeads.map((lead, i) => (
                    <div key={i} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl hover:bg-muted/50 transition-colors items-center" data-testid={`row-lead-${i}`}>
                      <span className="font-medium text-foreground">{lead.name}</span>
                      <span className="text-foreground">{lead.value}</span>
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        lead.status === "Ready to Buy"
                          ? "bg-primary/10 text-primary"
                          : lead.status === "Negotiating"
                          ? "bg-accent/10 text-accent"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {lead.status}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${lead.score}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-foreground w-8">{lead.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "analytics" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Total Leads", value: "127", change: "+12%" },
                      { label: "Response Rate", value: "94%", change: "+5%" },
                      { label: "Avg Response Time", value: "8m", change: "-23%" },
                    ].map((stat, i) => (
                      <div key={i} className="p-4 rounded-xl bg-muted/30 text-center" data-testid={`card-analytics-${i}`}>
                        <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="text-xs text-primary font-medium mt-1">{stat.change}</p>
                      </div>
                    ))}
                  </div>

                  <div className="relative h-48 rounded-xl bg-muted/30 overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Connect to view analytics</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-muted/50 border-t border-border flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                <Lock className="w-4 h-4 inline-block mr-1" />
                Connect your Facebook to unlock all features
              </p>
              <Link href="/register">
                <Button variant="hero" className="group bg-accent-gradient" data-testid="button-connect-facebook">
                  Connect Facebook
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
