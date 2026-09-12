from backend.src.config.settings import settings

def calculate_crank_required(dare_attempt_count: int) -> int:
    """
    Calculates the number of crank rotations required for the dare path.
    Assumes dare_attempt_count is already incremented for the current attempt.
    """
    # If it's somehow 0 or negative, we treat it as the first attempt
    attempts = max(1, dare_attempt_count)
    crank_required = settings.dare_base_crank_count + settings.dare_crank_increment * (attempts - 1)
    return min(crank_required, settings.dare_max_crank_count)
