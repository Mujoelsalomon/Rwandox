from django.contrib import admin

from .models import SupportTicket


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ("id", "subject", "full_name", "email", "category", "priority", "status", "created_at")
    list_filter = ("category", "priority", "status", "created_at")
    search_fields = ("subject", "full_name", "email", "message")
    readonly_fields = ("created_at", "updated_at")
