from django.urls import path
from .views import patient_list_view, patient_detail_view

urlpatterns = [
    path("", patient_list_view, name="patient_list"),
    path("<int:pk>/", patient_detail_view, name="patient_detail"),
]
