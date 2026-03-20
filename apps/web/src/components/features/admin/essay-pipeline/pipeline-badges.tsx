import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

export function StatusBadge({ status, error }: { status: string | null; error: string | null }) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    );
  }
  if (status === 'SUCCESS') {
    return (
      <Badge
        variant="default"
        className="text-xs gap-1 bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400"
      >
        <CheckCircle2 className="h-3 w-3" />
        OK
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="text-xs gap-1" title={error || ''}>
      <XCircle className="h-3 w-3" />
      Failed
    </Badge>
  );
}

export function PipelineStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'RUNNING':
      return (
        <Badge className="text-xs gap-1 bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Running
        </Badge>
      );
    case 'COMPLETED':
      return (
        <Badge className="text-xs gap-1 bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      );
    case 'FAILED':
      return (
        <Badge variant="destructive" className="text-xs gap-1">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function ChangeTypeBadge({ type }: { type: string }) {
  switch (type) {
    case 'NEW':
      return (
        <Badge className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">
          NEW
        </Badge>
      );
    case 'MODIFIED':
      return (
        <Badge className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400">
          MODIFIED
        </Badge>
      );
    case 'UNCHANGED':
      return (
        <Badge className="text-xs bg-muted text-muted-foreground hover:bg-muted">UNCHANGED</Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          {type}
        </Badge>
      );
  }
}

export function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
