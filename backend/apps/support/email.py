from django.conf import settings
from django.core.mail import EmailMessage
from django.utils.html import escape


def support_ticket_email_context(ticket):
    return {
        "ticket_id": ticket.id,
        "subject": ticket.subject,
        "full_name": ticket.full_name,
        "email": ticket.email,
        "role": ticket.role or "Not provided",
        "department": ticket.department or "Not provided",
        "category": ticket.get_category_display(),
        "priority": ticket.get_priority_display(),
        "status": ticket.get_status_display(),
        "message": ticket.message,
        "created_at": ticket.created_at.strftime("%Y-%m-%d %H:%M:%S %Z") if ticket.created_at else "Not available",
    }


def send_support_ticket_email(ticket):
    if not settings.SUPPORT_EMAIL:
        raise RuntimeError("SUPPORT_EMAIL is not configured.")

    context = support_ticket_email_context(ticket)
    subject = f"[Support Ticket #{ticket.id}] {ticket.subject}"
    body = "\n".join([
        "A new support ticket was submitted from A Machine Learning Model for Predicting Postoperative Oxygen Requirement Among Surgical Patients in Rwanda.",
        "",
        f"Ticket ID: {context['ticket_id']}",
        f"Submitted At: {context['created_at']}",
        f"Full Name: {context['full_name']}",
        f"Email: {context['email']}",
        f"Role: {context['role']}",
        f"Department: {context['department']}",
        f"Category: {context['category']}",
        f"Priority: {context['priority']}",
        f"Status: {context['status']}",
        "",
        "Message:",
        context["message"],
        "",
        "Reply directly to this email to contact the requester.",
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

    email.content_subtype = "html"
    email.body = support_ticket_html_body(context)
    email.send(fail_silently=False)


def support_ticket_html_body(context):
    rows = [
        ("Ticket ID", f"#{context['ticket_id']}"),
        ("Submitted At", context["created_at"]),
        ("Full Name", context["full_name"]),
        ("Email", context["email"]),
        ("Role", context["role"]),
        ("Department", context["department"]),
        ("Category", context["category"]),
        ("Priority", context["priority"]),
        ("Status", context["status"]),
    ]
    detail_rows = "\n".join(
        f"""
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #d9e5f3;font-weight:700;color:#49617f;">{escape(label)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #d9e5f3;color:#071b49;">{escape(str(value))}</td>
        </tr>
        """
        for label, value in rows
    )
    message = escape(context["message"]).replace("\n", "<br>")
    return f"""
    <div style="font-family:Arial,sans-serif;color:#071b49;line-height:1.5;">
      <h2 style="margin:0 0 12px;">New Support Ticket</h2>
      <p style="margin:0 0 18px;">A support ticket was submitted from the postoperative oxygen prediction model.</p>
      <table style="border-collapse:collapse;width:100%;max-width:720px;border:1px solid #d9e5f3;">
        <tbody>{detail_rows}</tbody>
      </table>
      <h3 style="margin:22px 0 8px;">Message</h3>
      <div style="padding:14px;border:1px solid #d9e5f3;border-radius:8px;background:#f8fbff;">
        {message}
      </div>
      <p style="margin-top:18px;color:#49617f;">Reply directly to this email to contact the requester.</p>
    </div>
    """
