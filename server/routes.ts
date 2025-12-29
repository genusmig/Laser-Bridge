import type { Express } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createConnection } from "net";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Macros API
  app.get(api.macros.list.path, async (req, res) => {
    const macros = await storage.getMacros();
    res.json(macros);
  });

  app.post(api.macros.create.path, async (req, res) => {
    try {
      const input = api.macros.create.input.parse(req.body);
      const macro = await storage.createMacro(input);
      res.status(201).json(macro);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.macros.update.path, async (req, res) => {
    try {
      const input = api.macros.update.input.parse(req.body);
      const macro = await storage.updateMacro(Number(req.params.id), input);
      if (!macro) return res.status(404).json({ message: "Macro not found" });
      res.json(macro);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.macros.delete.path, async (req, res) => {
    await storage.deleteMacro(Number(req.params.id));
    res.status(204).send();
  });

  // WebSocket Server + Direct Serial bridge (or optional LightBurn TCP bridge)
  const SERIAL_DEVICE = process.env.SERIAL_DEVICE || "/dev/ttyUSB0";
  const SERIAL_BAUD = parseInt(process.env.SERIAL_BAUD || "115200", 10);
  const USE_LIGHTBURN_BRIDGE = (process.env.USE_LIGHTBURN_BRIDGE === '1') || !!process.env.LIGHTBURN_TCP_PORT;
  const LIGHTBURN_TCP_PORT = parseInt(process.env.LIGHTBURN_TCP_PORT || "3333", 10);
  const LIGHTBURN_STATUS_WS = process.env.LIGHTBURN_STATUS_WS || "ws://localhost:5000/ws";

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  let runtimeState: any = {
    status: "Disconnected",
    mpos: { x: 0, y: 0, z: 0 },
    wpos: { x: 0, y: 0, z: 0 },
    feed: 0,
    speed: 0,
    client_connected: false,
    streaming: false,
    air_state: false,
    air_override_force: false,
    serial_device: SERIAL_DEVICE
  };

  const clients = new Set<WebSocket>();

  // Dynamic serialport import (optional dev-friendly)
  let SerialPort: any = null;
  let ReadlineParser: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sp = require('serialport');
    SerialPort = sp.SerialPort || sp;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ReadlineParser = require('@serialport/parser-readline').ReadlineParser;
  } catch (e) {
    console.warn('serialport packages not installed; running in simulated mode');
  }

  // Parser for GRBL status strings (same format as client)
  function parseStatus(statusStr: string) {
    if (!statusStr.startsWith('<') || !statusStr.endsWith('>')) return;
    const content = statusStr.slice(1, -1);
    const parts = content.split('|');
    const status = parts[0];

    let mpos = runtimeState.mpos;
    let wpos = runtimeState.wpos;
    let feed = runtimeState.feed;
    let speed = runtimeState.speed;

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

    runtimeState = { ...runtimeState, status, mpos, wpos, feed, speed };
    broadcastState();
  }

  function broadcastState() {
    const msg = JSON.stringify(runtimeState);
    for (const c of clients) {
      try { c.send(msg); } catch (_) {}
    }
  }

  // Serial connection (or simulation fallback) or optional LightBurn TCP bridge
  let port: any = null;
  let parser: any = null;
  let tcpClient: any = null;
  let streamTimer: NodeJS.Timeout | null = null;
  let bridgeReconnectTimer: NodeJS.Timeout | null = null;

  function setStreaming(active: boolean) {
    runtimeState.streaming = active;
    broadcastState();
    if (!active && streamTimer) {
      clearTimeout(streamTimer);
      streamTimer = null;
    }
  }

  async function openSerial() {
    if (!SerialPort) return;
    try {
      port = new SerialPort({ path: SERIAL_DEVICE, baudRate: SERIAL_BAUD, autoOpen: true });
      parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

      port.on('open', () => {
        console.log(`Serial opened: ${SERIAL_DEVICE} @ ${SERIAL_BAUD}`);
        runtimeState.serial_device = SERIAL_DEVICE;
        runtimeState.status = 'Idle';
        broadcastState();
      });

      port.on('error', (err: any) => {
        console.warn('Serial error', err);
        runtimeState.status = 'Disconnected';
        broadcastState();
      });

      parser.on('data', (line: string) => {
        try {
          line = line.toString().trim();
          // Forward to all connected WS clients
          for (const c of clients) {
            try { c.send(line); } catch (_) {}
          }

          // Parse for GRBL status
          if (line.startsWith('<') && line.endsWith('>')) parseStatus(line);

          // If line is 'ok' and streaming, schedule stream end
          if (line === 'ok' && runtimeState.streaming) {
            if (streamTimer) clearTimeout(streamTimer);
            streamTimer = setTimeout(() => setStreaming(false), 1500);
          }
        } catch (e) {
          console.warn('Serial parse error', e);
        }
      });
    } catch (e) {
      console.warn('Failed to open serial:', e);
    }
  }

  function openBridge() {
    if (tcpClient) return; // already connected or connecting

    console.log(`Connecting to LightBurn TCP bridge on ${LIGHTBURN_TCP_PORT}`);
    tcpClient = createConnection({ port: LIGHTBURN_TCP_PORT, host: '127.0.0.1' }, () => {
      console.log('Connected to LightBurn TCP bridge');
      runtimeState.serial_device = `tcp:${LIGHTBURN_TCP_PORT}`;
      runtimeState.status = 'Idle';
      broadcastState();
    });

    tcpClient.on('data', (buf: Buffer) => {
      const text = buf.toString();
      // Split into lines
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        // Forward to clients
        for (const c of clients) {
          try { c.send(line); } catch (_) {}
        }
        if (line.startsWith('<') && line.endsWith('>')) parseStatus(line);
        if (line === 'ok' && runtimeState.streaming) {
          if (streamTimer) clearTimeout(streamTimer);
          streamTimer = setTimeout(() => setStreaming(false), 1500);
        }
      }
    });

    tcpClient.on('error', (err: any) => {
      console.warn('TCP bridge error', err);
      runtimeState.status = 'Disconnected';
      broadcastState();
    });

    tcpClient.on('close', () => {
      console.log('TCP bridge connection closed');
      tcpClient = null;
      runtimeState.status = 'Disconnected';
      broadcastState();
      // Reconnect with backoff
      if (bridgeReconnectTimer) clearTimeout(bridgeReconnectTimer);
      bridgeReconnectTimer = setTimeout(() => openBridge(), 1000);
    });
  }

  // Subscribe to bridge status WS (if available) to keep runtimeState in sync
  function connectStatusWS() {
    try {
      const statusWs = new WebSocket(LIGHTBURN_STATUS_WS);
      statusWs.on('open', () => { console.log('Connected to LightBurn status WS'); });
      statusWs.on('message', (msg: string) => {
        try {
          const obj = JSON.parse(msg.toString());
          runtimeState = { ...runtimeState, ...obj };
          broadcastState();
        } catch (e) {
          console.warn('Invalid status message from bridge WS', e);
        }
      });
      statusWs.on('close', () => {
        console.log('Bridge status WS closed, reconnecting in 1s');
        setTimeout(connectStatusWS, 1000);
      });
      statusWs.on('error', (err) => { console.warn('Bridge status WS error', err); });
    } catch (e) {
      console.warn('Failed to connect to bridge status WS', e);
    }
  }

  // Open serial or bridge early (best-effort)
  if (USE_LIGHTBURN_BRIDGE) {
    openBridge();
    connectStatusWS();
  } else {
    openSerial();
  }

  // WebSocket handling
  wss.on('connection', (ws) => {
    console.log('Client connected to server WS');
    clients.add(ws);
    runtimeState.client_connected = true;
    broadcastState();

    // send initial state snapshot
    ws.send(JSON.stringify(runtimeState));

    ws.on('message', (msg) => {
      const line = msg.toString().trim();
      if (!line) return;

      // Detect stream start
      if (!runtimeState.streaming && (/^[\$GM]/i).test(line)) {
        setStreaming(true);
      }
      // reset idle timer
      if (streamTimer) { clearTimeout(streamTimer); streamTimer = null; }
      streamTimer = setTimeout(() => setStreaming(false), 5000);

      // Forward to bridge TCP if enabled, otherwise to serial, otherwise simulate
      if (USE_LIGHTBURN_BRIDGE) {
        if (tcpClient && !tcpClient.destroyed) {
          try { tcpClient.write(line + '\n'); } catch (e) { console.warn('TCP bridge write failed', e); }
        } else {
          // If bridge not connected, reply with an error status to clients
          for (const c of clients) {
            try { c.send('ERROR: Bridge not connected'); } catch (_) {}
          }
        }
      } else if (port && port.writable) {
        try { port.write(line + '\n'); } catch (e) { console.warn('Serial write failed', e); }
      } else {
        // Simulated response
        setTimeout(() => {
          for (const c of clients) {
            try { c.send('ok'); } catch (_) {}
          }
        }, 30);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      if (clients.size === 0) runtimeState.client_connected = false;
      broadcastState();
    });

    ws.on('error', (err) => {
      console.warn('WS client error', err);
      clients.delete(ws);
      if (clients.size === 0) runtimeState.client_connected = false;
      broadcastState();
    });
  });

  return httpServer;
}

async function seedDatabase() {
  const macros = await storage.getMacros();
  if (macros.length === 0) {
    await storage.createMacro({ name: "Home All", gcode: "$H", color: "red" });
    await storage.createMacro({ name: "Laser Test (Low)", gcode: "M3 S10\nG4 P0.5\nM5", color: "amber" });
    await storage.createMacro({ name: "Frame Boundary", gcode: "G0 X0 Y0\nG0 X100 Y0\nG0 X100 Y100\nG0 X0 Y100\nG0 X0 Y0", color: "blue" });
  }
}

// Call seed
seedDatabase().catch(console.error);
