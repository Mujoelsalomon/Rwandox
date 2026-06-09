from django.conf import settings
from django.core.mail import EmailMessage


def send_support_ticket_email(ticket):
    subject = f"[Support Ticket #{ticket.id}] {ticket.subject}"
    body = "\n".join([
        "A new support ticket was submitted from A Machine Learning Model for Predicting Postoperative Oxygen Requirement Among Surgical Patients in Rwanda.",
        "",
        f"Ticket ID: {ticket.id}",
        f"Full Name: {ticket.full_name}",
        f"Email: {ticket.email}",
        f"Role: {ticket.role or 'Not provided'}",
        f"Department: {ticket.department or 'Not provided'}",
        f"Category: {ticket.get_category_display()}",
        f"Priority: {ticket.get_priority_display()}",
        f"Status: {ticket.get_status_display()}",
        "",
        "Message:",
        ticket.message,
    ])
    reply_to = [ticket.email] if ticket.email else None
    email = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[settings.SUPPORT_EMAIL],
        reply_to=reply_to,
    )

    if ticket.attachment:
        email.attach_file(ticket.attachment.path)

    email.send(fail_silently=False)
