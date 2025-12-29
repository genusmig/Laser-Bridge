#!/usr/bin/env python3
import socket
import serial
import threading
import time
import atexit
import configparser
import os
import sys
import json
from flask import Flask, jsonify, request
from flask_sock import Sock

CONFIG_PATH = "/config.ini"

# =========================
# Logging (stdout only)
# =========================
def log(msg):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)

# =========================
# Load Config
# =========================
cfg = configparser.ConfigParser()
cfg.read(CONFIG_PATH)

AIR_ENABLE = cfg.getboolean("gpio", "air_enable", fallback=False)
AIR_PIN = cfg.getint("gpio", "air_pin", fallback=17)
AIR_ACTIVE_HIGH = cfg.getboolean("gpio", "air_active_high", fallback=True)
AIR_FORCE = cfg.getboolean("gpio", "air_override_force", fallback=False)

SERIAL_DEV = cfg.get("grbl", "device", fallback="/dev/ttyUSB0")
SERIAL_BAUD = cfg.getint("grbl", "baudrate", fallback=115200)

TCP_PORT = cfg.getint("bridge", "tcp_port", fallback=3333)

# =========================
# Runtime State (IN-MEMORY)
# =========================
runtime_state = {
    "client_connected": False,
    "streaming": False,
    "air_state": False,
    "air_override_force": AIR_FORCE,
    "serial_device": SERIAL_DEV
}

ws_clients = set()

def push_state():
    msg = json.dumps(runtime_state)
    dead = []
    for ws in ws_clients:
        try:
            ws.send(msg)
        except:
            dead.append(ws)
    for ws in dead:
        ws_clients.remove(ws)

# =========================
# GPIO
# =========================
air_state = False

if AIR_ENABLE:
    try:
        import RPi.GPIO as GPIO
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(AIR_PIN, GPIO.OUT)
        off = GPIO.LOW if AIR_ACTIVE_HIGH else GPIO.HIGH
        GPIO.output(AIR_PIN, off)
        log(f"GPIO ready (pin {AIR_PIN})")
    except Exception as e:
        log(f"GPIO failed: {e}")
        AIR_ENABLE = False

def set_air(on, source):
    global air_state
    if not AIR_ENABLE:
        return
    state = GPIO.HIGH if (on == AIR_ACTIVE_HIGH) else GPIO.LOW
    GPIO.output(AIR_PIN, state)
    air_state = on
    runtime_state["air_state"] = on
    push_state()
    log(f"AIR {'ON' if on else 'OFF'} [{source}]")

# =========================
# Serial
# =========================
streaming = False
client_connected = False

ser = serial.Serial(SERIAL_DEV, SERIAL_BAUD, timeout=0.1)
log(f"GRBL connected: {SERIAL_DEV}")

def on_stream_start():
    global streaming
    streaming = True
    runtime_state["streaming"] = True
    push_state()
    log("STREAM START")
    if not AIR_FORCE:
        set_air(False, "STREAM_START")

def on_stream_end():
    global streaming
    streaming = False
    runtime_state["streaming"] = False
    push_state()
    log("STREAM END")
    if not AIR_FORCE:
        set_air(False, "STREAM_END")

def handle_gcode(line):
    if not AIR_ENABLE or AIR_FORCE:
        return
    l = line.upper()
    if l.startswith(("M7", "M8")):
        set_air(True, "M8")
    elif l.startswith("M9"):
        set_air(False, "M9")

# =========================
# Serial Reader
# =========================
def serial_reader(client):
    try:
        while client_connected:
            line = ser.readline().decode(errors="ignore").strip()
            if not line:
                continue
            handle_gcode(line)
            client.sendall((line + "\n").encode())
    except Exception as e:
        log(f"Serial RX error: {e}")

# =========================
# TCP Bridge
# =========================
def tcp_server():
    global client_connected

    sock = socket.socket()
    sock.bind(("0.0.0.0", TCP_PORT))
    sock.listen(1)

    log(f"Bridge listening on {TCP_PORT}")

    while True:
        client, addr = sock.accept()
        client_connected = True
        runtime_state["client_connected"] = True
        push_state()
        log(f"Client {addr[0]} connected")

        t = threading.Thread(target=serial_reader, args=(client,), daemon=True)
        t.start()

        try:
            while True:
                data = client.recv(1024)
                if not data:
                    break
                line = data.decode(errors="ignore").strip()
                if not line:
                    continue
                if line[0] in ("$", "G", "M") and not streaming:
                    on_stream_start()
                ser.write((line + "\n").encode())
        except Exception as e:
            log(f"Client error: {e}")

        client.close()
        client_connected = False
        runtime_state["client_connected"] = False
        push_state()
        on_stream_end()
        log("Client disconnected")

# =========================
# HTTP + WebSocket API
# =========================
app = Flask(__name__)
sock_api = Sock(app)

@app.route("/status", methods=["GET"])
def status():
    return jsonify(runtime_state)

@app.route("/restart", methods=["POST"])
def restart():
    log("Restart requested via API")
    os.execv(sys.executable, [sys.executable] + sys.argv)

@sock_api.route("/ws")
def ws(ws):
    ws_clients.add(ws)
    ws.send(json.dumps(runtime_state))
    while True:
        ws.receive()  # keep alive

def run_api():
    app.run(host="0.0.0.0", port=5000, threaded=True)

# =========================
# Cleanup
# =========================
def cleanup():
    log("Shutdown → AIR OFF")
    runtime_state["client_connected"] = False
    runtime_state["streaming"] = False
    push_state()
    if AIR_ENABLE:
        set_air(False, "SHUTDOWN")
        GPIO.cleanup()
    ser.close()

atexit.register(cleanup)

# =========================
# Start
# =========================
if __name__ == "__main__":
    threading.Thread(target=run_api, daemon=True).start()
    log(f"Bridge started (AIR_FORCE={AIR_FORCE})")
    tcp_server()
