import { Star } from "lucide-react";

const testimonials = [
  {
    quote: "Lead2Lease transformed how I manage my marketplace listings. I went from missing 30% of inquiries to responding within minutes. My sales are up 40%!",
    author: "Jennifer Walsh",
    role: "Real Estate Investor",
    avatar: "JW",
    rating: 5,
  },
  {
    quote: "The unified inbox is a game-changer. I used to check multiple apps constantly. Now everything's in one place and I never miss a hot lead.",
    author: "Marcus Thompson",
    role: "Car Dealer",
    avatar: "MT",
    rating: 5,
  },
  {
    quote: "Started with the free preview and was blown away by what I was missing. Signed up immediately. Best decision for my business this year.",
    author: "Sarah Kim",
    role: "Furniture Reseller",
    avatar: "SK",
    rating: 5,
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="py-20 lg:py-32 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full mb-4">
            Testimonials
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Loved by Sellers{" "}
            <span className="text-gradient">Everywhere</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Join thousands of marketplace sellers who've transformed their lead management.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial, i) => (
            <div
              key={i}
              className="relative p-6 lg:p-8 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-card group"
              data-testid={`card-testimonial-${i}`}
            >
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, j) => (
                  <Star key={j} className="w-5 h-5 fill-accent text-accent" />
                ))}
              </div>

              <blockquote className="text-foreground leading-relaxed mb-6">
                "{testimonial.quote}"
              </blockquote>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-hero-gradient flex items-center justify-center text-primary-foreground font-semibold">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>

              <div className="absolute top-4 right-6 text-6xl font-serif text-primary/10 leading-none">
                "
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
