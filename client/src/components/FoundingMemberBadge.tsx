import { Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface FoundingMemberBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function FoundingMemberBadge({ size = 'md', showText = true, className = '' }: FoundingMemberBadgeProps) {
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const badgeSizes = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
  };

  if (!showText) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`inline-flex items-center justify-center rounded-full p-1 ${className}`}
            style={{ background: 'linear-gradient(to right, #FFDF00, #FFDF00)' }}
            data-testid="badge-founding-member-icon"
          >
            <Crown className={`${iconSizes[size]} text-white`} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Founding Partner</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={`text-white border-0 font-medium ${badgeSizes[size]} ${className}`}
      style={{ background: 'linear-gradient(to right, #FFDF00, #FFDF00)' }}
      data-testid="badge-founding-member"
    >
      <Crown className={`${iconSizes[size]} mr-1`} />
      Founding Partner
    </Badge>
  );
}
