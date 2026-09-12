from abc import ABC, abstractmethod

class CrankInputProvider(ABC):
    @abstractmethod
    def start_listening(self, session_id: str, incident_id: str, required_cranks: int):
        pass

    @abstractmethod
    def stop_listening(self, incident_id: str):
        pass
