from fastapi import APIRouter
from pydantic import BaseModel
from pymongo import MongoClient
import os

mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
mongo_client = MongoClient(mongo_uri)
mongo_db = mongo_client["wacky_typo"]

router = APIRouter()

class GameResult(BaseModel):
    player: str
    wpm: int

class Violation(BaseModel):
    player: str
    type: str
    severity: str
    timestamp: str

@router.post("/results")
def save_result(result: GameResult):
    mongo_db.results.insert_one(result.model_dump())
    return {"status": "ok"}

@router.get("/results")
def get_results():
    results = list(mongo_db.results.find({}, {"_id": 0}))
    return results

@router.post("/violations")
def save_violation(v: Violation):
    mongo_db.violations.insert_one(v.model_dump())
    return {"status": "ok"}

@router.get("/violations")
def get_violations():
    violations = list(mongo_db.violations.find({}, {"_id": 0}))
    return violations

@router.delete("/player/{name}")
def delete_player(name: str):
    mongo_db.results.delete_many({"player": name})
    mongo_db.violations.delete_many({"player": name})
    return {"status": "ok"}
