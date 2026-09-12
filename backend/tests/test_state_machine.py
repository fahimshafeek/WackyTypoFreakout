import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from backend.src.models import GameSession, Incident, Letter
from backend.src.main import app
from backend.src.db.database import get_session, engine as real_engine
import os

# Use a test database
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
from sqlmodel import Session, SQLModel, create_engine
test_engine = create_engine(
    "sqlite:///./test.db",
    connect_args={"check_same_thread": False}
)
SQLModel.metadata.create_all(test_engine)

def get_session_override():
    with Session(test_engine) as session:
        yield session

app.dependency_overrides[get_session] = get_session_override
client = TestClient(app)

def test_start_session():
    response = client.post("/api/session/start")
    assert response.status_code == 201
    data = response.json()
    assert data["state"] == "TYPING"
    assert "session_id" in data

def test_backspace_transition():
    # Start session
    start_resp = client.post("/api/session/start")
    session_id = start_resp.json()["session_id"]
    
    # Backspace
    resp = client.post(f"/api/session/{session_id}/backspace", json={"letter": "a", "position": 5})
    assert resp.status_code == 200
    data = resp.json()
    assert data["state"] == "INCIDENT_CHOICE"
    
    # Backspace again should fail (409)
    resp2 = client.post(f"/api/session/{session_id}/backspace", json={"letter": "b", "position": 4})
    assert resp2.status_code == 409
