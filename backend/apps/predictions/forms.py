from django import forms


class PredictionInputForm(forms.Form):
    hospital_id = forms.CharField(max_length=50)
    age = forms.IntegerField(min_value=0)
    sex = forms.ChoiceField(choices=[("Male", "Male"), ("Female", "Female")])
    bmi = forms.FloatField(required=False)
    smoking_history = forms.BooleanField(required=False)
    comorbidities = forms.CharField(required=False, widget=forms.Textarea(attrs={"rows": 2}))
    baseline_spo2 = forms.FloatField(required=False)

    surgery_type = forms.CharField(max_length=100)
    urgency = forms.ChoiceField(choices=[("elective", "Elective"), ("emergency", "Emergency")])
    surgery_duration = forms.IntegerField(min_value=0)
    blood_loss = forms.CharField(required=False)
    ward = forms.CharField(required=False)
    procedure_date = forms.DateField(required=False, widget=forms.DateInput(attrs={"type": "date"}))

    anesthesia_type = forms.CharField(max_length=50)
    asa_class = forms.CharField(required=False)
    residual_effects = forms.BooleanField(required=False)
    opioid_use = forms.BooleanField(required=False)
    airway_event = forms.CharField(required=False)
    recovery_status = forms.CharField(required=False)

    postop_spo2 = forms.FloatField(required=False)
    respiratory_rate = forms.IntegerField(required=False, min_value=0)
    pain_status = forms.CharField(required=False)
    consciousness = forms.CharField(required=False)
    time_since_surgery = forms.IntegerField(required=False, min_value=0)
    oxygen_before_prediction = forms.BooleanField(required=False)
