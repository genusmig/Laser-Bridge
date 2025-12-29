import { Card } from "@/components/ui/shared";
import { cn } from "@/components/ui/shared";
import type { Position } from "@/hooks/use-grbl";

interface DROProps {
  mpos: Position;
  wpos: Position;
  feed: number;
  speed: number;
}

const AxisDisplay = ({ label, value, unit = "mm", highlight = false }: { label: string; value: number; unit?: string; highlight?: boolean }) => (
  <div className="flex items-center justify-between p-3 bg-muted/20 rounded-md border border-border/50">
    <span className={cn("text-2xl font-bold font-mono", highlight ? "text-primary" : "text-muted-foreground")}>{label}</span>
    <div className="text-right">
      <div className="text-3xl font-mono-data font-bold tracking-wider text-foreground">
        {value.toFixed(3)}
      </div>
      <div className="text-xs text-muted-foreground uppercase">{unit}</div>
    </div>
  </div>
);

export function DRO({ mpos, wpos, feed, speed }: DROProps) {
  return (
    <Card className="p-4 space-y-4 h-full">
      <div className="flex items-center justify-between pb-2 border-b border-border/50">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-widest">Coordinates</h2>
        <div className="flex gap-2">
           <span className="text-xs font-mono text-primary">WCS: G54</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <AxisDisplay label="X" value={wpos.x} highlight />
        <AxisDisplay label="Y" value={wpos.y} highlight />
        <AxisDisplay label="Z" value={wpos.z} highlight />
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border/50">
        <div className="bg-muted/10 p-2 rounded text-center border border-border/30">
          <div className="text-xs text-muted-foreground uppercase mb-1">Feed</div>
          <div className="text-xl font-mono-data text-secondary">{feed}</div>
        </div>
        <div className="bg-muted/10 p-2 rounded text-center border border-border/30">
          <div className="text-xs text-muted-foreground uppercase mb-1">Speed</div>
          <div className="text-xl font-mono-data text-secondary">{speed}</div>
        </div>
      </div>
      
      <div className="pt-2">
        <div className="text-xs text-muted-foreground font-mono mb-1">Machine Pos</div>
        <div className="grid grid-cols-3 gap-2 text-xs font-mono text-muted-foreground/70">
           <div>X: {mpos.x.toFixed(2)}</div>
           <div>Y: {mpos.y.toFixed(2)}</div>
           <div>Z: {mpos.z.toFixed(2)}</div>
        </div>
      </div>
    </Card>
  );
}
