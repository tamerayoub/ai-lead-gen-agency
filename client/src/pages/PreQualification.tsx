import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Building2, Home, Settings, AlertCircle, XCircle, DollarSign, CreditCard, History, Shield, Briefcase, Users, Dog, Lock } from "lucide-react";
import type { QualificationTemplate, QualificationQuestion, Property } from "@shared/schema";
import type { QualificationCriteria, QualificationSettings, QualificationType } from "./Qualifications";

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Predefined questions for each qualification type
const PREDEFINED_QUESTIONS: Record<QualificationType, QualificationQuestion[]> = {
  income: [
    {
      id: "income-monthly",
      type: "number",
      question: "What is your monthly income?",
      required: true,
      enabled: true,
      order: 0,
      isDealBreaker: false, // Will be set from qualification
    },
  ],
  credit_score: [
    {
      id: "credit-score",
      type: "number",
      question: "What is your credit score? (approximate)",
      required: true,
      enabled: true,
      order: 0,
      isDealBreaker: false, // Will be set from qualification
    },
  ],
  rental_history: [
    {
      id: "rental-evictions",
      type: "boolean",
      question: "Have you been evicted in the past 5 years?",
      required: true,
      enabled: true,
      order: 0,
      isDealBreaker: false, // Will be set from qualification
      validation: { expectedAnswer: false },
    },
    {
      id: "rental-years",
      type: "number",
      question: "How many years of rental history do you have?",
      required: false,
      enabled: true,
      order: 1,
      isDealBreaker: false,
    },
  ],
  criminal_history: [
    {
      id: "criminal-felony",
      type: "boolean",
      question: "Do you have any felony convictions?",
      required: true,
      enabled: true,
      order: 0,
      isDealBreaker: false, // Will be set from qualification
      validation: { expectedAnswer: false },
    },
  ],
  employment: [
    {
      id: "employment-months",
      type: "number",
      question: "How long have you been employed at your current job? (months)",
      required: true,
      enabled: true,
      order: 0,
      isDealBreaker: false, // Will be set from qualification
    },
  ],
  occupants: [
    {
      id: "occupants-count",
      type: "number",
      question: "How many people will be living in the unit?",
      required: true,
      enabled: true,
      order: 0,
      isDealBreaker: false, // Will be set from qualification
    },
  ],
  pets: [
    {
      id: "pets-have",
      type: "boolean",
      question: "Do you have any pets?",
      required: true,
      enabled: true,
      order: 0,
      isDealBreaker: false, // Will be set from qualification
    },
  ],
  security_deposit: [
    {
      id: "deposit-ability",
      type: "boolean",
      question: "Are you able to pay the security deposit?",
      required: true,
      enabled: true,
      order: 0,
      isDealBreaker: false, // Will be set from qualification
      validation: { expectedAnswer: true },
    },
  ],
};

const QUALIFICATION_TYPE_INFO: Record<QualificationType, { label: string; icon: any; description: string }> = {
  income: {
    label: "Income Requirements",
    icon: DollarSign,
    description: "Monthly income requirements",
  },
  credit_score: {
    label: "Credit Score",
    icon: CreditCard,
    description: "Minimum credit score",
  },
  rental_history: {
    label: "Rental History",
    icon: History,
    description: "Rental history requirements",
  },
  criminal_history: {
    label: "Criminal History",
    icon: Shield,
    description: "Criminal history policy",
  },
  employment: {
    label: "Employment",
    icon: Briefcase,
    description: "Employment duration requirements",
  },
  occupants: {
    label: "Number of Occupants",
    icon: Users,
    description: "Maximum number of occupants",
  },
  pets: {
    label: "Pets",
    icon: Dog,
    description: "Pet policy",
  },
  security_deposit: {
    label: "Security Deposit",
    icon: Lock,
    description: "Security deposit requirements",
  },
};

