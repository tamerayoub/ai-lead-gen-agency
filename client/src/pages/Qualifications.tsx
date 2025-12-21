import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Building2, Home, Settings, Award, XCircle, DollarSign, CreditCard, History, Shield, Briefcase, Users, Dog, Lock } from "lucide-react";
import type { Property } from "@shared/schema";

// Predefined qualification types
export type QualificationType = 
  | "income"
  | "credit_score"
  | "rental_history"
  | "criminal_history"
  | "employment"
  | "occupants"
  | "pets"
  | "security_deposit";

export interface QualificationCriteria {
  id: string;
  type: QualificationType;
  enabled: boolean;
  isDealBreaker: boolean;
  points: number;
  weight: number;
  // Configuration based on type
  config: {
    // Income: multiplier of rent (e.g., 3x)
    incomeMultiplier?: number;
    // Credit Score: minimum score
    minCreditScore?: number;
    // Rental History: max evictions, min years, etc.
    maxEvictions?: number;
    minRentalYears?: number;
    // Criminal History: allowed/not allowed
    allowCriminalHistory?: boolean;
    // Employment: min months employed
    minEmploymentMonths?: number;
    // Occupants: max number
    maxOccupants?: number;
    // Pets: allowed/not allowed, pet fee, etc.
    petsAllowed?: boolean;
    petFee?: number;
    // Security Deposit: multiplier of rent (e.g., 1x, 1.5x)
    depositMultiplier?: number;
    minDeposit?: number;
  };
}

export interface QualificationSettings {
  id?: string;
  orgId: string;
  propertyId?: string | null;
  qualifications: QualificationCriteria[];
  createdAt?: string;
  updatedAt?: string;
}

const QUALIFICATION_TYPES: Array<{
  id: QualificationType;
  label: string;
  icon: any;
  description: string;
  defaultConfig: Partial<QualificationCriteria["config"]>;
}> = [
  {
    id: "income",
    label: "Income Requirements",
    icon: DollarSign,
    description: "Set minimum income requirements (e.g., 3x monthly rent)",
    defaultConfig: { incomeMultiplier: 3 },
  },
  {
    id: "credit_score",
    label: "Credit Score",
    icon: CreditCard,
    description: "Set minimum credit score requirement",
    defaultConfig: { minCreditScore: 650 },
  },
  {
    id: "rental_history",
    label: "Rental History",
    icon: History,
    description: "Set requirements for rental history (evictions, years)",
    defaultConfig: { maxEvictions: 0, minRentalYears: 0 },
  },
  {
    id: "criminal_history",
    label: "Criminal History",
    icon: Shield,
    description: "Set policy for criminal history",
    defaultConfig: { allowCriminalHistory: false },
  },
  {
    id: "employment",
    label: "Employment",
    icon: Briefcase,
    description: "Set minimum employment duration requirements",
    defaultConfig: { minEmploymentMonths: 0 },
  },
  {
    id: "occupants",
    label: "Number of Occupants",
    icon: Users,
    description: "Set maximum number of occupants",
    defaultConfig: { maxOccupants: undefined },
  },
  {
    id: "pets",
    label: "Pets",
    icon: Dog,
    description: "Set pet policy and fees",
    defaultConfig: { petsAllowed: false, petFee: 0 },
  },
  {
    id: "security_deposit",
    label: "Security Deposit",
    icon: Lock,
    description: "Set security deposit requirements",
    defaultConfig: { depositMultiplier: 1, minDeposit: 0 },
  },
];

