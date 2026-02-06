interface StatCardProps {
  value: string;
  label: string;
  icon: React.ReactNode;
  testId?: string;
}

export function StatCard({ value, label, icon, testId }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-2xl hover-elevate" data-testid={testId}>
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground" data-testid={testId ? `${testId}-value` : undefined}>{value}</div>
        <div className="text-sm text-muted-foreground" data-testid={testId ? `${testId}-label` : undefined}>{label}</div>
      </div>
    </div>
  );
}
