import pytest
from backend.src.services.difficulty import calculate_crank_required
from backend.src.config.settings import settings

def test_calculate_crank_required():
    # Base = 15, Increment = 10, Cap = 80
    settings.dare_base_crank_count = 15
    settings.dare_crank_increment = 10
    settings.dare_max_crank_count = 80

    assert calculate_crank_required(1) == 15
    assert calculate_crank_required(2) == 25
    assert calculate_crank_required(3) == 35
    assert calculate_crank_required(8) == 80 # Should cap at 80 (15 + 70 = 85 -> 80)
    assert calculate_crank_required(0) == 15 # Edge case handles as 1
    assert calculate_crank_required(-1) == 15
