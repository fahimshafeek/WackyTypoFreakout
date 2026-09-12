import httpx
import asyncio
from uuid import UUID
from datetime import datetime
from backend.src.config.settings import settings
from backend.src.db.database import engine
from backend.src.models.incident import Incident, OutcomeEnum
from backend.src.models.session import GameSession, SessionState
from backend.src.ws.connection_manager import manager as ws_manager
from sqlmodel import Session

async def evaluate_apology_task(session_id: UUID, incident_id: UUID, letter: str, apology_text: str, attempt_number: int):
    # Short delay in mock mode
    if settings.mock_llm_mode:
        await asyncio.sleep(2)
        score = 100
        verdict = "pass"
        feedback = "MOCK LLM: This is a perfect apology."
    else:
        payload = {
            "session_id": str(session_id),
            "incident_id": str(incident_id),
            "letter": letter,
            "apology_text": apology_text,
            "attempt_number": attempt_number,
            "min_words": settings.min_apology_words,
            "threshold": settings.sincerity_pass_threshold
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    settings.n8n_sincerity_webhook_url,
                    json=payload,
                    timeout=settings.n8n_request_timeout_seconds
                )
                response.raise_for_status()
                data = response.json()
                score = data.get("sincerity_score", 0)
                verdict = data.get("verdict", "fail")
                feedback = data.get("feedback", "No feedback provided.")
        except Exception as e:
            # Broadcast error and abort DB update
            await ws_manager.send_message(
                session_id,
                "error",
                {"code": "letter_unreachable", "message": "The letter is too upset to be reached right now — try again."}
            )
            return

    # Update DB and broadcast
    with Session(engine) as db:
        incident = db.get(Incident, incident_id)
        game_session = db.get(GameSession, session_id)
        if not incident or not game_session:
            return
            
        incident.sincerity_score = score
        incident.truth_attempt_count += 1
        
        attempts_used = incident.truth_attempt_count
        attempts_remaining = settings.truth_max_attempts_per_incident - attempts_used

        if verdict == "pass":
            incident.outcome = OutcomeEnum.pass_
            incident.resolved_at = datetime.utcnow()
            game_session.state = SessionState.RESOLVED
            db.add(incident)
            db.add(game_session)
            db.commit()
            
            await ws_manager.send_message(
                session_id,
                "apology_verdict",
                {
                    "incident_id": str(incident_id),
                    "verdict": "pass",
                    "sincerity_score": score,
                    "feedback": feedback,
                    "attempts_used": attempts_used,
                    "attempts_remaining": max(0, attempts_remaining)
                }
            )
            
            # Briefly transition to RESOLVED and then TYPING (as described in WS sequence)
            await ws_manager.send_message(session_id, "incident_resolved", {"incident_id": str(incident_id)})
            
            # Update session back to TYPING
            game_session.state = SessionState.TYPING
            db.add(game_session)
            db.commit()
            
        else: # fail
            if attempts_remaining > 0:
                game_session.state = SessionState.INCIDENT_CHOICE
            else:
                game_session.state = SessionState.DARE_PENDING
                incident.outcome = OutcomeEnum.forced_dare
                
            db.add(incident)
            db.add(game_session)
            db.commit()
            
            await ws_manager.send_message(
                session_id,
                "apology_verdict",
                {
                    "incident_id": str(incident_id),
                    "verdict": "fail",
                    "sincerity_score": score,
                    "feedback": feedback,
                    "attempts_used": attempts_used,
                    "attempts_remaining": max(0, attempts_remaining)
                }
            )