export default function Qualifications() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("organization");

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  // Fetch organization qualification settings
  const { data: orgSettings, isLoading: orgLoading } = useQuery<QualificationSettings | null>({
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

  // Fetch property qualification settings
  const { data: propertySettings = [] } = useQuery<Array<QualificationSettings & { propertyId: string }>>({
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

  const saveOrgSettingsMutation = useMutation({
    mutationFn: async (settings: QualificationSettings) => {
      const res = await apiRequest("POST", "/api/qualification-settings/org", settings);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qualification-settings/org"] });
      toast({
        title: "Settings saved",
        description: "Organization qualification criteria have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const savePropertySettingsMutation = useMutation({
    mutationFn: async ({ propertyId, settings }: { propertyId: string; settings: QualificationSettings }) => {
      const res = await apiRequest("POST", `/api/qualification-settings/property/${propertyId}`, settings);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qualification-settings/properties"] });
      toast({
        title: "Settings saved",
        description: "Property qualification criteria have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const deletePropertySettingsMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      await apiRequest("DELETE", `/api/qualification-settings/property/${propertyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qualification-settings/properties"] });
      toast({
        title: "Override removed",
        description: "Property now uses organization default criteria.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove override",
        variant: "destructive",
      });
    },
  });

  // Initialize with all predefined types if no settings exist
  const getInitialQualifications = (existing?: QualificationCriteria[]): QualificationCriteria[] => {
    if (existing && existing.length > 0) {
      // Merge with any new qualification types that don't exist
      const existingTypes = new Set(existing.map(q => q.type));
      const newTypes = QUALIFICATION_TYPES
        .filter(qt => !existingTypes.has(qt.id))
        .map(qt => ({
          id: `${qt.id}-${Date.now()}`,
          type: qt.id,
          enabled: false,
          isDealBreaker: false,
          points: 0,
          weight: 1,
          config: qt.defaultConfig,
        }));
      return [...existing, ...newTypes];
    }
    return QUALIFICATION_TYPES.map(qt => ({
      id: `${qt.id}-${Date.now()}`,
      type: qt.id,
      enabled: false,
      isDealBreaker: false,
      points: 0,
      weight: 1,
      config: qt.defaultConfig,
    }));
  };

  const orgQualifications = getInitialQualifications(orgSettings?.qualifications);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Qualification Requirement
          </h1>
          <p className="text-muted-foreground">
            Define qualification criteria with scoring and deal-breakers for your organization and properties
          </p>
        </div>
      </div>

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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Organization Qualification Criteria
              </CardTitle>
              <CardDescription>
                Define your organization's qualification standards. These apply to all properties by default unless overridden.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {orgLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
                </div>
              ) : (
                <QualificationEditor
                  qualifications={orgQualifications}
                  onSave={(qualifications) => {
                    saveOrgSettingsMutation.mutate({
                      qualifications,
                      orgId: "", // Will be set by backend
                    });
                  }}
                  isSaving={saveOrgSettingsMutation.isPending}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="properties" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Property Qualification Overrides</CardTitle>
              <CardDescription>
                Override organization criteria for specific properties
              </CardDescription>
            </CardHeader>
            <CardContent>
              {properties.length === 0 ? (
                <div className="text-center py-8">
                  <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No properties</h3>
                  <p className="text-sm text-muted-foreground">
                    Add properties first to configure property-specific criteria
                  </p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {properties.map((property) => {
                    const propertySetting = propertySettings.find(ps => ps.propertyId === property.id);
                    const propertyQualifications = getInitialQualifications(propertySetting?.qualifications);
                    
                    return (
                      <AccordionItem key={property.id} value={property.id}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3">
                            <Building2 className="h-4 w-4" />
                            <span>{property.name}</span>
                            {propertySetting ? (
                              <Badge variant="default">Custom Criteria</Badge>
                            ) : (
                              <Badge variant="secondary">Using Organization Default</Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4">
                          {propertySetting ? (
                            <div className="space-y-4">
                              <QualificationEditor
                                qualifications={propertyQualifications}
                                onSave={(qualifications) => {
                                  savePropertySettingsMutation.mutate({
                                    propertyId: property.id,
                                    settings: {
                                      qualifications,
                                      orgId: "", // Will be set by backend
                                      propertyId: property.id,
                                    },
                                  });
                                }}
                                isSaving={savePropertySettingsMutation.isPending}
                              />
                              <div className="pt-4 border-t">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deletePropertySettingsMutation.mutate(property.id)}
                                  disabled={deletePropertySettingsMutation.isPending}
                                >
                                  Remove Override
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-4">
                              <p className="text-sm text-muted-foreground mb-4">
                                This property uses the organization default criteria
                              </p>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  savePropertySettingsMutation.mutate({
                                    propertyId: property.id,
                                    settings: {
                                      qualifications: orgQualifications,
                                      orgId: "", // Will be set by backend
                                      propertyId: property.id,
                                    },
                                  });
                                }}
                                disabled={savePropertySettingsMutation.isPending}
                              >
                                Create Property Override
                              </Button>
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
    </div>
  );
}

interface QualificationEditorProps {
  qualifications: QualificationCriteria[];
  onSave: (qualifications: QualificationCriteria[]) => void;
  isSaving: boolean;
}

function QualificationEditor({ qualifications, onSave, isSaving }: QualificationEditorProps) {
  const [localQualifications, setLocalQualifications] = useState<QualificationCriteria[]>(qualifications);

  const updateQualification = (id: string, updates: Partial<QualificationCriteria>) => {
    setLocalQualifications(prev =>
      prev.map(q => q.id === id ? { ...q, ...updates } : q)
    );
  };

  const updateConfig = (id: string, configUpdates: Partial<QualificationCriteria["config"]>) => {
    setLocalQualifications(prev =>
      prev.map(q => q.id === id ? { ...q, config: { ...q.config, ...configUpdates } } : q)
    );
  };

  const handleSave = () => {
    onSave(localQualifications);
  };

  // Calculate total possible points
  const totalPossiblePoints = localQualifications
    .filter(q => q.enabled && !q.isDealBreaker)
    .reduce((sum, q) => sum + (q.points * (q.weight || 1)), 0);

  return (
    <div className="space-y-6">
      <div className="bg-muted p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Award className="h-5 w-5 text-primary" />
          <Label className="text-base font-semibold">Scoring System</Label>
        </div>
        <p className="text-sm text-muted-foreground">
          Total Possible Points: <span className="font-semibold text-foreground">{totalPossiblePoints}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Applicants will be ranked by their total score. Deal-breakers must pass regardless of score.
        </p>
      </div>

      <div className="space-y-4">
        {QUALIFICATION_TYPES.map((qualType) => {
          const qualification = localQualifications.find(q => q.type === qualType.id);
          if (!qualification) return null;

          const Icon = qualType.icon;

          return (
            <Card key={qualification.id} className="p-4">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <Icon className="h-5 w-5 mt-0.5 text-primary" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{qualType.label}</h4>
                        {qualification.isDealBreaker && (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Deal-breaker
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{qualType.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={qualification.enabled}
                    onCheckedChange={(enabled) => updateQualification(qualification.id, { enabled })}
                  />
                </div>

                {qualification.enabled && (
                  <div className="pl-8 space-y-4 border-l-2 border-muted">
                    {/* Configuration based on type */}
                    {qualification.type === "income" && (
                      <div className="space-y-2">
                        <Label>Income Multiplier</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.1"
                            value={qualification.config.incomeMultiplier || 3}
                            onChange={(e) => updateConfig(qualification.id, { 
                              incomeMultiplier: parseFloat(e.target.value) || 0 
                            })}
                            className="w-32"
                          />
                          <span className="text-sm text-muted-foreground">× monthly rent</span>
                        </div>
                      </div>
                    )}

                    {qualification.type === "credit_score" && (
                      <div className="space-y-2">
                        <Label>Minimum Credit Score</Label>
                        <Input
                          type="number"
                          value={qualification.config.minCreditScore || 650}
                          onChange={(e) => updateConfig(qualification.id, { 
                            minCreditScore: parseInt(e.target.value) || 0 
                          })}
                          className="w-32"
                        />
                      </div>
                    )}

                    {qualification.type === "rental_history" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Max Evictions</Label>
                          <Input
                            type="number"
                            value={qualification.config.maxEvictions || 0}
                            onChange={(e) => updateConfig(qualification.id, { 
                              maxEvictions: parseInt(e.target.value) || 0 
                            })}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Min Rental Years</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={qualification.config.minRentalYears || 0}
                            onChange={(e) => updateConfig(qualification.id, { 
                              minRentalYears: parseFloat(e.target.value) || 0 
                            })}
                            className="w-full"
                          />
                        </div>
                      </div>
                    )}

                    {qualification.type === "criminal_history" && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={qualification.config.allowCriminalHistory || false}
                            onCheckedChange={(allowed) => updateConfig(qualification.id, { 
                              allowCriminalHistory: allowed 
                            })}
                          />
                          <Label>Allow applicants with criminal history</Label>
                        </div>
                      </div>
                    )}

                    {qualification.type === "employment" && (
                      <div className="space-y-2">
                        <Label>Minimum Employment Duration (months)</Label>
                        <Input
                          type="number"
                          value={qualification.config.minEmploymentMonths || 0}
                          onChange={(e) => updateConfig(qualification.id, { 
                            minEmploymentMonths: parseInt(e.target.value) || 0 
                          })}
                          className="w-32"
                        />
                      </div>
                    )}

                    {qualification.type === "occupants" && (
                      <div className="space-y-2">
                        <Label>Maximum Number of Occupants</Label>
                        <Input
                          type="number"
                          value={qualification.config.maxOccupants || ""}
                          onChange={(e) => updateConfig(qualification.id, { 
                            maxOccupants: e.target.value ? parseInt(e.target.value) : undefined 
                          })}
                          className="w-32"
                          placeholder="No limit"
                        />
                      </div>
                    )}

                    {qualification.type === "pets" && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={qualification.config.petsAllowed || false}
                            onCheckedChange={(allowed) => updateConfig(qualification.id, { 
                              petsAllowed: allowed 
                            })}
                          />
                          <Label>Pets allowed</Label>
                        </div>
                        {qualification.config.petsAllowed && (
                          <div className="space-y-2">
                            <Label>Pet Fee ($)</Label>
                            <Input
                              type="number"
                              value={qualification.config.petFee || 0}
                              onChange={(e) => updateConfig(qualification.id, { 
                                petFee: parseFloat(e.target.value) || 0 
                              })}
                              className="w-32"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {qualification.type === "security_deposit" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Deposit Multiplier</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.1"
                              value={qualification.config.depositMultiplier || 1}
                              onChange={(e) => updateConfig(qualification.id, { 
                                depositMultiplier: parseFloat(e.target.value) || 0 
                              })}
                              className="w-24"
                            />
                            <span className="text-sm text-muted-foreground">× monthly rent</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Minimum Deposit ($)</Label>
                          <Input
                            type="number"
                            value={qualification.config.minDeposit || 0}
                            onChange={(e) => updateConfig(qualification.id, { 
                              minDeposit: parseFloat(e.target.value) || 0 
                            })}
                            className="w-full"
                          />
                        </div>
                      </div>
                    )}

                    {/* Scoring and Deal-breaker */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div className="space-y-2">
                        <Label>Base Points</Label>
                        <Input
                          type="number"
                          value={qualification.points || 0}
                          onChange={(e) => updateQualification(qualification.id, { 
                            points: parseInt(e.target.value) || 0 
                          })}
                          className="w-full"
                          disabled={qualification.isDealBreaker}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Weight Multiplier</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={qualification.weight || 1}
                          onChange={(e) => updateQualification(qualification.id, { 
                            weight: parseFloat(e.target.value) || 1 
                          })}
                          className="w-full"
                          disabled={qualification.isDealBreaker}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Switch
                        checked={qualification.isDealBreaker || false}
                        onCheckedChange={(isDealBreaker) => updateQualification(qualification.id, { 
                          isDealBreaker,
                          points: isDealBreaker ? 0 : qualification.points, // Reset points if deal-breaker
                        })}
                      />
                      <Label className="flex items-center gap-1">
                        Deal-breaker
                        <XCircle className="h-3 w-3 text-destructive" />
                      </Label>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-qualifications">
          {isSaving ? "Saving..." : "Save Qualifications"}
        </Button>
      </div>
    </div>
  );
}
