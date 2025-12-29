import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export type MachineStatus = "Disconnected" | "Connecting" | "Idle" | "Run" | "Alarm" | "Hold" | "Door" | "Check";

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface GrblState {
  status: MachineStatus;
  mpos: Position;
  wpos: Position;
  feed: number;
  speed: number;
  logs: string[];
}

export function useGrbl() {
  const [url, setUrl] = useState<string>("ws://localhost:5000/ws");
  const [isConnected, setIsConnected] = useState(false);
  const [state, setState] = useState<GrblState>({
    status: "Disconnected",
    mpos: { x: 0, y: 0, z: 0 },
    wpos: { x: 0, y: 0, z: 0 },
    feed: 0,
    speed: 0,
    logs: [],
  });

  const ws = useRef<WebSocket | null>(null);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Logging helper
  const addLog = useCallback((msg: string, type: 'tx' | 'rx' | 'sys' = 'sys') => {
    setState(prev => {
      const newLog = `${type === 'tx' ? '> ' : type === 'rx' ? '< ' : '[SYS] '}${msg}`;
      // Keep last 100 lines
      return { ...prev, logs: [...prev.logs.slice(-99), newLog] };
    });
  }, []);

  // Parser for GRBL status strings
  // Example: <Idle|MPos:0.000,0.000,0.000|FS:0,0>
  const parseStatus = useCallback((statusStr: string) => {
    // Remove <> brackets
    const content = statusStr.slice(1, -1);
    const parts = content.split('|');
    
    // First part is always status
    const status = parts[0] as MachineStatus;
    
    let mpos = { ...state.mpos };
    let wpos = { ...state.wpos };
    let feed = state.feed;
    let speed = state.speed;

    parts.slice(1).forEach(part => {
      if (part.startsWith('MPos:')) {
        const coords = part.substring(5).split(',').map(Number);
        if (coords.length >= 3) mpos = { x: coords[0], y: coords[1], z: coords[2] };
      } else if (part.startsWith('WPos:')) {
        const coords = part.substring(5).split(',').map(Number);
        if (coords.length >= 3) wpos = { x: coords[0], y: coords[1], z: coords[2] };
      } else if (part.startsWith('FS:')) {
        const fs = part.substring(3).split(',').map(Number);
        if (fs.length >= 2) {
          feed = fs[0];
          speed = fs[1];
        }
      }
    });

    setState(prev => ({ ...prev, status, mpos, wpos, feed, speed }));
  }, [state.mpos, state.wpos, state.feed, state.speed]);

  const connect = useCallback((wsUrl: string) => {
    try {
      if (ws.current) ws.current.close();
      
      addLog(`Connecting to ${wsUrl}...`);
      const socket = new WebSocket(wsUrl);
      ws.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        setState(prev => ({ ...prev, status: "Idle" })); // Assume Idle on connect
        addLog("Connected", "sys");
        toast({ title: "Connected", description: "Bridge established successfully." });
        
        // Start polling status
        pollInterval.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send("?");
          }
        }, 200);
      };

      socket.onclose = () => {
        setIsConnected(false);
        setState(prev => ({ ...prev, status: "Disconnected" }));
        addLog("Disconnected", "sys");
        if (pollInterval.current) clearInterval(pollInterval.current);
      };

      socket.onerror = (err) => {
        addLog(`Connection Error`, "sys");
        toast({ title: "Connection Failed", description: "Could not reach WebSocket server.", variant: "destructive" });
      };

      socket.onmessage = (event) => {
        const msg = event.data as string;
        // Don't log every status report to keep console clean, usually
        if (msg.startsWith('<')) {
          parseStatus(msg);
        } else {
          addLog(msg.trim(), 'rx');
        }
      };

      setUrl(wsUrl);
    } catch (e) {
      console.error(e);
      addLog("Failed to create WebSocket", "sys");
    }
  }, [addLog, parseStatus, toast]);

  const disconnect = useCallback(() => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  }, []);

  const send = useCallback((gcode: string) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      // Simulation Mode if disconnected
      addLog(`(Sim) ${gcode}`, 'tx');
      
      // Simulate simple movement for UI feedback
      if (gcode.includes('X') || gcode.includes('Y') || gcode.includes('Z')) {
        setTimeout(() => {
           addLog('ok', 'rx');
           // In a real sim, we'd update mpos here, but for now just ack
        }, 50);
      } else {
        setTimeout(() => addLog('ok', 'rx'), 50);
      }
      return;
    }

    addLog(gcode, 'tx');
    ws.current.send(gcode + "\n");
  }, [addLog]);

  // Clean up
  useEffect(() => {
    return () => {
      if (ws.current) ws.current.close();
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, []);

  return {
    ...state,
    isConnected,
    url,
    connect,
    disconnect,
    send
  };
}
