from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8000
    
    database_url: str = "sqlite:///./db/typeandatone.db"
    
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"
    
    n8n_sincerity_webhook_url: str = "http://localhost:5678/webhook/sincerity-check"
    n8n_request_timeout_seconds: int = 30
    
    min_apology_words: int = 30
    sincerity_pass_threshold: int = 40
    truth_max_attempts_per_incident: int = 3
    dare_base_crank_count: int = 15
    dare_crank_increment: int = 10
    dare_max_crank_count: int = 80
    crank_input_mode: str = "mock"
    
    dev_override_key: str = "changeme123"
    mock_llm_mode: bool = False
    mock_hardware_mode: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
