from app.schemas import SecurityAssessment


def test_security_assessment_rejects_invalid_risk() -> None:
    try:
        SecurityAssessment(
            verdict="block",
            risk_score=101,
            explanation="Destructive operation must be blocked.",
            signals=[],
            recommended_policy="AG-102",
        )
    except ValueError:
        return
    raise AssertionError("risk_score above 100 must fail validation")

