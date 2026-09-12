from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import httpx
from uuid import UUID

from backend.src.api import sessions, incidents, letters
from backend.src.ws.connection_manager import manager as ws_manager
from backend.src.db.database import create_db_and_tables
from backend.src.config.settings import settings

app = FastAPI(title="Type & Atone API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from backend.src.models.letter import Letter
from backend.src.db.database import get_session, engine
from sqlmodel import Session, select

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    # Seed letters if empty
    with Session(engine) as session:
        existing = session.exec(select(Letter)).first()
        if not existing:
            import string
            for char in string.ascii_lowercase:
                session.add(Letter(
                    letter=char,
                    persona_name=char.upper(),
                    mood="neutral",
                    flavor_text="A letter of the alphabet.",
                    apology_threshold_modifier=0
                ))
            session.commit()

app.include_router(sessions.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(letters.router, prefix="/api")

@app.get("/api/health")
async def health_check():
    ollama_reachable = False
    n8n_reachable = False
    
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(settings.ollama_base_url, timeout=2.0)
            if r.status_code == 200:
                ollama_reachable = True
        except:
            pass
            
        try:
            # We just check if the n8n host is up, perhaps a generic GET to base URL
            n8n_base = settings.n8n_sincerity_webhook_url.split("/webhook")[0]
            r = await client.get(n8n_base, timeout=2.0)
            if r.status_code == 200:
                n8n_reachable = True
        except:
            pass
            
    return {
        "ollama_reachable": ollama_reachable,
        "n8n_reachable": n8n_reachable
    }

@app.websocket("/ws/session/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: UUID):
    await ws_manager.connect(session_id, websocket)
    try:
        # Just keep connection open, optionally push initial state
        while True:
            data = await websocket.receive_text()
            # The client isn't really sending WS messages per contract, 
            # they use REST. So we just keep the loop alive.
    except WebSocketDisconnect:
        ws_manager.disconnect(session_id)
