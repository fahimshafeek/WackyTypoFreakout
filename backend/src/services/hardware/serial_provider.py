from .base import CrankInputProvider
class SerialCrankProvider(CrankInputProvider):
    def start_listening(self, session_id, incident_id, required_cranks):
        pass
    def stop_listening(self, incident_id):
        pass

import threading
import time
import asyncio
import glob
import collections
from sqlmodel import Session, select
from backend.src.db.database import engine
from backend.src.models.session import GameSession, SessionState
from backend.src.models.incident import Incident, ChoiceEnum
from backend.src.ws.connection_manager import manager as ws_manager

def get_serial_port():
    """Auto-detect the first available USB serial port (cross-platform)."""
    import sys
    if sys.platform == 'win32':
        # On Windows, try COM ports
        import serial.tools.list_ports
        ports = list(serial.tools.list_ports.comports())
        for p in ports:
            if 'USB' in p.description or 'CH340' in p.description or 'CP210' in p.description:
                return p.device
        return None
    else:
        # Linux/macOS: look for ttyUSB* or ttyACM*
        ports = sorted(glob.glob('/dev/ttyUSB*') + glob.glob('/dev/ttyACM*'))
        return ports[0] if ports else None

class SerialReaderThread(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True)
        self.running = True
        self.is_connected = False
        # RPM tracking (same algorithm as standalone RPM dashboard)
        self.current_rpm = 0
        self.last_pulse_time = 0
        self.pulse_deltas = collections.deque(maxlen=4)

    def run(self):
        port_name = get_serial_port()
        if not port_name:
            print("[Hardware] No USB serial port found. Hardware crank disabled.")
            print("[Hardware] Plug in the ESP and restart the server to enable.")
            self.is_connected = False
            return

        try:
            import serial
            s = serial.Serial(port_name, 115200, timeout=1)
            print(f"[Hardware] Opened serial port: {port_name}")
            # Soft-reset the ESP to start its main.py
            time.sleep(0.1)
            s.write(b"\x04")
            self.is_connected = True
        except Exception as e:
            print(f"[Hardware] Failed to open serial port {port_name}: {e}")
            self.is_connected = False
            return

        while self.running:
            try:
                line = s.readline().decode('utf-8', errors='ignore').strip()
                if "PULSE" in line:
                    self._update_rpm()
                    self._handle_pulse()
            except Exception as e:
                time.sleep(1)

    def _update_rpm(self):
        """Update RPM using sliding-window average of pulse deltas."""
        now = time.time()
        if self.last_pulse_time != 0:
            delta = now - self.last_pulse_time
            if delta > 0.05:  # Ignore impossibly fast pulses (>1200 RPM)
                self.pulse_deltas.append(delta)
                avg_delta = sum(self.pulse_deltas) / len(self.pulse_deltas)
                self.current_rpm = int((1.0 / avg_delta) * 60.0)
        self.last_pulse_time = now

    def reset_rpm(self):
        """Reset RPM tracking (called when no pulses for a while)."""
        self.current_rpm = 0
        self.pulse_deltas.clear()
        self.last_pulse_time = 0

    def _handle_pulse(self):
        """Process a single crank pulse against the active dare incident."""
        with Session(engine) as db:
            stmt = select(GameSession).where(GameSession.state == SessionState.DARE_PENDING)
            game_session = db.exec(stmt).first()
            if not game_session:
                return

            stmt2 = select(Incident).where(
                Incident.session_id == game_session.id,
                Incident.choice == ChoiceEnum.dare,
                Incident.outcome == None
            )
            incident = db.exec(stmt2).first()
            if not incident:
                return
                
            new_prog = (incident.crank_progress or 0) + 1
            incident_id = str(incident.id)
            
        # Call the REST API to handle DB updates and WS broadcasting safely on the main event loop
        import urllib.request
        import json
        try:
            url = f"http://127.0.0.1:8000/api/incidents/{incident_id}/crank-progress"
            data = json.dumps({"progress": new_prog}).encode('utf-8')
            req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
            urllib.request.urlopen(req, timeout=1)
        except Exception as e:
            print(f"[Hardware] Error reporting pulse: {e}")

reader = SerialReaderThread()
