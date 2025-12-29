import { useState, useRef, useEffect } from "react";
import { Card, Input, Button } from "@/components/ui/shared";
import { Send, Terminal } from "lucide-react";

interface ConsoleProps {
  logs: string[];
  onSend: (cmd: string) => void;
}

export function Console({ logs, onSend }: ConsoleProps) {
  const [cmd, setCmd] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cmd.trim()) {
      onSend(cmd.trim());
      setCmd("");
    }
  };

  return (
    <Card className="flex flex-col h-full bg-black/40 border-border/50">
      <div className="p-3 border-b border-border/50 bg-muted/5 flex items-center gap-2">
        <Terminal className="w-4 h-4 text-primary" />
        <span className="text-xs font-mono font-semibold text-muted-foreground uppercase">Serial Console</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 min-h-[200px] max-h-[400px]">
        {logs.length === 0 && <div className="text-muted-foreground italic opacity-50">No logs yet...</div>}
        {logs.map((log, i) => (
          <div key={i} className={`break-all ${
            log.startsWith('>') ? 'text-cyan-500' :
            log.startsWith('<') ? 'text-green-500' :
            log.startsWith('[SYS]') ? 'text-amber-500' : 
            'text-muted-foreground'
          }`}>
            {log}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-2 border-t border-border/50 flex gap-2">
        <Input 
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          placeholder="Enter G-code..."
          className="font-mono text-xs bg-black/20"
        />
        <Button size="sm" type="submit" variant="ghost" className="px-3">
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </Card>
  );
}
