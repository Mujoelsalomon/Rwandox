from django.contrib import admin
from .models import TrainingJob, ModelArtifact
from .models import Ward, SurgeryType, AnesthesiaType, ModelRegistry, EmrSyncLog, SystemSetting


@admin.register(TrainingJob)
class TrainingJobAdmin(admin.ModelAdmin):
    list_display = ("job_id", "status", "model_type", "created_at")
    readonly_fields = ("created_at", "updated_at")


@admin.register(ModelArtifact)
class ModelArtifactAdmin(admin.ModelAdmin):
    list_display = ("name", "model_type", "is_active", "created_at")


@admin.register(Ward)
class WardAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "created_at")


@admin.register(SurgeryType)
class SurgeryTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "is_active", "created_at")


@admin.register(AnesthesiaType)
class AnesthesiaTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "created_at")


@admin.register(ModelRegistry)
class ModelRegistryAdmin(admin.ModelAdmin):
    list_display = ("model_name", "version", "algorithm", "is_active", "created_at")


@admin.register(EmrSyncLog)
class EmrSyncLogAdmin(admin.ModelAdmin):
    list_display = ("perioperative_record_id", "sync_status", "created_at")


@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    list_display = ("setting_key", "updated_at")
