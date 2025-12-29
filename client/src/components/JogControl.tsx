import { useState } from "react";
import { Button, Card, Label } from "@/components/ui/shared";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, Crosshair } from "lucide-react";
import { cn } from "@/components/ui/shared";

interface JogControlProps {
  onSend: (gcode: string) => void;
  feedRate: number;
}

export function JogControl({ onSend, feedRate: initialFeed }: JogControlProps) {
  const [step, setStep] = useState(10);
  const [feed, setFeed] = useState(1000); // Default jog feed

  const handleJog = (axis: string, dir: 1 | -1) => {
    // $J=G91 X10 F1000
    const cmd = `$J=G91 ${axis}${step * dir} F${feed}`;
    onSend(cmd);
  };

  const handleHome = () => onSend("$H");
  const handleZero = (axis: string) => onSend(`G10 L20 P1 ${axis}0`);
  const handleZeroAll = () => onSend("G10 L20 P1 X0 Y0 Z0");

  return (
    <Card className="p-6 h-full flex flex-col gap-6">
      <div className="flex items-center justify-between pb-2 border-b border-border/50">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-widest">Jog Control</h2>
      </div>

      {/* Main Directional Controls */}
      <div className="flex justify-center gap-8">
        {/* XY Pad */}
        <div className="grid grid-cols-3 gap-2 w-48 h-48">
          <div /> {/* Top Left */}
          <Button variant="outline" className="h-full w-full" onClick={() => handleJog('Y', 1)}>
            <ArrowUp className="w-6 h-6" />
          </Button>
          <div /> {/* Top Right */}
          
          <Button variant="outline" className="h-full w-full" onClick={() => handleJog('X', -1)}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <Button variant="secondary" className="h-full w-full rounded-full" onClick={handleZeroAll} title="Zero All">
             <Crosshair className="w-6 h-6" />
          </Button>
          <Button variant="outline" className="h-full w-full" onClick={() => handleJog('X', 1)}>
            <ArrowRight className="w-6 h-6" />
          </Button>

          <div /> {/* Bottom Left */}
          <Button variant="outline" className="h-full w-full" onClick={() => handleJog('Y', -1)}>
            <ArrowDown className="w-6 h-6" />
          </Button>
          <div /> {/* Bottom Right */}
        </div>

        {/* Z Axis */}
        <div className="flex flex-col gap-2 w-16 h-48">
          <Button variant="outline" className="h-full w-full" onClick={() => handleJog('Z', 1)}>
            <span className="font-bold">Z+</span>
          </Button>
          <Button variant="outline" className="h-full w-full" onClick={() => handleJog('Z', -1)}>
            <span className="font-bold">Z-</span>
          </Button>
        </div>
      </div>

      {/* Step Size Selector */}
      <div className="space-y-3">
        <Label className="text-xs uppercase text-muted-foreground">Step Size (mm)</Label>
        <div className="flex gap-2">
          {[0.1, 1, 10, 50, 100].map((val) => (
            <Button
              key={val}
              variant={step === val ? "default" : "outline"}
              onClick={() => setStep(val)}
              className={cn("flex-1", step === val && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
            >
              {val}
            </Button>
          ))}
        </div>
      </div>

      {/* Feed Rate Slider (Simulated) */}
      <div className="space-y-3">
        <div className="flex justify-between">
           <Label className="text-xs uppercase text-muted-foreground">Jog Feed Rate</Label>
           <span className="text-xs font-mono text-primary">{feed} mm/min</span>
        </div>
        <input 
          type="range" 
          min="100" 
          max="5000" 
          step="100"
          value={feed}
          onChange={(e) => setFeed(Number(e.target.value))}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
        />
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3 mt-auto">
        <Button variant="destructive" className="w-full" onClick={() => onSend("$X")}>Unlock ($X)</Button>
        <Button variant="outline" className="w-full border-secondary text-secondary hover:bg-secondary/10" onClick={handleHome}>Home ($H)</Button>
      </div>
    </Card>
  );
}
