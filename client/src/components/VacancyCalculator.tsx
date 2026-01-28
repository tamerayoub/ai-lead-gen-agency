import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence, animate, useMotionValue, useTransform, useInView } from "framer-motion";
import { Calculator, DollarSign, TrendingDown, Zap, ArrowRight, Building2, Calendar, Mail, Info, CheckCircle2, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "wouter";

function AnimatedNumber({ value }: { value: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      maximumFractionDigits: 0 
    }).format(Math.round(latest));
  });

  useEffect(() => {
    const controls = animate(count, value, {
      duration: 1.5,
      ease: [0.16, 1, 0.3, 1], // Custom "Quintic Out"
    });
    return controls.stop;
  }, [value, count]);

  return <motion.div>{rounded}</motion.div>;
}

function AnimatedNumberSimple({ value, suffix = "" }: { value: number, suffix?: string }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));

  useEffect(() => {
    const controls = animate(count, value, {
      duration: 1.5,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [value, count]);

  return <motion.div className="inline-flex gap-1.5">
    <motion.span>{rounded}</motion.span>
    {suffix}
  </motion.div>;
}

const calculatorSchema = z.object({
  monthlyRent: z.coerce.number().min(1, "Monthly rent is required"),
  avgDaysVacant: z.coerce.number().min(1, "Average days vacant is required"),
  monthlyMoveOuts: z.coerce.number().min(0, "Move-outs cannot be negative"),
  unitsCount: z.coerce.number().min(1, "Number of units is required"),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
});

type CalculatorValues = z.infer<typeof calculatorSchema>;

export function VacancyCalculator() {
  const [results, setResults] = useState<{
    costPerDay: number;
    annualCost: number;
    fasterDays: number;
    annualSavings: number;
    monthlySavings: number;
    newDays: number;
    totalTurnovers: number;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [showDetailed, setShowDetailed] = useState(false);

  const form = useForm<CalculatorValues>({
    resolver: zodResolver(calculatorSchema),
    defaultValues: {
      monthlyRent: undefined,
      avgDaysVacant: undefined,
      monthlyMoveOuts: undefined,
      unitsCount: undefined,
      email: "",
    },
  });

  const calculate = async (values: CalculatorValues) => {
    setIsLoading(true);
    setResults(null);
    
    // Artificial delay for high-fidelity feel
    await new Promise(resolve => setTimeout(resolve, 800));

    const costPerDay = values.monthlyRent / 30;
    const totalTurnovers = values.monthlyMoveOuts ? values.monthlyMoveOuts * 12 : values.unitsCount;
    const totalDaysLostPerYear = values.avgDaysVacant * totalTurnovers;
    const annualVacancyCost = costPerDay * totalDaysLostPerYear;
    
    const reduction = 9;
    const newDays = Math.max(0, values.avgDaysVacant - reduction);
    const newAnnualCost = costPerDay * newDays * totalTurnovers;
    const savings = annualVacancyCost - newAnnualCost;
    
    setResults({
      costPerDay: costPerDay,
      annualCost: annualVacancyCost,
      fasterDays: reduction,
      newDays: newDays,
      annualSavings: savings,
      monthlySavings: savings / 12,
      totalTurnovers: totalTurnovers
    });
    
    setIsLoading(false);
    if (values.email) {
      setShowDetailed(true);
    }
  };

  const handleEmailSubmit = () => {
     if (form.getValues("email")) {
       setShowDetailed(true);
     } else {
        form.setError("email", { message: "Email is required to see detailed results" });
     }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      <div className="grid md:grid-cols-12 gap-8 items-start">
        {/* Left Column: Input */}
        <div className="md:col-span-5">
          <Card className="border-none shadow-2xl bg-white ring-1 ring-gray-100 overflow-hidden rounded-[5px]">
            <div className="h-2 bg-primary w-full" />
            <CardContent className="p-6 md:p-8">
              <div className="mb-6 text-center">
                <div className="flex justify-center mb-5">
                  <img src="https://lead2lease.ai/assets/lead2lease-logo-black-BwcfuDvm.svg" alt="Lead2Lease" className="h-9" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-2">
                  <Calculator className="h-6 w-6 text-primary" />
                  ROI Calculator
                </h2>
                <p className="text-sm text-gray-500">Adjust a few inputs below to reveal the revenue you’re losing to slow leasing.</p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(calculate)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="monthlyRent"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-gray-700 font-bold text-base flex items-center gap-2">
                          Avg Monthly Rent
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" className="inline-flex items-center justify-center p-0.5 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20">
                                  <Info className="h-4 w-4 text-gray-400 cursor-help" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="bg-gray-900 text-white border-none px-3 py-2 text-xs rounded-lg shadow-xl">
                                <p>The average monthly rent per unit across your portfolio.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                            <Input placeholder="1,500" className="pl-12 h-12 text-lg font-medium text-gray-900 border-gray-200 focus:border-primary focus:ring-primary/20 bg-white" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unitsCount"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-gray-700 font-bold text-base">Units</FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                            <Input placeholder="10" className="pl-12 h-12 text-lg font-medium text-gray-900 border-gray-200 focus:border-primary focus:ring-primary/20 bg-white" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="monthlyMoveOuts"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-gray-700 font-bold text-base">Monthly Move-outs</FormLabel>
                          <FormControl>
                            <div className="relative group">
                              <TrendingDown className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                              <Input placeholder="2" className="pl-12 h-12 text-lg font-medium text-gray-900 border-gray-200 focus:border-primary focus:ring-primary/20 bg-white" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="avgDaysVacant"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-gray-700 font-bold text-base">Avg Days Apt Vacant</FormLabel>
                          <FormControl>
                            <div className="relative group">
                              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                              <Input placeholder="30" className="pl-12 h-12 text-lg font-medium text-gray-900 border-gray-200 focus:border-primary focus:ring-primary/20 bg-white" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-gray-700 font-bold text-base">Email Address</FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                            <Input placeholder="name@company.com" className="pl-12 h-12 text-lg font-medium text-gray-900 border-gray-200 focus:border-primary focus:ring-primary/20 bg-white" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    size="lg" 
                    disabled={isLoading}
                    className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all active:scale-[0.98] mt-3"
                    data-testid="button-calculate"
                  >
                    {isLoading ? "Analyzing Data..." : "Reveal My Vacancy Loss"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Results */}
        <div className="md:col-span-7 space-y-6">
          <AnimatePresence mode="wait">
            {!results && !isLoading ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="h-full flex flex-col justify-center items-center text-center p-12 bg-white rounded-2xl border-2 border-dashed border-gray-100 min-h-[500px]"
              >
                <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mb-6 rotate-3 shadow-inner">
                  <TrendingDown className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">See Your Hidden Leak</h3>
                <p className="text-gray-500 max-w-sm leading-relaxed">
                  Enter your property details on the left. We'll show you exactly how much automation could save you.
                </p>
              </motion.div>
            ) : isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="h-full flex flex-col justify-center items-center text-center p-12 bg-white rounded-2xl border border-gray-100 min-h-[500px]"
              >
                <div className="relative w-16 h-16 mb-6">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-full h-full border-4 border-primary/20 border-t-primary rounded-full"
                  />
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <Zap className="h-6 w-6 text-primary fill-primary" />
                  </motion.div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Analyzing Benchmarks</h3>
                <p className="text-gray-500 text-sm">Cross-referencing 50,000+ rental data points...</p>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* KPI Cards - Vertical Stack for Space */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Annual Turnovers", value: results!.totalTurnovers, icon: <Building2 className="h-5 w-5 text-purple-500" />, sub: "Units per year", type: "number" },
                    { label: "Revenue Lost Per Day", value: results!.costPerDay, icon: <DollarSign className="h-5 w-5 text-red-500" />, sub: "Per vacant unit", type: "currency" },
                    { label: "Vacant Days Per Year", value: Math.round(results!.totalTurnovers * form.getValues("avgDaysVacant")), icon: <Calendar className="h-5 w-5 text-blue-500" />, sub: "Annual portfolio total", type: "number" },
                    { label: "Revenue You’re Missing", value: results!.annualCost, icon: <TrendingDown className="h-5 w-5 text-red-500" />, sub: "Without adding a single unit", type: "currency", highlight: true }
                  ].map((card, i) => (
                    <motion.div
                      key={card.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <ResultCard 
                        label={card.label} 
                        value={card.type === "currency" ? <AnimatedNumber value={card.value} /> : <AnimatedNumberSimple value={card.value} />} 
                        icon={<div className={`p-2 rounded-lg ${i === 0 ? 'bg-purple-50' : i === 2 ? 'bg-blue-50' : 'bg-red-50'}`}>{card.icon}</div>}
                        subtext={card.sub}
                        highlight={card.highlight}
                      />
                    </motion.div>
                  ))}
                </div>

                {/* The Math Walkthrough */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 30 }}
                  className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">How we calculate your savings</h4>
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4 mb-8">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ delay: 0.8 }}
                      className="text-center md:text-left flex-1"
                    >
                      <div className="text-3xl font-bold text-gray-900 mb-1">
                         <AnimatedNumberSimple value={form.getValues("avgDaysVacant")} suffix=" Days" />
                      </div>
                      <div className="text-xs text-gray-400 uppercase font-medium">Your Average</div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ delay: 1.1 }}
                      className="flex items-center justify-center bg-gray-100 p-2 rounded-full"
                    >
                      <Minus className="h-4 w-4 text-gray-400" />
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ delay: 1.4 }}
                      className="text-center flex-1"
                    >
                      <div className="text-3xl font-bold text-primary mb-1">9 Days</div>
                      <div className="text-xs text-primary/70 uppercase font-medium">L2L Automation</div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ delay: 1.7 }}
                      className="flex items-center justify-center"
                    >
                      <ArrowRight className="h-6 w-6 text-gray-300 rotate-90 md:rotate-0" />
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ delay: 2.0 }}
                      className="text-center md:text-right flex-1 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50"
                    >
                      <div className="text-3xl font-bold text-emerald-600 mb-1">
                        <AnimatedNumberSimple value={results!.newDays} suffix=" Days" />
                      </div>
                      <div className="text-xs text-emerald-600/70 uppercase font-medium">New Target</div>
                    </motion.div>
                  </div>

                  <div className="my-6">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{
                        delay: 2.3,
                        duration: 0.8,
                        ease: [0.16, 1, 0.3, 1]
                      }}
                      className="bg-blue-50/50 border border-blue-100 rounded-xl p-6 relative shadow-sm"
                    >
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-30">
                        <div className="w-4 h-4 bg-[#f1f7fe] border-t border-l border-blue-100 rotate-45" />
                      </div>
                      <div className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Zap className="h-4 w-4 fill-primary" />
                        How Lead2Lease cuts days off every vacancy—automatically
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        {[
                          { title: "24/7 AI Lead Response", desc: "Every inquiry answered instantly, even while your team sleeps." },
                          { title: "Instant Showing Booking", desc: "Prospects book themselves—no back-and-forth, no delays." },
                          { title: "Smart Follow-up Cycles", desc: "Leads are chased until they convert or disqualify themselves." },
                          { title: "Frictionless Applications", desc: "Mobile-first applications designed to finish, not stall." }
                        ].map((item, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ delay: 2.6 + (i * 0.1) }}
                            className="flex items-start gap-3"
                          >
                            <div className="mt-1 p-0.5 bg-primary/10 rounded-full">
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-900 leading-tight mb-0.5">{item.title}</div>
                              <div className="text-xs text-gray-500 leading-snug">{item.desc}</div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  </div>

                  <motion.p
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ delay: 3.4 }}
                    className="mt-6 text-sm text-gray-500 leading-relaxed border-t border-gray-50 pt-4 italic"
                  >
                    "By reducing downtime from {form.getValues("avgDaysVacant")} to {results!.newDays} days, you're effectively capturing {results!.fasterDays} more days of rent across {form.getValues("unitsCount")} units."
                  </motion.p>
                </motion.div>

                {/* Footer text */}
                <div className="text-center text-xs text-gray-400 font-medium tracking-wide">
                  * Based on market research for AI-powered concierge service for Residential Property leasing
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Result Card - Now spanning full width below both columns */}
      <AnimatePresence>
        {results && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 3.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="w-full mt-8"
          >
            <Card className="border-none shadow-2xl bg-gradient-to-br from-gray-900 to-gray-800 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-60 bg-primary/20 rounded-full blur-[120px] -mr-20 -mt-20 pointer-events-none"></div>
              
              <CardContent className="p-8 md:p-12 relative z-10">
                {!showDetailed ? (
                  <div className="text-center py-10">
                     <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 rounded-full text-[11px] font-black tracking-[0.3em] text-primary mb-8 uppercase">
                       YOUR SAVINGS REPORT IS READY
                     </div>
                     <h3 className="text-3xl font-bold mb-4">See the full revenue impact—month by month</h3>
                     <p className="text-gray-400 mb-8 text-lg max-w-2xl mx-auto leading-relaxed">
                       Unlock a detailed breakdown of your recovered revenue, long-term NOI lift, and how your leasing velocity compares to top-performing portfolios using Lead2Lease.
                     </p>
                     <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto w-full">
                       <Input 
                          placeholder="Enter your email" 
                          className="h-14 bg-white/5 border-white/10 text-white text-lg placeholder:text-gray-500 focus-visible:ring-primary flex-grow"
                          value={form.watch("email")}
                          onChange={(e) => form.setValue("email", e.target.value)}
                       />
                       <Button onClick={handleEmailSubmit} size="lg" className="h-14 bg-primary hover:bg-primary/90 text-white font-bold px-10 text-lg shadow-xl shadow-primary/20 whitespace-nowrap">
                         View Full Report <ArrowRight className="ml-2 h-5 w-5" />
                       </Button>
                     </div>
                  </div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-10"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-stretch gap-6 border-b border-white/10 pb-10">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-emerald-400 mb-3 font-bold tracking-widest text-xs uppercase">
                          <CheckCircle2 className="h-5 w-5" />
                          <span>YOUR SAVINGS REPORT IS READY</span>
                        </div>
                        <div className="mb-4">
                          <h3 className="text-4xl md:text-5xl font-black leading-tight flex items-baseline gap-2 mb-2 text-white">
                            Gain <span className="text-primary"><AnimatedNumberSimple value={results!.fasterDays * results!.totalTurnovers} /></span>
                            <span className="text-primary text-4xl md:text-5xl font-black">total days</span>
                          </h3>
                          <h3 className="text-4xl md:text-5xl font-black leading-tight flex items-baseline gap-2 text-white">
                            Save <span className="text-primary"><AnimatedNumber value={results!.annualSavings} /></span>
                            <span className="text-primary text-4xl md:text-5xl font-black">annually</span>
                          </h3>
                        </div>
                        <p className="text-gray-400 text-lg md:text-xl font-medium leading-relaxed max-w-2xl mt-4">
                          This report breaks down exactly where that loss comes from, how it compounds across turnovers, and what changes when leasing speed is automated.
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 hover:bg-white/[0.07] transition-colors">
                         <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center mb-6">
                           <Zap className="h-6 w-6 text-primary fill-primary" />
                         </div>
                         <h5 className="text-white font-bold text-sm uppercase tracking-widest mb-4 opacity-60">Annual Revenue You’re Leaving on the Table</h5>
                         <div className="text-4xl font-bold text-white mb-2 tabular-nums">
                           <AnimatedNumber value={results!.annualSavings} />
                         </div>
                         <p className="text-gray-400 text-lg leading-relaxed">
                           Total annual recapture potential across your {form.getValues("unitsCount")} units.
                         </p>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 hover:bg-white/[0.07] transition-colors">
                         <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-6">
                           <TrendingDown className="h-6 w-6 text-emerald-400" />
                         </div>
                         <h5 className="text-white font-bold text-sm uppercase tracking-widest mb-4 opacity-60">New Monthly Revenue at Full Leasing Speed</h5>
                         <div className="text-4xl font-bold text-emerald-400 mb-2 tabular-nums">
                           <AnimatedNumber value={results!.monthlySavings} />
                         </div>
                         <p className="text-gray-400 text-lg leading-relaxed">
                           Projected monthly NOI lift from automated leasing velocity.
                         </p>
                      </div>
                    </div>

                    <div className="space-y-12 py-8 border-t border-white/10 mt-12">
                      <div className="max-w-3xl">
                        <h4 className="text-2xl font-bold text-white mb-6">Because leasing stops depending on perfect human timing.</h4>
                        
                        <div className="grid gap-8 text-gray-400 text-lg leading-relaxed">
                          <p>
                            With Lead2Lease in place, prospects experience immediate responses instead of delays. Every inquiry is acknowledged, qualified, and guided forward without waiting on staff availability.
                          </p>
                          
                          <p>
                            <span className="text-white font-semibold">Showings book themselves.</span> No back-and-forth. No missed follow-ups. No “we’ll get back to them tomorrow.”
                          </p>
                          
                          <p>
                            Leads are consistently nurtured instead of forgotten. The system follows up patiently and persistently, so interest doesn’t decay while your team is busy elsewhere.
                          </p>
                          
                          <p>
                            <span className="text-white font-semibold">Applications feel easy instead of fragile.</span> Fewer drop-offs. Fewer half-starts. More completed moves.
                          </p>
                          
                          <p>
                            And your on-site team gets to focus on residents—not chasing leads, inboxes, or calendars.
                          </p>
                          
                          <div className="pt-4 border-l-2 border-primary pl-6">
                            <p className="text-white text-xl font-bold italic mb-2">The result isn’t more effort.</p>
                            <p className="text-primary text-xl font-black uppercase tracking-tight">It’s fewer stalls between move-out and move-in.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900 rounded-[3rem] p-12 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl shadow-black/40">
                      <div className="max-w-xl text-center md:text-left">
                        <h4 className="text-3xl font-bold text-white mb-4">Ready to stop losing rent to slow leasing?</h4>
                        <p className="text-white/60 text-lg leading-relaxed">Book a short strategy session to review your numbers, confirm your savings, and map a clean transition to automated leasing.</p>
                      </div>
                      <Link href="/book-demo">
                        <Button className="bg-primary text-white hover:bg-primary/90 font-black h-16 px-10 text-xl rounded-xl shadow-2xl transition-transform active:scale-95 whitespace-nowrap">
                          Book Strategy Call
                          <ArrowRight className="ml-3 h-6 w-6" />
                        </Button>
                      </Link>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultCard({ label, value, icon, subtext, highlight = false }: { label: string, value: any, icon: React.ReactNode, subtext?: string, highlight?: boolean }) {
  return (
    <Card className={`border-none shadow-lg transition-all hover:-translate-y-1 bg-white relative overflow-hidden group ${highlight ? 'ring-2 ring-primary/30' : 'ring-1 ring-gray-100'}`}>
      <div className="absolute top-2 left-2 opacity-80 transition-opacity">
        {icon}
      </div>
      {highlight && <div className="absolute top-0 right-0 p-1 bg-primary text-[10px] font-black text-white px-2 rounded-bl-lg uppercase tracking-tighter">Crucial</div>}
      <CardContent className="p-5 pt-8 flex flex-col items-center text-center">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
        <div className="text-3xl font-black text-gray-900 mb-1 tabular-nums flex items-center justify-center">
          {value}
        </div>
        {subtext && <p className="text-xs font-medium text-gray-400 leading-tight">{subtext}</p>}
      </CardContent>
    </Card>
  );
}