export default function PreQualification() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("organization");

  // Fetch qualification settings (criteria/standards)
  const { data: orgQualificationSettings } = useQuery<QualificationSettings | null>({
    queryKey: ["/api/qualification-settings/org"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/qualification-settings/org");
        return await res.json();
      } catch {
        return null;
      }
    },
  });

  const { data: propertyQualificationSettings = [] } = useQuery<Array<QualificationSettings & { propertyId: string }>>({
    queryKey: ["/api/qualification-settings/properties"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/qualification-settings/properties");
        return await res.json();
      } catch {
        return [];
      }
    },
  });

  // Fetch qualification templates (questions)
  const { data: orgTemplate } = useQuery<QualificationTemplate | null>({
    queryKey: ["/api/qualification-templates/org"],
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  const { data: propertyTemplates = [] } = useQuery<QualificationTemplate[]>({
    queryKey: ["/api/qualification-templates"],
    select: (templates) => templates.filter((t: QualificationTemplate) => t.propertyId && !t.listingId),
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: Partial<QualificationTemplate>) => {
      const res = await apiRequest("POST", "/api/qualification-templates", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qualification-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qualification-templates/org"] });
      toast({
        title: "Questions saved",
        description: "Pre-qualification questions have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save questions",
        variant: "destructive",
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<QualificationTemplate> }) => {
      const res = await apiRequest("PATCH", `/api/qualification-templates/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qualification-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qualification-templates/org"] });
      toast({
        title: "Questions updated",
        description: "Pre-qualification questions have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update questions",
        variant: "destructive",
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/qualification-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qualification-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/qualification-templates/org"] });
      toast({
        title: "Questions removed",
        description: "Pre-qualification questions have been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove questions",
        variant: "destructive",
      });
    },
  });

  // Get enabled qualifications from settings
  const orgQualifications = useMemo(() => {
    if (!orgQualificationSettings?.qualifications) return [];
    return (orgQualificationSettings.qualifications as QualificationCriteria[]).filter(q => q.enabled);
  }, [orgQualificationSettings]);

  // Generate questions from qualifications
  const generateQuestionsFromQualifications = (qualifications: QualificationCriteria[]): QualificationQuestion[] => {
    const questions: QualificationQuestion[] = [];
    
    qualifications.forEach((qual) => {
      const predefined = PREDEFINED_QUESTIONS[qual.type] || [];
      predefined.forEach((q) => {
        questions.push({
          ...q,
          id: `${qual.id}-${q.id}`,
          isDealBreaker: qual.isDealBreaker, // Inherit deal-breaker from qualification
        });
      });
    });

    return questions;
  };

  // Initialize template with questions from qualifications
  const initializeTemplate = (qualifications: QualificationCriteria[], existingTemplate?: QualificationTemplate | null) => {
    const generatedQuestions = generateQuestionsFromQualifications(qualifications);
    
    // Merge with existing questions (preserve enabled state)
    if (existingTemplate?.questions) {
      const existingQuestions = existingTemplate.questions as QualificationQuestion[];
      const mergedQuestions = generatedQuestions.map((newQ) => {
        const existing = existingQuestions.find((eq) => eq.id === newQ.id);
        return existing ? { ...newQ, enabled: existing.enabled } : newQ;
      });
      return mergedQuestions;
    }

    return generatedQuestions;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Pre-Showing Qualification
          </h1>
          <p className="text-muted-foreground">
            Select which questions to ask leads based on your qualification criteria
          </p>
        </div>
      </div>

      {!orgQualificationSettings && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No qualification criteria set</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Please set up your qualification criteria in the Qualifications section first
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {orgQualificationSettings && (
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="organization" className="gap-2">
            <Building2 className="h-4 w-4" />
            Organization Default
          </TabsTrigger>
          <TabsTrigger value="properties" className="gap-2">
            <Home className="h-4 w-4" />
            Property Overrides
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="space-y-4">
            <PreQualificationEditor
              qualifications={orgQualifications}
                  template={orgTemplate}
              onSave={(data) => {
                if (orgTemplate) {
                  updateTemplateMutation.mutate({ id: orgTemplate.id, data });
                } else {
                  createTemplateMutation.mutate({
                    ...data,
                    propertyId: null,
                    listingId: null,
                  });
                }
              }}
              isSaving={updateTemplateMutation.isPending || createTemplateMutation.isPending}
              onDelete={orgTemplate ? () => deleteTemplateMutation.mutate(orgTemplate.id) : undefined}
            />
        </TabsContent>

        <TabsContent value="properties" className="space-y-4">
          <Card>
            <CardHeader>
                <CardTitle>Property Pre-Qualification Overrides</CardTitle>
              <CardDescription>
                Override the organization questions for specific properties
              </CardDescription>
            </CardHeader>
            <CardContent>
              {properties.length === 0 ? (
                <div className="text-center py-8">
                  <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No properties</h3>
                  <p className="text-sm text-muted-foreground">
                    Add properties first to configure property-specific questions
                  </p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {properties.map((property) => {
                      const propertyQualSettings = propertyQualificationSettings.find(ps => ps.propertyId === property.id);
                    const propertyTemplate = propertyTemplates.find(t => t.propertyId === property.id);
                      const propertyQualifications = propertyQualSettings?.qualifications 
                        ? (propertyQualSettings.qualifications as QualificationCriteria[]).filter(q => q.enabled)
                        : orgQualifications; // Fall back to org if no property override

                    return (
                      <AccordionItem key={property.id} value={property.id}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3">
                            <Building2 className="h-4 w-4" />
                            <span>{property.name}</span>
                              {propertyQualSettings ? (
                                <Badge variant="default">Custom Criteria</Badge>
                            ) : (
                              <Badge variant="secondary">Using Organization Default</Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4">
                            {propertyQualSettings || orgQualificationSettings ? (
                              <PreQualificationEditor
                                qualifications={propertyQualifications}
                              template={propertyTemplate}
                                onSave={(data) => {
                                  if (propertyTemplate) {
                                    updateTemplateMutation.mutate({ id: propertyTemplate.id, data });
                                  } else {
                                    createTemplateMutation.mutate({
                                      ...data,
                                      propertyId: property.id,
                                      listingId: null,
                                    });
                                  }
                                }}
                                isSaving={updateTemplateMutation.isPending || createTemplateMutation.isPending}
                                onDelete={propertyTemplate ? () => deleteTemplateMutation.mutate(propertyTemplate.id) : undefined}
                            />
                          ) : (
                            <div className="text-center py-4">
                              <p className="text-sm text-muted-foreground mb-4">
                                  No qualification criteria set for this property
                                </p>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}

interface PreQualificationEditorProps {
  qualifications: QualificationCriteria[];
  template?: QualificationTemplate | null;
  onSave: (data: Partial<QualificationTemplate>) => void;
  isSaving: boolean;
  onDelete?: () => void;
}

function PreQualificationEditor({ qualifications, template, onSave, isSaving, onDelete }: PreQualificationEditorProps) {
  const [introMessage, setIntroMessage] = useState(template?.introMessage || "Please answer the following questions to help us determine if this property is a good fit for you.");
  const [successMessage, setSuccessMessage] = useState(template?.successMessage || "Congratulations! You meet our initial qualification criteria. You can now proceed with booking a showing.");
  const [failureMessage, setFailureMessage] = useState(template?.failureMessage || "Unfortunately, based on your responses, this property may not be the right fit at this time. Please contact us if you have questions.");
  const [allowRetry, setAllowRetry] = useState(template?.allowRetry ?? true);
  const [retryDelayMinutes, setRetryDelayMinutes] = useState(template?.retryDelayMinutes ?? 1440);
  const [showResultsImmediately, setShowResultsImmediately] = useState(template?.showResultsImmediately ?? true);
  const [allMustPass, setAllMustPass] = useState(template?.allMustPass ?? false);

  // Generate questions from qualifications and merge with existing template
  // Only include questions that match current qualifications (to remove old questions)
  const initialQuestions = useMemo(() => {
    const generated: QualificationQuestion[] = [];
    
    qualifications.forEach((qual) => {
      const predefined = PREDEFINED_QUESTIONS[qual.type] || [];
      predefined.forEach((q) => {
        const questionId = `${qual.id}-${q.id}`;
        // Only check existing template if the question ID matches the current qualification structure
        const existing = template?.questions 
          ? (template.questions as QualificationQuestion[]).find((eq) => eq.id === questionId)
          : null;
        
        generated.push({
          ...q,
          id: questionId,
          isDealBreaker: qual.isDealBreaker, // Inherit from qualification
          enabled: existing?.enabled ?? q.enabled, // Preserve enabled state if question exists
        });
      });
    });

    // Only return questions that match current qualifications (remove any old questions)
    return generated;
  }, [qualifications, template]);

  const [questions, setQuestions] = useState<QualificationQuestion[]>(initialQuestions);

  // Update questions when qualifications or template changes
  useEffect(() => {
    setQuestions(initialQuestions);
  }, [initialQuestions]);

  const handleSave = () => {
    // Save all questions that belong to current qualifications (both enabled and disabled)
    // This preserves the enabled/disabled state for each question
    // Only exclude questions that don't match current qualifications (old questions)
    const questionsToSave = questions.filter(q => {
      // Check if this question belongs to a current qualification
      const belongsToCurrentQual = qualifications.some(qual => q.id.startsWith(`${qual.id}-`));
      return belongsToCurrentQual;
      // Note: We save both enabled and disabled questions to preserve state
      // The API endpoint will filter by q.enabled when displaying the form
    });

    onSave({
      name: template?.name || "Pre-Qualification Questions",
      isActive: template?.isActive ?? true,
      introMessage,
      successMessage,
      failureMessage,
      allowRetry,
      retryDelayMinutes,
      showResultsImmediately,
      allMustPass,
      questions: questionsToSave, // Save all questions (enabled and disabled) from current qualifications
    });
  };

  const toggleQuestion = (questionId: string) => {
    setQuestions(prev =>
      prev.map(q => q.id === questionId ? { ...q, enabled: !q.enabled } : q)
    );
  };

  // Group questions by qualification type
  const questionsByQualification = useMemo(() => {
    const grouped: Record<string, QualificationQuestion[]> = {};
    
    qualifications.forEach((qual) => {
      const qualQuestions = questions.filter(q => q.id.startsWith(`${qual.id}-`));
      if (qualQuestions.length > 0) {
        grouped[qual.id] = qualQuestions;
      }
    });

    return grouped;
  }, [questions, qualifications]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Questions */}
        <Card>
          <CardHeader>
            <CardTitle>Pre-Qualification Questions</CardTitle>
            <CardDescription>
              Enable or disable questions to include in the pre-qualification form
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {qualifications.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No qualifications enabled</h3>
                <p className="text-sm text-muted-foreground">
                  Enable qualifications in the Qualifications section to see questions here
                </p>
              </div>
            ) : (
              qualifications.map((qual) => {
                const qualInfo = QUALIFICATION_TYPE_INFO[qual.type];
                const Icon = qualInfo.icon;
                const qualQuestions = questionsByQualification[qual.id] || [];

                if (qualQuestions.length === 0) return null;

                return (
                  <Card key={qual.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold">{qualInfo.label}</h4>
                        {qual.isDealBreaker && (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Deal-breaker
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{qualInfo.description}</p>
                      
                      <div className="space-y-2 pl-6">
                        {qualQuestions.map((question) => (
                          <div key={question.id} className="flex items-center justify-between p-2 rounded border">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{question.question}</p>
                              {question.isDealBreaker && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                  Deal-breaker
                                </Badge>
                              )}
                            </div>
                            <Switch
                              checked={question.enabled}
                              onCheckedChange={() => toggleQuestion(question.id)}
            />
          </div>
                        ))}
          </div>
        </div>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Right: Qualifications */}
        <Card>
          <CardHeader>
            <CardTitle>Qualification Criteria</CardTitle>
            <CardDescription>
              These are the qualification standards set in the Qualifications section
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {qualifications.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No qualifications enabled</h3>
                <p className="text-sm text-muted-foreground">
                  Enable qualifications in the Qualifications section
                </p>
              </div>
            ) : (
              qualifications.map((qual) => {
                const qualInfo = QUALIFICATION_TYPE_INFO[qual.type];
                const Icon = qualInfo.icon;

                return (
                  <Card key={qual.id} className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold">{qualInfo.label}</h4>
                        {qual.isDealBreaker && (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Deal-breaker
                          </Badge>
                        )}
                      </div>
                      
                      {/* Show qualification config */}
                      {qual.type === "income" && qual.config.incomeMultiplier && (
                        <p className="text-sm text-muted-foreground">
                          Minimum: {qual.config.incomeMultiplier}× monthly rent
                        </p>
                      )}
                      {qual.type === "credit_score" && qual.config.minCreditScore && (
                        <p className="text-sm text-muted-foreground">
                          Minimum: {qual.config.minCreditScore}
                        </p>
                      )}
                      {qual.type === "rental_history" && (
                        <div className="text-sm text-muted-foreground space-y-1">
                          {qual.config.maxEvictions !== undefined && (
                            <p>Max evictions: {qual.config.maxEvictions}</p>
                          )}
                          {qual.config.minRentalYears !== undefined && (
                            <p>Min rental years: {qual.config.minRentalYears}</p>
                          )}
                        </div>
                      )}
                      {qual.type === "criminal_history" && (
                        <p className="text-sm text-muted-foreground">
                          {qual.config.allowCriminalHistory ? "Criminal history allowed" : "No criminal history allowed"}
                        </p>
                      )}
                      {qual.type === "employment" && qual.config.minEmploymentMonths !== undefined && (
                        <p className="text-sm text-muted-foreground">
                          Minimum: {qual.config.minEmploymentMonths} months
                        </p>
                      )}
                      {qual.type === "occupants" && qual.config.maxOccupants && (
                        <p className="text-sm text-muted-foreground">
                          Maximum: {qual.config.maxOccupants} occupants
                        </p>
                      )}
                      {qual.type === "pets" && (
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>{qual.config.petsAllowed ? "Pets allowed" : "No pets allowed"}</p>
                          {qual.config.petsAllowed && qual.config.petFee && (
                            <p>Pet fee: ${qual.config.petFee}</p>
                          )}
                        </div>
                      )}
                      {qual.type === "security_deposit" && (
                        <div className="text-sm text-muted-foreground space-y-1">
                          {qual.config.depositMultiplier && (
                            <p>Deposit: {qual.config.depositMultiplier}× monthly rent</p>
                          )}
                          {qual.config.minDeposit && (
                            <p>Minimum: ${qual.config.minDeposit}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Message Customization */}
      <Card>
        <CardHeader>
          <CardTitle>Message Customization</CardTitle>
          <CardDescription>
            Customize the messages shown to leads during pre-qualification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="intro">Introduction Message</Label>
          <Textarea
            id="intro"
            value={introMessage}
            onChange={(e) => setIntroMessage(e.target.value)}
            placeholder="Welcome message shown before the questions..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="success">Success Message</Label>
            <Textarea
              id="success"
              value={successMessage}
              onChange={(e) => setSuccessMessage(e.target.value)}
              placeholder="Message shown when lead passes qualification..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="failure">Failure Message</Label>
            <Textarea
              id="failure"
              value={failureMessage}
              onChange={(e) => setFailureMessage(e.target.value)}
              placeholder="Message shown when lead fails qualification..."
            />
          </div>
        </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Switch
            id="showResults"
            checked={showResultsImmediately}
            onCheckedChange={setShowResultsImmediately}
          />
          <Label htmlFor="showResults">Show results immediately</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="allMustPass"
            checked={allMustPass}
            onCheckedChange={setAllMustPass}
          />
          <Label htmlFor="allMustPass">All deal-breakers must pass</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="allowRetry"
            checked={allowRetry}
            onCheckedChange={setAllowRetry}
          />
          <Label htmlFor="allowRetry">Allow retry</Label>
        </div>
        {allowRetry && (
          <div className="flex items-center gap-2">
            <Label htmlFor="retryDelay">Retry delay (minutes):</Label>
            <Input
              id="retryDelay"
              type="number"
              value={retryDelayMinutes}
              onChange={(e) => setRetryDelayMinutes(parseInt(e.target.value) || 0)}
              className="w-24"
            />
          </div>
        )}
      </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        {onDelete && (
          <Button variant="destructive" onClick={onDelete}>
            Remove Override
          </Button>
        )}
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Questions"}
        </Button>
      </div>
    </div>
  );
}
