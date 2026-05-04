"""Analytics engine — user progress tracking and weakness detection."""

from datetime import datetime, timezone
from statistics import mean

from app.models.domain import ConversationSession
from app.models.schemas import ProgressPoint, WeaknessItem


async def get_progress_trend(sessions: list[ConversationSession]) -> list[ProgressPoint]:
    """Aggregate evaluation scores by date to show progress trends."""
    daily_scores: dict[str, list[dict]] = {}

    for s in sessions:
        date_key = s.started_at.strftime("%Y-%m-%d")
        for t in s.turns:
            if t.role == "user" and t.evaluation:
                daily_scores.setdefault(date_key, []).append({
                    "fluency": t.evaluation.fluency.score,
                    "lexical": t.evaluation.lexical_resource.score,
                    "naturalness": t.evaluation.naturalness.score,
                })

    trends = []
    for date_key in sorted(daily_scores.keys()):
        scores = daily_scores[date_key]
        trends.append(ProgressPoint(
            date=datetime.strptime(date_key, "%Y-%m-%d").replace(tzinfo=timezone.utc),
            avg_fluency=round(mean(s["fluency"] for s in scores), 2),
            avg_lexical=round(mean(s["lexical"] for s in scores), 2),
            avg_naturalness=round(mean(s["naturalness"] for s in scores), 2),
        ))

    return trends


async def analyze_weaknesses(sessions: list[ConversationSession]) -> list[WeaknessItem]:
    """Identify the user's weakest dimensions with actionable advice."""
    dim_scores: dict[str, list[float]] = {"fluency": [], "lexical_resource": [], "naturalness": []}

    for s in sessions:
        for t in s.turns:
            if t.role == "user" and t.evaluation:
                dim_scores["fluency"].append(t.evaluation.fluency.score)
                dim_scores["lexical_resource"].append(t.evaluation.lexical_resource.score)
                dim_scores["naturalness"].append(t.evaluation.naturalness.score)

    advice_map = {
        "fluency": "Practice speaking on timer without stopping. Focus on linking words (however, moreover, therefore).",
        "lexical_resource": "Read academic articles and note collocations. Use a thesaurus to find synonyms for common words.",
        "naturalness": "Listen to native speakers (podcasts, interviews). Shadow their intonation and phrasing patterns.",
    }

    weaknesses = []
    for dim, scores in dim_scores.items():
        if scores:
            avg = round(mean(scores), 2)
            weaknesses.append(WeaknessItem(
                dimension=dim,
                avg_score=avg,
                advice=advice_map.get(dim, ""),
            ))

    weaknesses.sort(key=lambda w: w.avg_score)
    return weaknesses
