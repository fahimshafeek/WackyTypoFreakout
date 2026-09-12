from enum import Enum
from sqlmodel import SQLModel, Field
from uuid import UUID, uuid4
from typing import Optional
from datetime import datetime

class ChoiceEnum(str, Enum):
    truth = "truth"
    dare = "dare"

class OutcomeEnum(str, Enum):
    pass_ = "pass" # 'pass' is a reserved keyword in python
    fail = "fail"
    forced_dare = "forced_dare"

class Incident(SQLModel, table=True):
    __tablename__ = "incidents"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    session_id: UUID = Field(foreign_key="sessions.id")
    letter: str = Field(max_length=1)
    choice: Optional[ChoiceEnum] = None
    truth_attempt_count: int = Field(default=0)
    sincerity_score: Optional[int] = None
    crank_required: Optional[int] = None
    crank_progress: Optional[int] = None
    outcome: Optional[OutcomeEnum] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None
