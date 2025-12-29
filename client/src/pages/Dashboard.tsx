import { useState } from "react";
import { useGrbl } from "@/hooks/use-grbl";
import { DRO } from "@/components/DRO";
import { JogControl } from "@/components/JogControl";
import { Console } from "@/components/Console";
import { MacroList } from "@/components/MacroList";
import { Button, Input, Badge } from "@/components/ui/shared";
import { Wifi, WifiOff, Power, Play, Pause, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const grbl = useGrbl();
  const { toast } = useToast();
  const [connectUrl, setConnectUrl] = useState("ws://localhost:5000/ws");

  const handleConnection = () => {
    if (grbl.isConnected) {
      grbl.disconnect();
    } else {
      grbl.connect(connectUrl);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Idle": return "success";
      case "Run": return "default";
      case "Alarm": return "destructive";
      case "Hold": return "secondary";
      default: return "outline";
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      toast({ title: "File Loaded", description: `Loaded ${lines.length} lines of G-code.` });
      // In a real app, we would stream these lines via a queue.
      // For now, let's just send the first 5 lines as a demo
      lines.slice(0, 5).forEach(line => {
        if (line.trim()) grbl.send(line.trim());
      });
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      {/* Header / Top Bar */}
      <header className="h-14 border-b border-border/40 bg-card/50 backdrop-blur px-6 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`led ${grbl.isConnected ? 'bg-green-500 shadow-green-500/50' : 'bg-red-500 shadow-red-500/50'}`} />
            <h1 className="font-bold tracking-tight text-lg bg-gradient-to-r from-primary to-cyan-200 bg-clip-text text-transparent">
              LASER<span className="font-light text-foreground">GRBL</span> BRIDGE
            </h1>
          </div>
          <div className="h-6 w-px bg-border/50 mx-2" />
          <Badge variant={getStatusColor(grbl.status)} className="uppercase tracking-widest font-mono">
            {grbl.status}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <Input 
            value={connectUrl}
            onChange={(e) => setConnectUrl(e.target.value)}
            className="w-64 h-8 bg-black/20 font-mono text-xs border-border/50"
            disabled={grbl.isConnected}
          />
          <Button 
            size="sm" 
            variant={grbl.isConnected ? "destructive" : "default"}
            className="h-8 gap-2"
            onClick={handleConnection}
          >
            {grbl.isConnected ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
            {grbl.isConnected ? "Disconnect" : "Connect"}
          </Button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 p-4 md:p-6 grid grid-cols-12 gap-6 overflow-hidden max-h-[calc(100vh-3.5rem)]">
        
        {/* Left Column: DRO & Macros */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-6 overflow-hidden">
          <div className="flex-none">
            <DRO 
              mpos={grbl.mpos} 
              wpos={grbl.wpos} 
              feed={grbl.feed} 
              speed={grbl.speed} 
            />
          </div>
          <div className="flex-1 overflow-hidden min-h-[300px]">
            <MacroList onSend={grbl.send} />
          </div>
        </div>

        {/* Center Column: Jogging & Streamer Controls */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
          <div className="flex-1">
            <JogControl onSend={grbl.send} feedRate={grbl.feed} />
          </div>
          
          {/* File Streamer Panel */}
          <div className="h-48 glass-panel rounded-lg p-4 flex flex-col justify-between border border-border/50 bg-card">
             <div className="flex justify-between items-center mb-2">
               <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-widest">G-Code Streamer</h3>
               <span className="text-xs text-muted-foreground">0%</span>
             </div>
             
             <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden mb-4">
               <div className="h-full bg-primary w-[0%] transition-all duration-300" />
             </div>

             <div className="flex items-center gap-4">
               <div className="flex-1">
                 <label className="block text-xs text-muted-foreground mb-1">Select File (.nc, .gcode)</label>
                 <Input type="file" accept=".nc,.gcode,.txt" onChange={handleFileUpload} className="cursor-pointer file:cursor-pointer text-xs" />
               </div>
               <div className="flex gap-2">
                 <Button size="icon" variant="outline" onClick={() => grbl.send("~")} title="Resume">
                   <Play className="w-4 h-4 text-green-500" />
                 </Button>
                 <Button size="icon" variant="outline" onClick={() => grbl.send("!")} title="Pause">
                   <Pause className="w-4 h-4 text-amber-500" />
                 </Button>
                 <Button size="icon" variant="outline" onClick={() => grbl.send("\x18")} title="Stop/Reset">
                   <Square className="w-4 h-4 text-red-500" />
                 </Button>
               </div>
             </div>
          </div>
        </div>

        {/* Right Column: Console */}
        <div className="col-span-12 lg:col-span-4 h-full overflow-hidden">
          <Console logs={grbl.logs} onSend={grbl.send} />
        </div>
      </main>
    </div>
  );
}
