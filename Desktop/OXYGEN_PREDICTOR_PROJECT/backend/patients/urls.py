from django.urls import path
from . import views

urlpatterns = [
    path('patients/', views.list_patients, name='patients_list'),
    path('patients/create/', views.create_patient, name='patients_create'),
]
