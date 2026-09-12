from enum import Enum
from sqlmodel import SQLModel, Field
from uuid import UUID, uuid4
from typing import Optional
from datetime import datetime

class SessionState(str, Enum):
    IDLE = "IDLE"
    TYPING = "TYPING"
    INCIDENT_CHOICE = "INCIDENT_CHOICE"
    TRUTH_PENDING = "TRUTH_PENDING"
    DARE_PENDING = "DARE_PENDING"
    RESOLVED = "RESOLVED"
    COMPLETE = "COMPLETE"

class GameSession(SQLModel, table=True):
    __tablename__ = "sessions"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    state: SessionState = Field(default=SessionState.IDLE)
    target_text: str = Field(default="")
    dare_attempt_count: int = Field(default=0)
    started_at: datetime = Field(default_factory=datetime.utcnow)
    finished_at: Optional[datetime] = None
    wpm: Optional[float] = None
    accuracy: Optional[float] = None
