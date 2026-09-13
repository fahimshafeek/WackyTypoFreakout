from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from pydantic import BaseModel
from sqlmodel import Session
from uuid import UUID

from backend.src.db.database import get_session
from backend.src.models.session import GameSession, SessionState
from backend.src.models.incident import Incident, ChoiceEnum
from backend.src.models.letter import Letter
from backend.src.config.settings import settings
from backend.src.ws.connection_manager import manager as ws_manager
from backend.src.services.sincerity_gate import check_word_count, is_truth_escalated
from backend.src.services.difficulty import calculate_crank_required
from backend.src.services.n8n_client import evaluate_apology_task

router = APIRouter(prefix="/incident", tags=["incident"])

class ChoiceRequest(BaseModel):
    choice: ChoiceEnum

class ApologyRequest(BaseModel):
    text: str

class CrankProgressRequest(BaseModel):
    progress: int

@router.post("/{id}/choice")
async def choose_path(id: UUID, req: ChoiceRequest, db: Session = Depends(get_session)):
    incident = db.get(Incident, id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    game_session = db.get(GameSession, incident.session_id)
    if not game_session or game_session.state != SessionState.INCIDENT_CHOICE:
        raise HTTPException(status_code=400, detail="Not in INCIDENT_CHOICE state")
        
    incident.choice = req.choice
    
    if req.choice == ChoiceEnum.truth:
        game_session.state = SessionState.TRUTH_PENDING
        db.add(incident)
        db.add(game_session)
        db.commit()
        
        # Get letter profile
        letter = db.get(Letter, incident.letter)
        letter_profile = {
            "letter": incident.letter,
            "persona_name": letter.persona_name if letter else f"{incident.letter.upper()}",
            "flavor_text": letter.flavor_text if letter else "No profile."
        }
        
        return {
            "state": game_session.state,
            "letter_profile": letter_profile,
            "min_words_required": settings.min_apology_words
        }
        
    else: # dare
        game_session.state = SessionState.DARE_PENDING
        game_session.dare_attempt_count += 1
        incident.crank_required = calculate_crank_required(game_session.dare_attempt_count)
        incident.crank_progress = 0
        db.add(incident)
        db.add(game_session)
        db.commit()
        
        from backend.src.services.hardware.serial_provider import reader
        return {
            "state": game_session.state,
            "crank_required": incident.crank_required,
            "hardware_connected": getattr(reader, 'is_connected', False)
        }

@router.post("/{id}/apology", status_code=status.HTTP_202_ACCEPTED)
async def submit_apology(id: UUID, req: ApologyRequest, bg_tasks: BackgroundTasks, db: Session = Depends(get_session)):
    incident = db.get(Incident, id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    game_session = db.get(GameSession, incident.session_id)
    if not game_session or game_session.state != SessionState.TRUTH_PENDING:
        raise HTTPException(status_code=400, detail="Not in TRUTH_PENDING state")
        
    if is_truth_escalated(incident.truth_attempt_count):
        raise HTTPException(status_code=400, detail="Truth attempts exhausted")

    # Broadcast processing
    await ws_manager.send_message(
        game_session.id,
        "apology_processing",
        {"incident_id": str(incident.id)}
    )
    
    # Schedule bg task
    bg_tasks.add_task(
        evaluate_apology_task,
        session_id=game_session.id,
        incident_id=incident.id,
        letter=incident.letter,
        apology_text=req.text,
        attempt_number=incident.truth_attempt_count + 1
    )
    
    return {"status": "processing"}

@router.post("/{id}/crank-progress")
async def report_crank_progress(id: UUID, req: CrankProgressRequest, db: Session = Depends(get_session)):
    incident = db.get(Incident, id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    game_session = db.get(GameSession, incident.session_id)
    if not game_session or game_session.state != SessionState.DARE_PENDING:
        raise HTTPException(status_code=400, detail="Not in DARE_PENDING state")
        
    incident.crank_progress = req.progress
    
    # Check completion
    if incident.crank_required is not None and incident.crank_progress >= incident.crank_required:
        incident.outcome = "pass"
        game_session.state = SessionState.RESOLVED
        
        db.add(incident)
        db.add(game_session)
        db.commit()
        
        await ws_manager.send_message(
            game_session.id,
            "dare_complete",
            {"incident_id": str(incident.id)}
        )
        
        await ws_manager.send_message(
            game_session.id,
            "incident_resolved",
            {"incident_id": str(incident.id)}
        )
        
        game_session.state = SessionState.TYPING
        db.add(game_session)
        db.commit()
        
        return {"status": "complete"}
    
    db.add(incident)
    db.commit()
    
    await ws_manager.send_message(
        game_session.id,
        "crank_progress",
        {
            "incident_id": str(incident.id),
            "current": incident.crank_progress,
            "required": incident.crank_required
        }
    )
    
    return {"status": "accepted"}

@router.post("/{id}/override")
async def dev_override(id: UUID, key: str, db: Session = Depends(get_session)):
    if key != settings.dev_override_key:
        raise HTTPException(status_code=403, detail="Invalid override key")
        
    incident = db.get(Incident, id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    game_session = db.get(GameSession, incident.session_id)
    
    incident.outcome = "pass"
    game_session.state = SessionState.RESOLVED
    db.add(incident)
    db.add(game_session)
    db.commit()
    
    # Push WS events to resume typing
    import asyncio
    asyncio.create_task(ws_manager.send_message(
        game_session.id,
        "incident_resolved",
        {"incident_id": str(incident.id)}
    ))
    
    game_session.state = SessionState.TYPING
    db.add(game_session)
    db.commit()
    
    return {"status": "overridden"}


@router.post("/hardware/pulse")
async def hardware_pulse(db: Session = Depends(get_session)):
    from sqlmodel import select
    # Find active session in DARE_PENDING
    stmt = select(GameSession).where(GameSession.state == SessionState.DARE_PENDING)
    game_session = db.exec(stmt).first()
    if not game_session:
        return {"status": "ignored", "reason": "no_active_dare"}
        
    # Find active dare incident
    stmt2 = select(Incident).where(
        Incident.session_id == game_session.id,
        Incident.choice == ChoiceEnum.dare,
        Incident.outcome == None
    )
    incident = db.exec(stmt2).first()
    
    if not incident:
        return {"status": "ignored", "reason": "no_active_incident"}
        
    incident.crank_progress = (incident.crank_progress or 0) + 1
    
    # Check completion
    if incident.crank_required is not None and incident.crank_progress >= incident.crank_required:
        incident.outcome = "pass"
        game_session.state = SessionState.RESOLVED
        
        db.add(incident)
        db.add(game_session)
        db.commit()
        
        # We need to trigger async WS messages, but we are inside an async function so we can await
        import asyncio
        asyncio.create_task(ws_manager.send_message(
            game_session.id,
            "dare_complete",
            {"incident_id": str(incident.id)}
        ))
        asyncio.create_task(ws_manager.send_message(
            game_session.id,
            "incident_resolved",
            {"incident_id": str(incident.id)}
        ))
        
        game_session.state = SessionState.TYPING
        db.add(game_session)
        db.commit()
        
        return {"status": "complete"}
    
    db.add(incident)
    db.commit()
    
    import asyncio
    asyncio.create_task(ws_manager.send_message(
        game_session.id,
        "crank_progress",
        {
            "incident_id": str(incident.id),
            "current": incident.crank_progress,
            "required": incident.crank_required
        }
    ))
    
    return {"status": "accepted", "current": incident.crank_progress}
