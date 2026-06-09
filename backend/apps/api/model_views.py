from pathlib import Path

from django.http import FileResponse, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .audit import record_audit
from .common import cors, json_body, require_admin
from .models import ModelArtifact


def models_list_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error

    artifacts = ModelArtifact.objects.all()
    models = [
        {
            "id": artifact.id,
            "name": artifact.name,
            "model_type": artifact.model_type,
            "path": artifact.path,
            "metrics": artifact.metrics,
            "is_active": artifact.is_active,
            "created_at": artifact.created_at.isoformat() if artifact.created_at else None,
        }
        for artifact in artifacts
    ]
    record_audit(request, "Viewed model registry", object_type="ModelArtifact", details={"count": len(models)})
    return cors(JsonResponse({"models": models}))


@csrf_exempt
def models_activate_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    model_id = json_body(request).get("id")
    try:
        artifact = ModelArtifact.objects.get(id=int(model_id))
    except (ModelArtifact.DoesNotExist, TypeError, ValueError):
        return cors(JsonResponse({"error": "model not found"}, status=404))

    ModelArtifact.objects.update(is_active=False)
    artifact.is_active = True
    artifact.save(update_fields=["is_active"])
    record_audit(request, "Activated model", object_type="ModelArtifact", object_id=artifact.id, details={"name": artifact.name})
    return cors(JsonResponse({"model": {"id": artifact.id, "name": artifact.name, "is_active": artifact.is_active}}))


def models_download_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_admin(request)
    if auth_error:
        return auth_error

    model_id = request.GET.get("id")
    if not model_id:
        return cors(JsonResponse({"error": "id query required"}, status=400))
    try:
        artifact = ModelArtifact.objects.get(id=int(model_id))
    except (ModelArtifact.DoesNotExist, ValueError):
        return cors(JsonResponse({"error": "model not found"}, status=404))

    candidate = Path(artifact.path)
    if not candidate.exists():
        return cors(JsonResponse({"error": "file not found on disk"}, status=404))

    record_audit(request, "Downloaded model artifact", object_type="ModelArtifact", object_id=artifact.id, details={"name": artifact.name})
    resp = FileResponse(open(candidate, "rb"), as_attachment=True, filename=candidate.name)
    return cors(resp)
