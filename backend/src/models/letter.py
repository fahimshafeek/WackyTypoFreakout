from sqlmodel import SQLModel, Field

class Letter(SQLModel, table=True):
    __tablename__ = "letters"
    
    letter: str = Field(primary_key=True, max_length=1)
    persona_name: str
    mood: str
    flavor_text: str
    apology_threshold_modifier: int = Field(default=0)
