from backend.src.config.settings import settings

def check_word_count(text: str) -> bool:
    """
    Returns True if the word count meets the minimum threshold.
    """
    words = text.split()
    return len(words) >= settings.min_apology_words

def is_truth_escalated(truth_attempt_count: int) -> bool:
    """
    Returns True if the max truth attempts have been reached,
    meaning the incident should escalate immediately to forced dare.
    """
    return truth_attempt_count >= settings.truth_max_attempts_per_incident
