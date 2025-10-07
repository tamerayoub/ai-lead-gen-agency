import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeadStatus } from "./LeadCard";
import { cn } from "@/lib/utils";

interface PipelineLead {
  id: string;
  name: string;
  property: string;
  value: string;
}

interface PipelineStageProps {
  stage: LeadStatus;
  title: string;
  leads: PipelineLead[];
  count: number;
  color: string;
}

function PipelineStage({ stage, title, leads, count, color }: PipelineStageProps) {
  return (
    <div className="flex-1 min-w-[280px]">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            <Badge className={cn(color)}>{count}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {leads.map((lead) => (
            <Card key={lead.id} className="p-3 hover-elevate cursor-pointer" data-testid={`pipeline-lead-${lead.id}`}>
              <div className="space-y-1">
                <h4 className="text-sm font-medium">{lead.name}</h4>
                <p className="text-xs text-muted-foreground">{lead.property}</p>
                <p className="text-xs font-medium text-status-success">{lead.value}</p>
              </div>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

interface LeadPipelineProps {
  stages: {
    stage: LeadStatus;
    title: string;
    leads: PipelineLead[];
    count: number;
    color: string;
  }[];
}

export function LeadPipeline({ stages }: LeadPipelineProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stageData) => (
        <PipelineStage key={stageData.stage} {...stageData} />
      ))}
    </div>
  );
}
