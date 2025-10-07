import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Save, Play, Bot } from "lucide-react";

export default function AITraining() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">AI Training</h1>
        <p className="text-muted-foreground mt-1">Customize AI responses and behavior</p>
      </div>

      <Tabs defaultValue="responses" className="w-full">
        <TabsList>
          <TabsTrigger value="responses" data-testid="tab-responses">Response Templates</TabsTrigger>
          <TabsTrigger value="qualification" data-testid="tab-qualification">Qualification Rules</TabsTrigger>
          <TabsTrigger value="automation" data-testid="tab-automation">Automation Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="responses" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Initial Inquiry Response</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="greeting">Greeting Template</Label>
                  <Textarea
                    id="greeting"
                    placeholder="Hello! Thank you for your interest in..."
                    className="min-h-[120px]"
                    defaultValue="Hello! Thank you for your interest in {property_name}. I'd be happy to help you with information about our {unit_type} unit."
                    data-testid="textarea-greeting"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="property-details">Property Details</Label>
                  <Textarea
                    id="property-details"
                    placeholder="This property features..."
                    className="min-h-[120px]"
                    defaultValue="This property features modern amenities including {amenities}. The monthly rent is {rent} with a lease term of {lease_term}."
                    data-testid="textarea-property-details"
                  />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" data-testid="button-save-template">
                    <Save className="h-4 w-4 mr-2" />
                    Save Template
                  </Button>
                  <Button variant="outline" className="flex-1" data-testid="button-test-template">
                    <Play className="h-4 w-4 mr-2" />
                    Test
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 rounded-md bg-muted">
                    <div className="flex items-center gap-2 mb-3">
                      <Bot className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">AI Response</span>
                    </div>
                    <p className="text-sm">
                      Hello! Thank you for your interest in Sunset Apartments. I'd be happy to help you with information about our 2BR unit.
                    </p>
                    <p className="text-sm mt-3">
                      This property features modern amenities including in-unit laundry, balcony, and fitness center access. The monthly rent is $2,400 with a lease term of 12 months.
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Variables available: {"{property_name}"}, {"{unit_type}"}, {"{amenities}"}, {"{rent}"}, {"{lease_term}"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="qualification" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pre-Qualification Criteria</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="min-income">Minimum Income Multiplier</Label>
                  <Input
                    id="min-income"
                    type="number"
                    placeholder="3"
                    defaultValue="3"
                    data-testid="input-min-income"
                  />
                  <p className="text-xs text-muted-foreground">Income must be X times the monthly rent</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min-credit">Minimum Credit Score</Label>
                  <Input
                    id="min-credit"
                    type="number"
                    placeholder="650"
                    defaultValue="650"
                    data-testid="input-min-credit"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Required Information</Label>
                <div className="space-y-2">
                  {["Employment verification", "Income documentation", "Credit check authorization", "References"].map((item) => (
                    <div key={item} className="flex items-center justify-between p-3 rounded-md bg-muted">
                      <span className="text-sm">{item}</span>
                      <Badge variant="secondary">Required</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <Button data-testid="button-save-qualification">
                <Save className="h-4 w-4 mr-2" />
                Save Criteria
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Automation Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-md bg-muted">
                  <div>
                    <h4 className="text-sm font-medium">Auto-respond to inquiries</h4>
                    <p className="text-xs text-muted-foreground mt-1">Automatically respond to new lead inquiries within 5 minutes</p>
                  </div>
                  <Badge>Active</Badge>
                </div>

                <div className="flex items-center justify-between p-4 rounded-md bg-muted">
                  <div>
                    <h4 className="text-sm font-medium">Follow-up sequences</h4>
                    <p className="text-xs text-muted-foreground mt-1">Send automated follow-ups if no response after 24 hours</p>
                  </div>
                  <Badge>Active</Badge>
                </div>

                <div className="flex items-center justify-between p-4 rounded-md bg-muted">
                  <div>
                    <h4 className="text-sm font-medium">Qualification checks</h4>
                    <p className="text-xs text-muted-foreground mt-1">Automatically run pre-qualification when income info is provided</p>
                  </div>
                  <Badge>Active</Badge>
                </div>

                <div className="flex items-center justify-between p-4 rounded-md bg-muted">
                  <div>
                    <h4 className="text-sm font-medium">Application generation</h4>
                    <p className="text-xs text-muted-foreground mt-1">Auto-generate and send applications to qualified leads</p>
                  </div>
                  <Badge variant="secondary">Inactive</Badge>
                </div>
              </div>

              <Button data-testid="button-update-automation">
                <Save className="h-4 w-4 mr-2" />
                Update Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
