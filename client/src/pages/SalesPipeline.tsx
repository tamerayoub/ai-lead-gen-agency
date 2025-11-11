import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Building2, RefreshCw, Users, TrendingUp, StickyNote, X } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type ProspectSource = {
  id: string;
  prospectId: string;
  sourceType: 'demo' | 'onboarding';
  sourceId: string;
  createdAt: Date;
};

type SalesProspect = {
  id: string;
  email: string;
  primaryName: string | null;
  phone: string | null;
  units: string | null;
  sourceSummary: string | null;
  pipelineStage: string;
  notes: string | null;
  lastInteractionAt: Date;
  createdAt: Date;
  updatedAt: Date;
  sources: ProspectSource[];
};

const PIPELINE_STAGES = [
  { id: 'discovery', label: 'Discovery', color: 'bg-blue-500' },
  { id: 'evaluation', label: 'Evaluation', color: 'bg-blue-600' },
  { id: 'probing', label: 'Probing', color: 'bg-yellow-500' },
  { id: 'offer', label: 'Offer', color: 'bg-orange-500' },
  { id: 'sale', label: 'Sale', color: 'bg-green-500' },
  { id: 'onboard', label: 'Onboard', color: 'bg-teal-500' },
];

function NotesDialog({ prospect, open, onOpenChange }: { 
  prospect: SalesProspect; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [notes, setNotes] = useState(prospect.notes || '');

  // Reset notes when prospect changes
  useEffect(() => {
    setNotes(prospect.notes || '');
  }, [prospect.id, prospect.notes]);

  const updateNotesMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      return await apiRequest('PATCH', `/api/sales-prospects/${prospect.id}`, { notes: newNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-prospects"] });
      toast({
        title: "Notes Updated",
        description: "Prospect notes have been saved successfully.",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update notes.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateNotesMutation.mutate(notes);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid={`dialog-notes-${prospect.id}`}>
        <DialogHeader>
          <DialogTitle>Notes for {prospect.primaryName || prospect.email}</DialogTitle>
          <DialogDescription>
            Add internal notes about this prospect.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Textarea
            placeholder="Enter your notes here..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[200px]"
            data-testid={`textarea-notes-${prospect.id}`}
          />
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            data-testid={`button-cancel-notes-${prospect.id}`}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateNotesMutation.isPending}
            data-testid={`button-save-notes-${prospect.id}`}
          >
            {updateNotesMutation.isPending ? "Saving..." : "Save Notes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProspectCard({ prospect, onNotesClick }: { 
  prospect: SalesProspect;
  onNotesClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: prospect.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`prospect-card-${prospect.id}`}
      className="relative"
    >
      <Card className="hover-elevate">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0" {...attributes} {...listeners} style={{ cursor: 'grab' }}>
                <h4 className="font-semibold truncate" data-testid={`text-prospect-name-${prospect.id}`}>
                  {prospect.primaryName || 'Unknown'}
                </h4>
                <p className="text-sm text-muted-foreground truncate" data-testid={`text-prospect-email-${prospect.id}`}>
                  {prospect.email}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNotesClick();
                  }}
                  className="h-7 w-7"
                  data-testid={`button-notes-${prospect.id}`}
                >
                  <StickyNote className={`h-4 w-4 ${prospect.notes ? 'text-yellow-600' : 'text-muted-foreground'}`} />
                </Button>
                <Badge variant="secondary" className="text-xs" data-testid={`badge-prospect-source-${prospect.id}`}>
                  {prospect.sourceSummary}
                </Badge>
              </div>
            </div>

            <div {...attributes} {...listeners} style={{ cursor: 'grab' }}>
              {prospect.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3 shrink-0" />
                  <span className="truncate">{prospect.phone}</span>
                </div>
              )}

              {prospect.units && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{prospect.units} units</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Last contact:</span>
                <span>{format(new Date(prospect.lastInteractionAt), 'MMM d, yyyy')}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PipelineColumn({ 
  stage, 
  prospects, 
  onNotesClick 
}: { 
  stage: typeof PIPELINE_STAGES[number];
  prospects: SalesProspect[];
  onNotesClick: (prospect: SalesProspect) => void;
}) {
  const { setNodeRef } = useDroppable({
    id: stage.id,
  });

  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px]" data-testid={`column-${stage.id}`}>
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${stage.color}`}></div>
          <h3 className="font-semibold" data-testid={`text-column-title-${stage.id}`}>
            {stage.label}
          </h3>
          <Badge variant="secondary" className="ml-auto" data-testid={`badge-column-count-${stage.id}`}>
            {prospects.length}
          </Badge>
        </div>
      </div>

      <SortableContext
        id={stage.id}
        items={prospects.map(p => p.id)}
        strategy={verticalListSortingStrategy}
      >
        <div 
          ref={setNodeRef}
          className="flex-1 space-y-3 min-h-[200px] rounded-md border-2 border-dashed border-border p-3 bg-muted/20"
          data-testid={`stage-${stage.id}`}
        >
          {prospects.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              No prospects
            </div>
          ) : (
            prospects.map((prospect) => (
              <ProspectCard 
                key={prospect.id} 
                prospect={prospect}
                onNotesClick={() => onNotesClick(prospect)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function SalesPipeline() {
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notesProspect, setNotesProspect] = useState<SalesProspect | null>(null);
  
  const { data: prospects, isLoading } = useQuery<SalesProspect[]>({
    queryKey: ["/api/sales-prospects"],
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      return await apiRequest('PATCH', `/api/sales-prospects/${id}/stage`, { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-prospects"] });
      toast({
        title: "Stage Updated",
        description: "Prospect moved to new stage successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update prospect stage.",
        variant: "destructive",
      });
    },
  });

  const resyncMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/sales-prospects/resync', {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-prospects"] });
      toast({
        title: "Prospects Resynced",
        description: `Successfully resynced ${data.count} prospects from demo requests and onboarding.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to resync prospects.",
        variant: "destructive",
      });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeProspect = prospects?.find(p => p.id === active.id);
    if (!activeProspect) return;

    // Resolve the target stage ID from the sortable container or droppable
    const targetStageId = (over.data.current?.sortable?.containerId ?? over.id) as string;

    // Verify it's a valid stage
    const isValidStage = PIPELINE_STAGES.some(s => s.id === targetStageId);
    
    if (isValidStage && activeProspect.pipelineStage !== targetStageId) {
      updateStageMutation.mutate({
        id: activeProspect.id,
        stage: targetStageId,
      });
    }
  };

  const activeProspect = activeId ? prospects?.find(p => p.id === activeId) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-muted-foreground">Loading sales pipeline...</p>
        </div>
      </div>
    );
  }

  const prospectsByStage = PIPELINE_STAGES.map(stage => ({
    stage,
    prospects: prospects?.filter(p => p.pipelineStage === stage.id) || [],
  }));

  const totalProspects = prospects?.length || 0;
  const activeProspects = prospects?.filter(p => ['discovery', 'evaluation', 'probing', 'offer'].includes(p.pipelineStage)).length || 0;
  const closedDeals = prospects?.filter(p => p.pipelineStage === 'sale').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Sales Pipeline</h1>
          <p className="text-muted-foreground mt-2">
            Drag and drop prospects through the sales stages.
          </p>
        </div>
        <Button
          onClick={() => resyncMutation.mutate()}
          disabled={resyncMutation.isPending}
          data-testid="button-resync-prospects"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${resyncMutation.isPending ? 'animate-spin' : ''}`} />
          Resync Prospects
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Prospects</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-prospects">
              {totalProspects}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Pipeline</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-active-prospects">
              {activeProspects}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Closed Deals</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-closed-deals">
              {closedDeals}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline Board</CardTitle>
          <CardDescription>
            Drag prospects between stages to update their position in the sales pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4">
              {prospectsByStage.map(({ stage, prospects }) => (
                <PipelineColumn
                  key={stage.id}
                  stage={stage}
                  prospects={prospects}
                  onNotesClick={setNotesProspect}
                />
              ))}
            </div>
            <DragOverlay>
              {activeProspect ? (
                <Card className="w-[280px] rotate-3 cursor-grabbing">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold">
                        {activeProspect.primaryName || 'Unknown'}
                      </h4>
                      <p className="text-sm text-muted-foreground truncate">
                        {activeProspect.email}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </DragOverlay>
          </DndContext>
        </CardContent>
      </Card>

      {notesProspect && (
        <NotesDialog
          prospect={notesProspect}
          open={!!notesProspect}
          onOpenChange={(open) => !open && setNotesProspect(null)}
        />
      )}
    </div>
  );
}
