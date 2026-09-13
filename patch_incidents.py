import sys
import re

with open("/home/athira/WTF/frontend/backend/src/api/incidents.py", "r") as f:
    content = f.read()

new_route = """
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
"""

if "@router.post(\"/hardware/pulse\")" not in content:
    content += new_route
    with open("/home/athira/WTF/frontend/backend/src/api/incidents.py", "w") as f:
        f.write(content)
    print("Patched successfully")
else:
    print("Already patched")
