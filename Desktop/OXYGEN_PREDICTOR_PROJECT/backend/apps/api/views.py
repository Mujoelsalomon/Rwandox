from .auth_views import (
    current_user_view,
    login_view,
    logout_all_view,
    logout_view,
    register_view,
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
    predict_view,
    prediction_history_view,
)
from .training_views import (
    train_status_view,
    train_view,
    upload_dataset_view,
)


__all__ = [
    "current_user_view",
    "login_view",
    "logout_all_view",
    "logout_view",
    "models_activate_view",
    "models_download_view",
    "models_list_view",
    "patients_list_view",
    "patients_search_view",
    "predict_view",
    "prediction_history_view",
    "register_view",
    "train_status_view",
    "train_view",
    "upload_dataset_view",
]
