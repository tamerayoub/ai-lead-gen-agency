import { VacancyCalculator } from "@/components/VacancyCalculator";
import { PublicHeader } from "@/components/PublicHeader";
import { ThemeProvider } from "@/components/ThemeProvider";

export default function ROICalculator() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <PublicHeader currentPage="landing" />
        <div className="relative pt-24 pb-12">
          {/* Background decorations matching Landing page */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 -left-8 w-72 h-72 bg-blue-600/8 md:bg-blue-600/15 rounded-full blur-3xl mix-blend-multiply animate-blob"></div>
            <div className="absolute top-0 -right-8 w-72 h-72 bg-sky-400/10 md:bg-sky-400/20 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-10 left-20 w-72 h-72 bg-pink-300/10 md:bg-pink-300/20 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-4000"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 md:bg-primary/10 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-1000"></div>
          </div>

          <div className="relative z-10 container mx-auto">
            <VacancyCalculator />
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
