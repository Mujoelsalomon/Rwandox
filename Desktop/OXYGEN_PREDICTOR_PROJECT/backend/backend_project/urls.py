from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('', include('apps.api.urls')),
    path('admin/', admin.site.urls),
    path('', include('apps.dashboard.urls')),
    path('predictions/', include('apps.predictions.urls')),
    path('patients/', include('apps.patients.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
