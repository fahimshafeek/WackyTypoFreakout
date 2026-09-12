from .base import CrankInputProvider

class SerialCrankProvider(CrankInputProvider):
    def start_listening(self, session_id: str, incident_id: str, required_cranks: int):
        # TODO: Implement in Phase 2
        pass

    def stop_listening(self, incident_id: str):
        # TODO: Implement in Phase 2
        pass
