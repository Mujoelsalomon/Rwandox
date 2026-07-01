def normalize_metric(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not (number == number) or number in (float("inf"), float("-inf")):
        return None
    return number / 100 if number > 1 else number


def auc_classification(value):
    number = normalize_metric(value)
    if number is None:
        return None
    if 0.9 <= number < 1.0:
        return "Outstanding"
    if 0.8 <= number < 0.9:
        return "Excellent"
    if 0.7 <= number < 0.8:
        return "Acceptable/Good"
    if 0.5 <= number < 0.7:
        return "Poor"
    return None


def f1_classification(value):
    number = normalize_metric(value)
    if number is None:
        return None
    if 0.9 <= number <= 1.0:
        return "Outstanding/Perfect"
    if 0.8 <= number < 0.9:
        return "Very Good/Excellent"
    if 0.7 <= number < 0.8:
        return "Good"
    if 0.5 <= number < 0.7:
        return "Acceptable/Fair"
    return "Needs Review"


def sensitivity_classification(value):
    number = normalize_metric(value)
    if number is None:
        return None
    if 0.9 <= number <= 1.0:
        return "Excellent detection"
    if 0.8 <= number < 0.9:
        return "Strong detection"
    if 0.7 <= number < 0.8:
        return "Good"
    if 0.5 <= number < 0.7:
        return "Needs review"
    return "Needs Review"


def enrich_metric_benchmarks(metrics):
    if not isinstance(metrics, dict):
        return metrics

    enriched = dict(metrics)
    auc_metric_keys = ("test_auc", "val_roc_auc", "val_roc_auc_weighted_ovr", "val_auc", "auc")
    f1_metric_keys = ("val_f1_score", "f1_score", "val_f1_macro")
    sensitivity_metric_keys = ("test_sensitivity", "val_sensitivity", "sensitivity", "val_recall_weighted")

    for key in auc_metric_keys:
        label = auc_classification(enriched.get(key))
        if label:
            enriched[f"{key}_classification"] = label

    for key in f1_metric_keys:
        label = f1_classification(enriched.get(key))
        if label:
            enriched[f"{key}_classification"] = label

    for key in sensitivity_metric_keys:
        label = sensitivity_classification(enriched.get(key))
        if label:
            enriched[f"{key}_classification"] = label

    auc_value = next((enriched.get(key) for key in auc_metric_keys if enriched.get(key) is not None), None)
    f1_value = next((enriched.get(key) for key in f1_metric_keys if enriched.get(key) is not None), None)
    sensitivity_value = next((enriched.get(key) for key in sensitivity_metric_keys if enriched.get(key) is not None), None)
    auc_label = auc_classification(auc_value)
    f1_label = f1_classification(f1_value)
    sensitivity_label = sensitivity_classification(sensitivity_value)

    if auc_label:
        enriched["auc_classification"] = auc_label
    if f1_label:
        enriched["f1_classification"] = f1_label
    if sensitivity_label:
        enriched["sensitivity_classification"] = sensitivity_label

    return enriched
