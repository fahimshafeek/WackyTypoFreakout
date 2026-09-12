from fastapi import WebSocket
from typing import Dict
from uuid import UUID

class ConnectionManager:
    def __init__(self):
        # Maps session_id to active WebSocket
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, session_id: UUID, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[str(session_id)] = websocket

    def disconnect(self, session_id: UUID):
        session_id_str = str(session_id)
        if session_id_str in self.active_connections:
            del self.active_connections[session_id_str]

    async def send_message(self, session_id: UUID, event: str, data: dict):
        session_id_str = str(session_id)
        if session_id_str in self.active_connections:
            websocket = self.active_connections[session_id_str]
            payload = {"event": event, "data": data}
            await websocket.send_json(payload)

manager = ConnectionManager()
