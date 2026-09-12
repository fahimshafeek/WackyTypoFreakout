from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from backend.src.db.database import get_session
from backend.src.models.letter import Letter

router = APIRouter(prefix="/letters", tags=["letters"])

@router.get("/{letter}")
async def get_letter_profile(letter: str, db: Session = Depends(get_session)):
    char = letter.lower()
    letter_obj = db.get(Letter, char)
    if not letter_obj:
        raise HTTPException(status_code=404, detail="Letter profile not found")
        
    return {
        "letter": letter_obj.letter,
        "persona_name": letter_obj.persona_name,
        "mood": letter_obj.mood,
        "flavor_text": letter_obj.flavor_text,
        "apology_threshold_modifier": letter_obj.apology_threshold_modifier
    }
