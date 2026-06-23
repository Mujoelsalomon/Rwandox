from django.contrib.auth.decorators import login_required
from django.db.models import Avg
from django.shortcuts import render
from django.utils.timezone import now

from apps.api.models import ModelArtifact
from apps.api.model_bootstrap import active_model_artifact
from apps.predictions.models import PredictionResult
from metric_benchmarks import enrich_metric_benchmarks


@login_required
def dashboard_view(request):
    today = now().date()

    predictions_today = PredictionResult.objects.filter(generated_at__date=today).count()
    high_risk_today = PredictionResult.objects.filter(
        generated_at__date=today,
        risk_level="High"
    ).count()
    avg_probability = PredictionResult.objects.aggregate(
        avg_prob=Avg("predicted_probability")
    )["avg_prob"] or 0

    recent_predictions = PredictionResult.objects.select_related(
        "record", "record__patient"
    ).order_by("-generated_at")[:5]
    active_model = active_model_artifact()
    model_metrics = enrich_metric_benchmarks(active_model.metrics) if active_model and isinstance(active_model.metrics, dict) else {}
    model_auc = (
        model_metrics.get("val_roc_auc")
        or model_metrics.get("val_roc_auc_weighted_ovr")
        or model_metrics.get("val_auc")
        or model_metrics.get("auc")
    )

    context = {
        "predictions_today": predictions_today,
        "high_risk_today": high_risk_today,
        "avg_probability": round(avg_probability * 100, 1) if avg_probability <= 1 else round(avg_probability, 1),
        "recent_predictions": recent_predictions,
        "model_auc": model_auc,
        "model_auc_classification": model_metrics.get("auc_classification"),
        "model_f1_classification": model_metrics.get("f1_classification"),
    }
    return render(request, "dashboard/home.html", context)
