import type { Express } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
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

  // WebSocket Server for GRBL Simulation
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('Client connected to GRBL Simulator');
    
    // Initial state
    let state = 'Idle';
    let x = 0, y = 0, z = 0;
    
    ws.on('message', (message) => {
      const cmd = message.toString().trim();
      
      if (cmd === '?') {
        // Status report
        // Format: <Idle|MPos:0.000,0.000,0.000|FS:0,0>
        ws.send(`<${state}|MPos:${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}|FS:0,0>`);
      } else if (cmd.startsWith('$J=')) {
        // Jogging simulation (simplified)
        // e.g., $J=G91G21X10F1000
        state = 'Run';
        ws.send('ok');
        
        // Parse simple moves for simulation visualization
        if (cmd.includes('X')) x += parseFloat(cmd.split('X')[1]) || 0;
        if (cmd.includes('Y')) y += parseFloat(cmd.split('Y')[1]) || 0;
        if (cmd.includes('Z')) z += parseFloat(cmd.split('Z')[1]) || 0;
        
        setTimeout(() => { state = 'Idle'; }, 500);
      } else if (cmd === '$H') {
        state = 'Home';
        ws.send('ok');
        setTimeout(() => { 
          x = 0; y = 0; z = 0;
          state = 'Idle'; 
        }, 1000);
      } else {
        // Generic ACK
        ws.send('ok');
      }
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
