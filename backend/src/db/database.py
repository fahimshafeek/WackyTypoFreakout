import os
from sqlmodel import create_engine, SQLModel, Session
from backend.src.config.settings import settings

# Ensure db directory exists
db_path = settings.database_url.replace("sqlite:///", "")
os.makedirs(os.path.dirname(db_path), exist_ok=True)

engine = create_engine(
    settings.database_url, 
    connect_args={"check_same_thread": False} # Needed for SQLite with FastAPI
)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
