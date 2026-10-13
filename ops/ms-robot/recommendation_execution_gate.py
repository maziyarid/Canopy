"""AAX-82 execution boundary. Recommendations stay proposal-only.

This module does not publish, mutate a site, write to a provider, or create
an Agiflow task. It only classifies whether an insight may be shown as a
proposal. PR #24 already owns the TypeScript journal contract; this gate is
the promotion-readiness proof that execute/publish modes stay refused.
"""
from __future__ import annotations

REFUSED_MODES = frozenset({"execute", "publish", "apply", "mutate", "delete"})


class RecommendationExecutionRefused(RuntimeError):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def classify_recommendation(insight, mode="propose"):
    if not isinstance(insight, dict):
        raise RecommendationExecutionRefused("recommendation_insight_invalid")
    requested = str(mode or "").strip().lower()
    if requested in REFUSED_MODES:
        raise RecommendationExecutionRefused("recommendation_execution_disabled")
    if requested != "propose":
        raise RecommendationExecutionRefused("recommendation_mode_unknown")
    disposition = str(insight.get("recommendationDisposition") or "").strip()
    action = str(insight.get("recommendedAction") or "").strip()
    evidence = insight.get("evidenceRefs")
    if disposition != "proposal_only":
        raise RecommendationExecutionRefused("recommendation_not_proposal_only")
    if not action:
        raise RecommendationExecutionRefused("recommendation_action_missing")
    if not isinstance(evidence, list) or not evidence:
        raise RecommendationExecutionRefused("recommendation_evidence_missing")
    return {
        "recommendationDisposition": "proposal_only",
        "executed": False,
        "publisherInvoked": False,
        "action": "none",
    }
