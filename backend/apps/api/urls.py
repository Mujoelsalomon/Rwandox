from django.urls import path
from .views import (
    predict_view,
    patient_assessment_view,
    patients_search_view,
    prediction_history_view,
    upload_dataset_view,
    train_view,
    train_status_view,
    models_list_view,
    models_activate_view,
    models_download_view,
)

urlpatterns = [
    path("predict", predict_view, name="api_predict"),
    path("patient-assessments", patient_assessment_view, name="api_patient_assessments"),
    path("patients/search", patients_search_view, name="api_patients_search"),
    path("prediction-history", prediction_history_view, name="api_prediction_history"),
    path("upload-dataset", upload_dataset_view, name="api_upload_dataset"),
    path("train", train_view, name="api_train"),
    path("train/status/<str:job_id>", train_status_view, name="api_train_status"),
    path("models", models_list_view, name="api_models"),
    path("models/activate", models_activate_view, name="api_models_activate"),
    path("models/download", models_download_view, name="api_models_download"),
]
