from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session
from uuid import UUID
from datetime import datetime

from backend.src.db.database import get_session
from backend.src.models.session import GameSession, SessionState
from backend.src.models.incident import Incident
from backend.src.ws.connection_manager import manager as ws_manager

router = APIRouter(prefix="/session", tags=["session"])

class BackspaceRequest(BaseModel):
    letter: str
    position: int

class ProgressRequest(BaseModel):
    typed_text: str

@router.post("/start", status_code=status.HTTP_201_CREATED)
async def start_session(db: Session = Depends(get_session)):
    # Create new session
    session_obj = GameSession(
        state=SessionState.TYPING,
        target_text="the quick brown fox jumps over the lazy dog" # Hardcoded for now
    )
    db.add(session_obj)
    db.commit()
    db.refresh(session_obj)
    
    return {
        "session_id": session_obj.id,
        "state": session_obj.state,
        "target_text": session_obj.target_text,
        "started_at": session_obj.started_at
    }

@router.post("/{id}/progress")
async def report_progress(id: UUID, req: ProgressRequest, db: Session = Depends(get_session)):
    session_obj = db.get(GameSession, id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Just an endpoint, no strict logic yet
    return {"status": "ok"}

@router.post("/{id}/backspace")
async def report_backspace(id: UUID, req: BackspaceRequest, db: Session = Depends(get_session)):
    session_obj = db.get(GameSession, id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session_obj.state != SessionState.TYPING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "incident_already_active", "current_state": session_obj.state.value}
        )
    
    # Create incident
    incident = Incident(
        session_id=session_obj.id,
        letter=req.letter.lower()
    )
    db.add(incident)
    
    # Update session state
    session_obj.state = SessionState.INCIDENT_CHOICE
    db.add(session_obj)
    db.commit()
    db.refresh(incident)
    
    # Broadcast incident_started over WS
    await ws_manager.send_message(
        session_obj.id,
        "incident_started",
        {
            "incident_id": str(incident.id),
            "letter": incident.letter,
            "sound_cue": "letter_hit_generic"
        }
    )
    
    return {
        "incident_id": incident.id,
        "letter": incident.letter,
        "state": session_obj.state,
        "sound_cue": "letter_hit_generic"
    }

@router.post("/{id}/complete")
async def complete_session(id: UUID, db: Session = Depends(get_session)):
    session_obj = db.get(GameSession, id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_obj.state = SessionState.COMPLETE
    session_obj.finished_at = datetime.utcnow()
    # Mock compute stats
    session_obj.wpm = 60.0
    session_obj.accuracy = 95.0
    db.add(session_obj)
    db.commit()
    
    payload = {
        "wpm": session_obj.wpm,
        "accuracy": session_obj.accuracy,
        "total_backspaces": 5, # Mock
        "total_incidents": 4,  # Mock
        "truths_passed": 3,    # Mock
        "dares_completed": 1,  # Mock
        "finished_at": session_obj.finished_at.isoformat()
    }
    
    await ws_manager.send_message(session_obj.id, "session_complete", payload)
    
    return payload
