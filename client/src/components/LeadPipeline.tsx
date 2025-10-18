import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeadStatus } from "./LeadCard";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";

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

function DraggableLeadCard({ lead, onLeadClick }: { lead: PipelineLead; onLeadClick?: (leadId: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-3 hover-elevate cursor-grab active:cursor-grabbing"
      data-testid={`pipeline-lead-${lead.id}`}
      onClick={(e) => {
        // Only trigger click if not dragging
        if (!isDragging && onLeadClick) {
          onLeadClick(lead.id);
        }
      }}
    >
      <div className="space-y-1">
        <h4 className="text-sm font-medium">{lead.name}</h4>
        <p className="text-xs text-muted-foreground">{lead.property}</p>
        <p className="text-xs font-medium text-status-success">{lead.value}</p>
      </div>
    </Card>
  );
}

function DroppableStage({ stage, title, leads, count, color, onLeadClick }: PipelineStageProps & { onLeadClick?: (leadId: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
  });

  return (
    <div className="flex-1 min-w-[280px]">
      <Card className={cn(isOver && "ring-2 ring-primary ring-offset-2")}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            <Badge className={cn(color)}>{count}</Badge>
          </div>
        </CardHeader>
        <CardContent
          ref={setNodeRef}
          className={cn(
            "space-y-2 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto transition-colors",
            isOver && "bg-accent/50"
          )}
        >
          {leads.length === 0 ? (
            <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
              Drop leads here
            </div>
          ) : (
            leads.map((lead) => <DraggableLeadCard key={lead.id} lead={lead} onLeadClick={onLeadClick} />)
          )}
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
  onLeadStatusChange?: (leadId: string, newStatus: LeadStatus) => void;
  onLeadClick?: (leadId: string) => void;
}

export function LeadPipeline({ stages, onLeadStatusChange, onLeadClick }: LeadPipelineProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const leadId = active.id as string;
      const newStatus = over.id as LeadStatus;
      
      // Call the status change handler
      onLeadStatusChange?.(leadId, newStatus);
    }

    setActiveId(null);
  };

  // Find the active lead for the drag overlay
  const activeLead = activeId
    ? stages.flatMap((s) => s.leads).find((l) => l.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stageData) => (
          <DroppableStage key={stageData.stage} {...stageData} onLeadClick={onLeadClick} />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? (
          <Card className="p-3 cursor-grabbing shadow-lg">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">{activeLead.name}</h4>
              <p className="text-xs text-muted-foreground">{activeLead.property}</p>
              <p className="text-xs font-medium text-status-success">{activeLead.value}</p>
            </div>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
