from .base import CrankInputProvider
from .serial_provider import SerialCrankProvider
from .vision_provider import VisionCrankProvider

def get_crank_provider(mode: str) -> CrankInputProvider:
    if mode == "serial":
        return SerialCrankProvider()
    elif mode == "vision":
        return VisionCrankProvider()
    else:
        # Mock provider or unhandled
        class MockProvider(CrankInputProvider):
            def start_listening(self, session_id: str, incident_id: str, required_cranks: int):
                pass
            def stop_listening(self, incident_id: str):
                pass
        return MockProvider()
