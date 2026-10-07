"""
Phase 7's rule-based recommendation engine. Deliberately NOT a model: every
suggestion below comes from well-established, mainstream skincare-ingredient
guidance (the kind found in any dermatology-reviewed consumer skincare
resource) mapped onto this app's 8 SkinMetrics via a fixed score threshold —
not personalized medical advice, and not hidden as such (see SAFETY_DISCLAIMER).

Each metric maps to exactly one goal. A goal fires when its metric scores
below THRESHOLD (lower score = more visible concern, matching SkinMetrics'
existing "higher is clearer/better" direction — see acne_model.py).
"""

from dataclasses import dataclass

THRESHOLD = 60

RecItem = dict[str, str]  # {"type": "ingredient"|"product"|"habit", "name": str, "reason": str}


@dataclass
class GoalRule:
    metric: str
    goal: str
    items: list[RecItem]


RULES: list[GoalRule] = [
    GoalRule(
        metric="acne",
        goal="Reduce visible acne and breakouts",
        items=[
            {"type": "ingredient", "name": "Salicylic acid (BHA)", "reason": "Exfoliates inside pores where breakouts start — a well-established first-line ingredient."},
            {"type": "ingredient", "name": "Niacinamide", "reason": "Widely used to help calm visible redness and oil around blemishes."},
            {"type": "habit", "name": "Avoid picking or popping breakouts", "reason": "Reduces the risk of visible scarring and prolonged inflammation."},
        ],
    ),
    GoalRule(
        metric="redness",
        goal="Calm visible redness",
        items=[
            {"type": "ingredient", "name": "Centella asiatica (Cica)", "reason": "A common soothing ingredient for visibly reactive, flushed skin."},
            {"type": "ingredient", "name": "Azelaic acid", "reason": "Helps even out redness-prone skin; also mild on acne and pigmentation."},
            {"type": "habit", "name": "Skip fragranced products for a few weeks", "reason": "Fragrance is one of the most common triggers of visible irritation."},
        ],
    ),
    GoalRule(
        metric="pigmentation",
        goal="Even out visible tone and dark spots",
        items=[
            {"type": "ingredient", "name": "Vitamin C (L-ascorbic acid)", "reason": "A well-studied antioxidant that helps brighten uneven tone over time."},
            {"type": "product", "name": "Broad-spectrum SPF 30+", "reason": "New UV exposure visibly worsens existing dark spots — sunscreen is the single most effective step here."},
            {"type": "habit", "name": "Reapply sunscreen every ~2 hours outdoors", "reason": "One morning application rarely lasts a full day outside."},
        ],
    ),
    GoalRule(
        metric="pores",
        goal="Refine the visible look of pores",
        items=[
            {"type": "ingredient", "name": "Niacinamide", "reason": "May help visibly refine pore appearance and regulate surface oil."},
            {"type": "ingredient", "name": "Clay (kaolin or bentonite)", "reason": "A weekly mask can temporarily reduce the appearance of enlarged pores."},
        ],
    ),
    GoalRule(
        metric="texture",
        goal="Smooth visible texture",
        items=[
            {"type": "ingredient", "name": "Lactic acid (AHA)", "reason": "A gentler exfoliating acid that helps smooth visible surface texture."},
            {"type": "ingredient", "name": "Hyaluronic acid", "reason": "Helps skin look visibly plumper and smoother when applied to damp skin."},
        ],
    ),
    GoalRule(
        metric="wrinkles",
        goal="Soften the visible look of fine lines",
        items=[
            {"type": "ingredient", "name": "Retinoid (retinol or adapalene)", "reason": "The most evidence-backed over-the-counter ingredient for visible fine lines — introduce gradually."},
            {"type": "product", "name": "Broad-spectrum SPF 30+", "reason": "UV exposure is a leading visible driver of fine lines — retinoids also increase sun sensitivity."},
        ],
    ),
    GoalRule(
        metric="scars",
        goal="Support visible recovery of past marks",
        items=[
            {"type": "product", "name": "Broad-spectrum SPF 30+", "reason": "Protecting healing skin from UV helps prevent marks from visibly darkening further."},
            {"type": "ingredient", "name": "Silicone gel or sheet (for raised scars)", "reason": "The most evidence-backed over-the-counter option for visibly raised scar texture."},
        ],
    ),
    GoalRule(
        metric="uniformity",
        goal="Even out overall visible tone",
        items=[
            {"type": "ingredient", "name": "Vitamin C (L-ascorbic acid)", "reason": "Supports more even-looking tone alongside daily sun protection."},
            {"type": "habit", "name": "Consistent daily SPF, not just sunny days", "reason": "UV is cumulative — daily protection has the biggest visible impact on evenness over time."},
        ],
    ),
]

BASE_STEPS = {
    "morning": [
        {"order": 1, "name": "Gentle cleanser", "reason": None, "frequency": "Daily"},
        {"order": 4, "name": "Moisturizer", "reason": None, "frequency": "Daily"},
    ],
    "evening": [
        {"order": 1, "name": "Gentle cleanser", "reason": None, "frequency": "Daily"},
        {"order": 4, "name": "Moisturizer", "reason": None, "frequency": "Daily"},
    ],
}


def build_recommendations(metrics: dict[str, float], mock_metrics: list[str]) -> list[dict]:
    """One Recommendation per metric scoring below THRESHOLD, worst-first.
    `is_mock` on each entry flags whether its underlying metric is still a
    Phase 1 placeholder — never hide that a "concern" was invented, not measured."""
    triggered = [(rule, metrics[rule.metric]) for rule in RULES if metrics.get(rule.metric, 100) < THRESHOLD]
    triggered.sort(key=lambda pair: pair[1])  # lowest (most visible concern) first

    out = []
    for rule, score in triggered:
        priority = "high" if score < 35 else "medium" if score < 50 else "low"
        out.append({
            "goal": rule.goal,
            "priority": priority,
            "is_mock": rule.metric in mock_metrics,
            "recommendations": rule.items,
        })
    return out


def build_routine(recommendations: list[dict]) -> dict:
    """Assembles AM (retinoids/exfoliants excluded — evening only, see note
    below) and PM routines from triggered recommendations' ingredient/product
    items, in a fixed cleanse → treat → protect/moisturize order."""
    morning: list[dict] = [dict(s) for s in BASE_STEPS["morning"]]
    evening: list[dict] = [dict(s) for s in BASE_STEPS["evening"]]

    seen_am: set[str] = set()
    seen_pm: set[str] = set()
    # Photosensitizing/exfoliating actives go PM-only even if their rule maps to "Treat" generally.
    pm_only = {"Retinoid (retinol or adapalene)", "Lactic acid (AHA)", "Salicylic acid (BHA)"}

    for rec in recommendations:
        for item in rec["recommendations"]:
            if item["type"] not in ("ingredient", "product"):
                continue
            name = item["name"]
            target_am = name not in pm_only and name != "Silicone gel or sheet (for raised scars)"
            if target_am and name not in seen_am:
                seen_am.add(name)
                morning.append({"order": 3, "name": name, "reason": item.get("reason"), "frequency": "Daily"})
            if name not in seen_pm and name != "Broad-spectrum SPF 30+":
                seen_pm.add(name)
                evening.append({"order": 3, "name": name, "reason": item.get("reason"), "frequency": "Daily"})

    def finalize(steps: list[dict]) -> list[dict]:
        ordered = sorted(steps, key=lambda s: (s["order"], s["name"]))
        for i, s in enumerate(ordered):
            s["order"] = i + 1
        return ordered

    return {"morning": finalize(morning), "evening": finalize(evening)}
