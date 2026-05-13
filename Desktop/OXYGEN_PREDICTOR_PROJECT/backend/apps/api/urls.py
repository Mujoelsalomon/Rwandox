from django.urls import path
from .views import (
    predict_view,
    upload_dataset_view,
    train_view,
    train_status_view,
    models_list_view,
    models_download_view,
)

urlpatterns = [
    path("predict", predict_view, name="api_predict"),
    path("upload-dataset", upload_dataset_view, name="api_upload_dataset"),
    path("train", train_view, name="api_train"),
    path("train/status/<str:job_id>", train_status_view, name="api_train_status"),
    path("models", models_list_view, name="api_models"),
    path("models/download", models_download_view, name="api_models_download"),
]
