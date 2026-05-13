def make_prediction(payload, model=None, preprocessor=None, feature_order=None):
    '''
    Placeholder prediction function.
    Replace this with the real preprocessor.transform() and model.predict_proba() call.
    '''
    postop_spo2 = payload.get("postop_spo2") or 98
    asa = str(payload.get("asa_class") or "").upper()
    urgency = str(payload.get("urgency") or "").lower()
    duration = payload.get("surgery_duration") or 0
    bmi = payload.get("bmi") or 0
    opioid_use = bool(payload.get("opioid_use"))

    probability = 0.18
    factors = []

    if postop_spo2 <= 92:
        probability += 0.32
        factors.append({"feature": "postop_spo2", "display": f"Post-op SpO₂ {postop_spo2}%", "impact": 0.32})
    if asa in {"III", "IV", "V"}:
        probability += 0.12
        factors.append({"feature": "asa_class", "display": f"ASA {asa}", "impact": 0.12})
    if urgency == "emergency":
        probability += 0.10
        factors.append({"feature": "urgency", "display": "Emergency surgery", "impact": 0.10})
    if duration >= 180:
        probability += 0.08
        factors.append({"feature": "surgery_duration", "display": f"Duration {duration} min", "impact": 0.08})
    if bmi >= 30:
        probability += 0.06
        factors.append({"feature": "bmi", "display": f"BMI {bmi}", "impact": 0.06})
    if opioid_use:
        probability += 0.05
        factors.append({"feature": "opioid_use", "display": "Opioid use", "impact": 0.05})

    probability = min(probability, 0.95)
    factors = sorted(factors, key=lambda x: abs(x["impact"]), reverse=True)[:5]
    return probability, factors
