from .audit_views import (
    audit_logs_export_view,
    audit_logs_view,
)
from .auth_views import (
    current_user_view,
    login_view,
    logout_all_view,
    logout_view,
    profile_update_view,
    register_view,
)
from .fhir_views import (
    fhir_capability_statement_view,
    fhir_observation_view,
    fhir_patient_view,
    fhir_risk_assessment_view,
)
from .maintenance_views import (
    maintenance_api_status_view,
    maintenance_backup_database_view,
    maintenance_clear_temp_files_view,
    maintenance_database_status_view,
    maintenance_export_logs_view,
    maintenance_health_view,
    maintenance_model_status_view,
    maintenance_reload_model_view,
    maintenance_reset_failed_jobs_view,
    maintenance_storage_status_view,
    maintenance_test_prediction_view,
)
from .model_views import (
    models_activate_view,
    models_download_view,
    models_list_view,
)
from .patient_views import (
    patients_list_view,
    patients_search_view,
)
from .prediction_views import (
    predict_dataset_view,
    predict_view,
    prediction_history_csv_view,
    prediction_history_pdf_view,
    prediction_history_report_view,
    prediction_history_view,
)
from .training_views import (
    train_status_view,
    train_view,
    training_jobs_view,
    upload_dataset_view,
    upload_prediction_dataset_view,
)


__all__ = [
    "current_user_view",
    "audit_logs_export_view",
    "audit_logs_view",
    "fhir_capability_statement_view",
    "fhir_observation_view",
    "fhir_patient_view",
    "fhir_risk_assessment_view",
    "login_view",
    "logout_all_view",
    "logout_view",
    "maintenance_api_status_view",
    "maintenance_backup_database_view",
    "maintenance_clear_temp_files_view",
    "maintenance_database_status_view",
    "maintenance_export_logs_view",
    "maintenance_health_view",
    "maintenance_model_status_view",
    "maintenance_reload_model_view",
    "maintenance_reset_failed_jobs_view",
    "maintenance_storage_status_view",
    "maintenance_test_prediction_view",
    "models_activate_view",
    "models_download_view",
    "models_list_view",
    "patients_list_view",
    "patients_search_view",
    "predict_dataset_view",
    "predict_view",
    "prediction_history_csv_view",
    "prediction_history_pdf_view",
    "prediction_history_report_view",
    "prediction_history_view",
    "profile_update_view",
    "register_view",
    "train_status_view",
    "train_view",
    "training_jobs_view",
    "upload_dataset_view",
    "upload_prediction_dataset_view",
]
