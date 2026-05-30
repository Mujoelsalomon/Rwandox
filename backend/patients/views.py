import json
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from .models import Patient

def list_patients(request):
    patients = list(Patient.objects.values('id', 'name', 'age'))
    return JsonResponse(patients, safe=False)

@csrf_exempt
def create_patient(request):
    if request.method != 'POST':
        return HttpResponseBadRequest('Only POST')
    try:
        payload = json.loads(request.body)
        name = payload.get('name')
        age = payload.get('age')
        p = Patient.objects.create(name=name, age=age)
        return JsonResponse({'id': p.id, 'name': p.name, 'age': p.age})
    except Exception as e:
        return HttpResponseBadRequest(str(e))
