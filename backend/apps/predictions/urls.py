from django.urls import path
from .views import prediction_create_view

urlpatterns = [
    path("create/", prediction_create_view, name="prediction_create"),
]
