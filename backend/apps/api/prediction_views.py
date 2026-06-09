import base64
import csv
import io
import mimetypes
from html import escape
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

import trainer

from apps.patients.models import Patient
from apps.perioperative.models import PerioperativeRecord
from apps.predictions.models import PredictionResult
from apps.predictions.services import run_prediction

from .audit import record_audit
from .common import bool_value, cors, float_value, int_or_none, int_value, json_body, require_login
from .dataset_history import dataset_prediction_history_payloads
from .models import ModelArtifact
from .serializers import prediction_history_payload
from .training_views import validate_uploaded_dataset_path


REPORT_TITLE = "A Machine Learning Model for Predicting Postoperative Oxygen Requirement Among Surgical Patients in Rwanda"


@csrf_exempt
def predict_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    payload = json_body(request)
    features = payload.get("features") or payload
    result = run_prediction(features)
    if not bool_value(payload.get("persist", True)):
        record_audit(request, "Generated preview prediction", object_type="PredictionResult")
        return cors(JsonResponse(prediction_response_payload(result)))

    result = persist_prediction(features, payload, result)
    record_audit(
        request,
        "Generated prediction",
        object_type="PredictionResult",
        object_id=result.get("id", ""),
        details={"patient_id": result.get("patient_id", ""), "model_version": result.get("model_version", "")},
    )
    return cors(JsonResponse(prediction_response_payload(result)))


@csrf_exempt
def predict_dataset_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error
    if request.method != "POST":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    payload = json_body(request)
    dataset_path = payload.get("dataset_path")
    target_column = str(payload.get("target") or payload.get("target_column") or "").strip()
    if not dataset_path:
        return cors(JsonResponse({"error": "dataset_path required"}, status=400))

    dataset_error = validate_uploaded_dataset_path(dataset_path)
    if dataset_error:
        return cors(JsonResponse({"error": dataset_error}, status=400))

    try:
        dataframe = trainer.read_dataset(dataset_path)
    except Exception as exc:
        return cors(JsonResponse({"error": str(exc)}, status=400))

    feature_columns = list(dataframe.columns)
    if target_column and target_column in feature_columns:
        feature_columns.remove(target_column)

    predictions = []
    errors = []
    for index, row in dataframe.iterrows():
        features = {str(column): clean_dataset_value(row[column]) for column in feature_columns}
        try:
            result = run_prediction(features)
            predictions.append({
                "row_index": int(index),
                "predicted_probability": result.get("predicted_probability"),
                "predicted_class": result.get("predicted_class"),
                "risk_level": result.get("risk_level"),
                "recommendations": result.get("recommendations") or [],
                "contributing_factors": result.get("contributing_factors") or [],
                "active_model": result.get("active_model"),
                "model_type": result.get("model_type"),
                "training_metrics": result.get("training_metrics") or {},
            })
        except Exception as exc:
            errors.append({"row_index": int(index), "error": str(exc)})

    risk_counts = {"High": 0, "Moderate": 0, "Low": 0}
    for prediction in predictions:
        risk = prediction.get("risk_level")
        if risk in risk_counts:
            risk_counts[risk] += 1

    record_audit(request, "Predicted uploaded dataset", object_type="PredictionResult", details={"rows": len(predictions)})
    return cors(JsonResponse({
        "predictions": predictions,
        "errors": errors[:25],
        "summary": {
            "total_rows": int(len(dataframe)),
            "predicted_rows": len(predictions),
            "failed_rows": len(errors),
            "high_risk_rows": risk_counts["High"],
            "moderate_risk_rows": risk_counts["Moderate"],
            "low_risk_rows": risk_counts["Low"],
            "active_model": predictions[0].get("active_model") if predictions else None,
            "model_type": predictions[0].get("model_type") if predictions else None,
            "training_metrics": predictions[0].get("training_metrics") if predictions else {},
        },
    }))


def prediction_history_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error

    records = PredictionResult.objects.select_related("record", "record__patient").all()[:250]
    predictions = [prediction_history_payload(item) for item in records]
    if not predictions:
        predictions = dataset_prediction_history_payloads()
    record_audit(request, "Viewed prediction history", object_type="PredictionResult", details={"count": len(predictions)})
    return cors(JsonResponse({"predictions": predictions}))


def prediction_history_report_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error
    if request.method != "GET":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    export_format = str(request.GET.get("format") or "html").strip().lower()
    if export_format == "pdf":
        record_audit(request, "Exported prediction history PDF", object_type="PredictionResult")
        return prediction_history_pdf_response(request)
    if export_format == "csv":
        record_audit(request, "Exported prediction history CSV", object_type="PredictionResult")
        return prediction_history_csv_response(request)

    filtered, context = filtered_prediction_history_from_request(request)
    html = build_prediction_history_report(
        predictions=filtered,
        all_predictions=context["all_predictions"],
        filters=context["filters"],
    )
    response = HttpResponse(html, content_type="text/html; charset=utf-8")
    response["Content-Disposition"] = (
        f'attachment; filename="prediction-history-report-{timezone.now().strftime("%Y-%m-%d")}.html"'
    )
    return cors(response)


def prediction_history_csv_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error
    if request.method != "GET":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    return prediction_history_csv_response(request)


def prediction_history_csv_response(request):
    predictions, _ = filtered_prediction_history_from_request(request)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Generated",
        "Patient ID",
        "Age",
        "Sex",
        "Surgery",
        "Disposition",
        "Risk",
        "Probability",
        "Model",
        "Clinical Note",
    ])
    for prediction in predictions:
        writer.writerow(prediction_export_row(prediction))

    response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = (
        f'attachment; filename="prediction-history-{timezone.now().strftime("%Y-%m-%d")}.csv"'
    )
    return cors(response)


def prediction_history_pdf_view(request):
    if request.method == "OPTIONS":
        return cors(HttpResponse())
    auth_error = require_login(request)
    if auth_error:
        return auth_error
    if request.method != "GET":
        return cors(JsonResponse({"error": "method not allowed"}, status=405))

    return prediction_history_pdf_response(request)


def prediction_history_pdf_response(request):
    predictions, context = filtered_prediction_history_from_request(request)
    pdf = build_prediction_history_pdf(predictions, context["all_predictions"], context["filters"])
    response = HttpResponse(pdf, content_type="application/pdf")
    response["Content-Disposition"] = (
        f'attachment; filename="prediction-history-report-{timezone.now().strftime("%Y-%m-%d")}.pdf"'
    )
    return cors(response)


def filtered_prediction_history_from_request(request):
    predictions = prediction_history_records()
    filters = {
        "search": request.GET.get("search", "").strip() or "All records",
        "risk": request.GET.get("risk", "All") or "All",
        "disposition": request.GET.get("disposition", "All") or "All",
    }
    filtered = filter_prediction_history(
        predictions,
        search=request.GET.get("search", ""),
        risk=filters["risk"],
        disposition=filters["disposition"],
    )
    return filtered, {"all_predictions": predictions, "filters": filters}


def prediction_history_records():
    records = PredictionResult.objects.select_related("record", "record__patient").all()[:250]
    predictions = [prediction_history_payload(item) for item in records]
    if not predictions:
        predictions = dataset_prediction_history_payloads()
    return predictions


def filter_prediction_history(predictions, search="", risk="All", disposition="All"):
    normalized_search = str(search or "").strip().lower()
    risk_filter = str(risk or "All")
    disposition_filter = str(disposition or "All")

    def matches(prediction):
        text_match = (
            not normalized_search
            or normalized_search in str(prediction.get("patient_id") or "").lower()
            or normalized_search in str(prediction.get("surgery_type") or "").lower()
            or normalized_search in str(prediction.get("model_version") or "").lower()
        )
        risk_match = risk_filter == "All" or prediction.get("risk_level") == risk_filter
        disposition_match = disposition_filter == "All" or prediction.get("patient_disposition") == disposition_filter
        return text_match and risk_match and disposition_match

    return [prediction for prediction in predictions if matches(prediction)]


def build_prediction_history_report(predictions, all_predictions, filters):
    generated_at = timezone.localtime()
    total = len(all_predictions)
    high = sum(1 for prediction in all_predictions if prediction.get("risk_level") == "High")
    filtered_high = sum(1 for prediction in predictions if prediction.get("risk_level") == "High")
    average = round(
        sum(float(prediction.get("predicted_probability") or 0) for prediction in all_predictions) / total
    ) if total else 0
    logo_data_url = system_logo_data_url()

    rows = "\n".join(prediction_report_row(prediction) for prediction in predictions)
    if not rows:
        rows = (
            '<tr><td colspan="10" class="empty-cell">'
            "No prediction history matched the selected filters."
            "</td></tr>"
        )

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{escape(REPORT_TITLE)} - Prediction History Report</title>
  <style>
    @page {{ margin: 18mm; }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      color: #071b49;
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.45;
      background: #ffffff;
    }}
    .report {{
      max-width: 1200px;
      margin: 0 auto;
      padding: 28px;
    }}
    .header {{
      display: flex;
      align-items: center;
      gap: 18px;
      border-bottom: 4px solid #84cc16;
      padding-bottom: 18px;
    }}
    .logo {{
      width: 72px;
      height: 72px;
      object-fit: contain;
      border: 1px solid #d9e5f3;
      border-radius: 12px;
      padding: 6px;
    }}
    h1 {{
      margin: 0;
      font-size: 24px;
      line-height: 1.2;
    }}
    .subtitle {{
      margin: 8px 0 0;
      color: #53668a;
      font-size: 14px;
      font-weight: 700;
    }}
    .meta, .filters, .summary {{
      display: grid;
      gap: 12px;
      margin-top: 20px;
    }}
    .meta, .filters {{
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }}
    .summary {{
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }}
    .tile {{
      border: 1px solid #d9e5f3;
      border-radius: 10px;
      padding: 12px;
      background: #f8fbff;
    }}
    .label {{
      color: #64799e;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }}
    .value {{
      margin-top: 4px;
      color: #071b49;
      font-size: 18px;
      font-weight: 900;
      overflow-wrap: anywhere;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      margin-top: 24px;
      font-size: 12px;
    }}
    th {{
      background: #eef5ff;
      color: #263957;
      font-size: 11px;
      letter-spacing: 0.05em;
      text-align: left;
      text-transform: uppercase;
    }}
    th, td {{
      border: 1px solid #d9e5f3;
      padding: 9px;
      vertical-align: top;
    }}
    .risk-high {{ color: #b91c1c; font-weight: 900; }}
    .risk-moderate {{ color: #a16207; font-weight: 900; }}
    .risk-low {{ color: #166534; font-weight: 900; }}
    .empty-cell {{
      color: #53668a;
      font-weight: 700;
      text-align: center;
    }}
    .footer {{
      margin-top: 28px;
      color: #64799e;
      font-size: 11px;
      text-align: center;
    }}
    @media print {{
      .report {{ padding: 0; }}
      .tile {{ break-inside: avoid; }}
      table {{ page-break-inside: auto; }}
      tr {{ page-break-inside: avoid; page-break-after: auto; }}
    }}
  </style>
</head>
<body>
  <main class="report">
    <header class="header">
      {f'<img class="logo" src="{escape(logo_data_url)}" alt="System logo" />' if logo_data_url else ''}
      <div>
        <h1>{escape(REPORT_TITLE)}</h1>
        <p class="subtitle">Prediction History Full Report</p>
      </div>
    </header>

    <section class="meta">
      {report_tile("Generated On", generated_at.strftime("%b %-d, %Y, %I:%M %p") if os_name_supports_dash() else generated_at.strftime("%b %d, %Y, %I:%M %p"))}
      {report_tile("Report Scope", "Filtered prediction history")}
      {report_tile("Rows Included", len(predictions))}
    </section>

    <section class="summary">
      {report_tile("Total Predictions", total)}
      {report_tile("Filtered Predictions", len(predictions))}
      {report_tile("High-Risk Cases", filtered_high)}
      {report_tile("Average Probability", f"{average}%")}
    </section>

    <section class="filters">
      {report_tile("Search Filter", filters["search"])}
      {report_tile("Risk Filter", filters["risk"])}
      {report_tile("Disposition Filter", filters["disposition"])}
    </section>

    <table>
      <thead>
        <tr>
          <th>Generated</th>
          <th>Patient ID</th>
          <th>Age</th>
          <th>Sex</th>
          <th>Surgery</th>
          <th>Disposition</th>
          <th>Risk</th>
          <th>Probability</th>
          <th>Model</th>
          <th>Clinical Note</th>
        </tr>
      </thead>
      <tbody>
        {rows}
      </tbody>
    </table>

    <p class="footer">Generated by the postoperative oxygen requirement prediction system.</p>
  </main>
</body>
</html>"""


def prediction_report_row(prediction):
    risk = prediction.get("risk_level") or "Unknown"
    probability = round(float(prediction.get("predicted_probability") or 0))
    return f"""
        <tr>
          <td>{escape(format_report_date(prediction.get("generated_at")))}</td>
          <td>{escape(str(prediction.get("patient_id") or "Not recorded"))}</td>
          <td>{escape(str(prediction.get("age") or "Not recorded"))}</td>
          <td>{escape(str(prediction.get("sex") or "Not recorded"))}</td>
          <td>{escape(str(prediction.get("surgery_type") or "Not recorded"))}</td>
          <td>{escape(str(prediction.get("patient_disposition") or "Not recorded"))}</td>
          <td class="{risk_class(risk)}">{escape(str(risk))}</td>
          <td>{probability}%</td>
          <td>{escape(str(prediction.get("model_version") or "v1.0"))}</td>
          <td>{escape(clinical_note_text(prediction))}</td>
        </tr>
    """


def prediction_export_row(prediction):
    return [
        format_report_date(prediction.get("generated_at")),
        prediction.get("patient_id") or "Not recorded",
        prediction.get("age") or "Not recorded",
        prediction.get("sex") or "Not recorded",
        prediction.get("surgery_type") or "Not recorded",
        prediction.get("patient_disposition") or "Not recorded",
        prediction.get("risk_level") or "Unknown",
        f"{round(float(prediction.get('predicted_probability') or 0))}%",
        prediction.get("model_version") or "v1.0",
        clinical_note_text(prediction),
    ]


def build_prediction_history_pdf(predictions, all_predictions, filters):
    total = len(all_predictions)
    filtered_high = sum(1 for prediction in predictions if prediction.get("risk_level") == "High")
    average = round(
        sum(float(prediction.get("predicted_probability") or 0) for prediction in all_predictions) / total
    ) if total else 0
    generated_at = timezone.localtime().strftime("%b %d, %Y, %I:%M %p")

    pages = []
    page = PdfPage()
    draw_pdf_header(page, generated_at)
    y = 470
    y = draw_pdf_summary(page, y, [
        ("Total Predictions", str(total)),
        ("Rows Included", str(len(predictions))),
        ("High-Risk Cases", str(filtered_high)),
        ("Average Probability", f"{average}%"),
    ])
    y = draw_pdf_summary(page, y - 6, [
        ("Search", filters["search"]),
        ("Risk", filters["risk"]),
        ("Disposition", filters["disposition"]),
    ])
    y -= 18
    draw_pdf_table_header(page, y)
    y -= 22

    if not predictions:
        page.text(54, y, "No prediction history matched the selected filters.", size=10)
    else:
        for prediction in predictions:
            row_lines = pdf_row_lines(prediction)
            row_height = max(len(lines) for lines in row_lines) * 11 + 14
            if y - row_height < 54:
                page.footer(len(pages) + 1)
                pages.append(page)
                page = PdfPage()
                draw_pdf_header(page, generated_at)
                y = 470
                draw_pdf_table_header(page, y)
                y -= 22
            draw_pdf_row(page, y, row_lines, row_height)
            y -= row_height

    page.footer(len(pages) + 1)
    pages.append(page)
    return write_pdf(pages)


class PdfPage:
    width = 842
    height = 595

    def __init__(self):
        self.commands = []

    def text(self, x, y, text, size=9, bold=False):
        font = "F2" if bold else "F1"
        self.commands.append(f"BT /{font} {size} Tf {x} {y} Td ({pdf_escape(text)}) Tj ET")

    def rect(self, x, y, width, height, fill=None, stroke="0.82 0.87 0.94"):
        if fill:
            self.commands.append(f"q {fill} rg {x} {y} {width} {height} re f Q")
        self.commands.append(f"q {stroke} RG {x} {y} {width} {height} re S Q")

    def line(self, x1, y1, x2, y2, color="0.52 0.80 0.09", width=2):
        self.commands.append(f"q {color} RG {width} w {x1} {y1} m {x2} {y2} l S Q")

    def circle(self, cx, cy, radius, fill=None, stroke="0 0 0", width=1):
        kappa = 0.5522847498
        c = radius * kappa
        path = (
            f"{cx + radius} {cy} m "
            f"{cx + radius} {cy + c} {cx + c} {cy + radius} {cx} {cy + radius} c "
            f"{cx - c} {cy + radius} {cx - radius} {cy + c} {cx - radius} {cy} c "
            f"{cx - radius} {cy - c} {cx - c} {cy - radius} {cx} {cy - radius} c "
            f"{cx + c} {cy - radius} {cx + radius} {cy - c} {cx + radius} {cy} c"
        )
        if fill and stroke:
            self.commands.append(f"q {fill} rg {stroke} RG {width} w {path} B Q")
        elif fill:
            self.commands.append(f"q {fill} rg {path} f Q")
        elif stroke:
            self.commands.append(f"q {stroke} RG {width} w {path} S Q")

    def polyline(self, points, x, y, size, color="0 0 0", width=1):
        scale = size / 512
        converted = [(x + px * scale, y + size - py * scale) for px, py in points]
        start_x, start_y = converted[0]
        segments = [f"{start_x} {start_y} m"]
        segments.extend(f"{point_x} {point_y} l" for point_x, point_y in converted[1:])
        self.commands.append(f"q {color} RG {width} w 1 J 1 j {' '.join(segments)} S Q")

    def svg_path(self, commands, x, y, size, fill="0 0 0", stroke=None, width=1):
        scale = size / 512

        def point(px, py):
            return x + px * scale, y + size - py * scale

        parts = []
        current_x = 0
        current_y = 0
        last_c2 = None
        for command in commands:
            op = command[0]
            values = command[1:]
            absolute = op.isupper()
            op_lower = op.lower()

            if op_lower == "m":
                current_x, current_y = values[0], values[1]
                px, py = point(current_x, current_y)
                parts.append(f"{px} {py} m")
                last_c2 = None
            elif op_lower == "l":
                next_x = values[0] if absolute else current_x + values[0]
                next_y = values[1] if absolute else current_y + values[1]
                px, py = point(next_x, next_y)
                parts.append(f"{px} {py} l")
                current_x, current_y = next_x, next_y
                last_c2 = None
            elif op_lower == "h":
                next_x = values[0] if absolute else current_x + values[0]
                px, py = point(next_x, current_y)
                parts.append(f"{px} {py} l")
                current_x = next_x
                last_c2 = None
            elif op_lower == "v":
                next_y = values[0] if absolute else current_y + values[0]
                px, py = point(current_x, next_y)
                parts.append(f"{px} {py} l")
                current_y = next_y
                last_c2 = None
            elif op_lower == "c":
                c1x = values[0] if absolute else current_x + values[0]
                c1y = values[1] if absolute else current_y + values[1]
                c2x = values[2] if absolute else current_x + values[2]
                c2y = values[3] if absolute else current_y + values[3]
                next_x = values[4] if absolute else current_x + values[4]
                next_y = values[5] if absolute else current_y + values[5]
                p1x, p1y = point(c1x, c1y)
                p2x, p2y = point(c2x, c2y)
                px, py = point(next_x, next_y)
                parts.append(f"{p1x} {p1y} {p2x} {p2y} {px} {py} c")
                current_x, current_y = next_x, next_y
                last_c2 = (c2x, c2y)
            elif op_lower == "s":
                if last_c2:
                    c1x = current_x + (current_x - last_c2[0])
                    c1y = current_y + (current_y - last_c2[1])
                else:
                    c1x, c1y = current_x, current_y
                c2x = values[0] if absolute else current_x + values[0]
                c2y = values[1] if absolute else current_y + values[1]
                next_x = values[2] if absolute else current_x + values[2]
                next_y = values[3] if absolute else current_y + values[3]
                p1x, p1y = point(c1x, c1y)
                p2x, p2y = point(c2x, c2y)
                px, py = point(next_x, next_y)
                parts.append(f"{p1x} {p1y} {p2x} {p2y} {px} {py} c")
                current_x, current_y = next_x, next_y
                last_c2 = (c2x, c2y)
            elif op_lower == "z":
                parts.append("h")
                last_c2 = None

        if fill and stroke:
            self.commands.append(f"q {fill} rg {stroke} RG {width} w {' '.join(parts)} B Q")
        elif fill:
            self.commands.append(f"q {fill} rg {' '.join(parts)} f Q")
        elif stroke:
            self.commands.append(f"q {stroke} RG {width} w {' '.join(parts)} S Q")

    def footer(self, page_number):
        self.text(360, 24, f"Page {page_number}", size=8)

    def stream(self):
        return "\n".join(self.commands).encode("utf-8")


def draw_pdf_header(page, generated_at):
    draw_project_logo(page, 44, 520, 46)
    page.text(104, 552, REPORT_TITLE, size=14, bold=True)
    page.text(104, 532, "Prediction History Full Report", size=11, bold=True)
    page.text(104, 516, f"Generated on {generated_at}", size=9)
    page.line(44, 500, 798, 500)


def draw_project_logo(page, x, y, size):
    """Draw the project logo from the same visual design as the SVG asset."""
    scale = size / 512

    def px(value):
        return x + value * scale

    def py(value):
        return y + size - value * scale

    page.rect(x, y, size, size, fill="1 1 1", stroke="0.85 0.90 0.96")
    page.svg_path(
        [
            ("M", 235, 119),
            ("c", -54, -25, -134, 62, -153, 150),
            ("c", -14, 68, -4, 140, 35, 153),
            ("c", 42, 14, 89, -30, 92, -77),
            ("c", 2, -23, -9, -45, -7, -68),
            ("c", 2, -28, 26, -50, 40, -75),
            ("c", 17, -31, 14, -68, -7, -83),
            ("Z",),
        ],
        x,
        y,
        size,
        fill="0.09 0.41 0.95",
    )
    page.svg_path(
        [
            ("M", 277, 119),
            ("c", 54, -25, 134, 62, 153, 150),
            ("c", 14, 68, 4, 140, -35, 153),
            ("c", -42, 14, -89, -30, -92, -77),
            ("c", -2, -23, 9, -45, 7, -68),
            ("c", -2, -28, -26, -50, -40, -75),
            ("c", -17, -31, -14, -68, 7, -83),
            ("Z",),
        ],
        x,
        y,
        size,
        fill="0.13 0.77 0.71",
    )
    page.svg_path(
        [
            ("M", 239, 52),
            ("h", 34),
            ("v", 113),
            ("c", 0, 39, 22, 61, 54, 76),
            ("c", 10, 5, 14, 17, 9, 27),
            ("c", -5, 9, -17, 13, -27, 8),
            ("c", -23, -11, -41, -25, -53, -43),
            ("c", -12, 18, -30, 32, -53, 43),
            ("c", -10, 5, -22, 1, -27, -8),
            ("c", -5, -10, -1, -22, 9, -27),
            ("c", 32, -15, 54, -37, 54, -76),
            ("V", 52),
            ("Z",),
        ],
        x,
        y,
        size,
        fill="0.10 0.61 0.83",
    )

    page.polyline([(95, 245), (147, 245), (199, 281), (205, 187)], x, y, size, color="1 1 1", width=1.6)
    page.polyline([(148, 337), (148, 245), (205, 187)], x, y, size, color="1 1 1", width=1.6)
    page.polyline([(148, 337), (205, 281)], x, y, size, color="1 1 1", width=1.6)
    for cx, cy, radius in [(148, 245, 20), (205, 187, 20), (205, 281, 20), (148, 337, 20)]:
        page.circle(px(cx), py(cy), radius * scale, fill="1 1 1", stroke=None)

    page.svg_path(
        [
            ("M", 256, 190),
            ("c", 17, 31, 51, 62, 58, 105),
            ("c", 9, 54, -20, 109, -58, 109),
            ("s", -67, -55, -58, -109),
            ("c", 7, -43, 41, -74, 58, -105),
            ("Z",),
        ],
        x,
        y,
        size,
        fill="1 1 1",
    )
    page.circle(px(256), py(341), 31 * scale, fill=None, stroke="0.11 0.72 0.76", width=1.8)
    page.text(px(294), py(363), "2", size=max(5, size * 0.07), bold=True)


def draw_pdf_summary(page, y, items):
    x = 44
    tile_width = 180 if len(items) == 4 else 240
    for label, value in items:
        page.rect(x, y - 42, tile_width, 38, fill="0.97 0.99 1")
        page.text(x + 8, y - 18, label, size=7, bold=True)
        page.text(x + 8, y - 34, value, size=10, bold=True)
        x += tile_width + 8
    return y - 50


def draw_pdf_table_header(page, y):
    page.rect(44, y - 18, 754, 18, fill="0.93 0.96 1")
    headers = ["Generated", "Patient ID", "Surgery", "Disposition", "Risk", "Prob.", "Model", "Clinical Note"]
    x_positions = [48, 125, 210, 285, 360, 420, 470, 580]
    for x, header in zip(x_positions, headers):
        page.text(x, y - 12, header, size=7, bold=True)


def pdf_row_lines(prediction):
    generated, patient_id, _age, _sex, surgery, disposition, risk, probability, model, note = prediction_export_row(prediction)
    return [
        wrap_pdf_text(generated, 14),
        wrap_pdf_text(patient_id, 14),
        wrap_pdf_text(surgery, 14),
        wrap_pdf_text(disposition, 12),
        wrap_pdf_text(risk, 10),
        wrap_pdf_text(probability, 8),
        wrap_pdf_text(model, 18),
        wrap_pdf_text(note, 36),
    ]


def draw_pdf_row(page, y, row_lines, row_height):
    page.rect(44, y - row_height, 754, row_height)
    x_positions = [48, 125, 210, 285, 360, 420, 470, 580]
    for x, lines in zip(x_positions, row_lines):
        line_y = y - 13
        for line in lines:
            page.text(x, line_y, line, size=7)
            line_y -= 11


def wrap_pdf_text(value, max_chars):
    words = str(value or "").split()
    if not words:
        return [""]
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word[:max_chars]
    if current:
        lines.append(current)
    return lines[:5]


def write_pdf(pages):
    objects = []
    page_refs = []
    catalog_id = 1
    pages_id = 2
    font_regular_id = 3
    font_bold_id = 4
    next_id = 5

    for page in pages:
        content_id = next_id
        page_id = next_id + 1
        next_id += 2
        stream = page.stream()
        objects.append((content_id, b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream"))
        page_obj = (
            f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 {page.width} {page.height}] "
            f"/Resources << /Font << /F1 {font_regular_id} 0 R /F2 {font_bold_id} 0 R >> >> "
            f"/Contents {content_id} 0 R >>"
        ).encode("ascii")
        objects.append((page_id, page_obj))
        page_refs.append(f"{page_id} 0 R")

    kids = " ".join(page_refs)
    objects.insert(0, (font_bold_id, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"))
    objects.insert(0, (font_regular_id, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"))
    objects.insert(0, (pages_id, f"<< /Type /Pages /Kids [{kids}] /Count {len(pages)} >>".encode("ascii")))
    objects.insert(0, (catalog_id, f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode("ascii")))
    objects.sort(key=lambda item: item[0])

    output = io.BytesIO()
    output.write(b"%PDF-1.4\n")
    offsets = {}
    for object_id, body in objects:
        offsets[object_id] = output.tell()
        output.write(f"{object_id} 0 obj\n".encode("ascii"))
        output.write(body)
        output.write(b"\nendobj\n")
    xref = output.tell()
    max_id = max(offsets)
    output.write(f"xref\n0 {max_id + 1}\n".encode("ascii"))
    output.write(b"0000000000 65535 f \n")
    for object_id in range(1, max_id + 1):
        output.write(f"{offsets.get(object_id, 0):010d} 00000 n \n".encode("ascii"))
    output.write(
        f"trailer\n<< /Size {max_id + 1} /Root {catalog_id} 0 R >>\nstartxref\n{xref}\n%%EOF".encode("ascii")
    )
    return output.getvalue()


def pdf_escape(value):
    return str(value or "").replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def report_tile(label, value):
    return f"""
      <div class="tile">
        <div class="label">{escape(str(label))}</div>
        <div class="value">{escape(str(value))}</div>
      </div>
    """


def clinical_note_text(prediction):
    recommendation = first_recommendation_text(prediction)
    factor = normalized_factor_text(prediction.get("contributing_factors"))
    if recommendation and factor:
        return f"{recommendation} - key factor: {factor}"
    return recommendation or factor or "No recommendation recorded"


def first_recommendation_text(prediction):
    recommendations = prediction.get("recommendations")
    if isinstance(recommendations, list) and recommendations:
        return str(recommendations[0])
    risk = str(prediction.get("risk_level") or "").lower()
    if "high" in risk:
        return "Continue close oxygen monitoring."
    if "moderate" in risk:
        return "Continue close monitoring."
    return "Continue routine postoperative monitoring."


def normalized_factor_text(factors):
    if not isinstance(factors, list) or not factors:
        return ""
    factor = factors[0]
    if isinstance(factor, str):
        return factor
    if isinstance(factor, dict):
        return str(
            factor.get("display")
            or factor.get("label")
            or factor.get("name")
            or factor.get("feature")
            or "Recorded clinical factor"
        )
    return ""


def risk_class(risk):
    normalized = str(risk or "").lower()
    if "high" in normalized:
        return "risk-high"
    if "moderate" in normalized or "medium" in normalized:
        return "risk-moderate"
    if "low" in normalized:
        return "risk-low"
    return ""


def format_report_date(value):
    if not value:
        return "Not available"
    try:
        parsed = timezone.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed)
        return timezone.localtime(parsed).strftime("%b %d, %Y, %I:%M %p")
    except (TypeError, ValueError):
        return str(value)


def system_logo_data_url():
    logo_path = Path(settings.BASE_DIR).parent / "Front_end" / "src" / "assets" / "postop-o2-ai-logo.svg"
    if not logo_path.exists():
        return ""
    mime_type = mimetypes.guess_type(str(logo_path))[0] or "image/svg+xml"
    encoded = base64.b64encode(logo_path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def os_name_supports_dash():
    return False


def clean_dataset_value(value):
    if value is None:
        return None
    try:
        if hasattr(value, "item"):
            value = value.item()
    except ValueError:
        pass
    if isinstance(value, float) and value != value:
        return None
    return value


def prediction_response_payload(result):
    payload = dict(result)
    payload.pop("risk_level", None)
    return payload


def persist_prediction(features, payload, result):
    hospital_id = str(features.get("patient_coded_id") or features.get("hospital_id") or "KBH-UNKNOWN").strip() or "KBH-UNKNOWN"
    urgency = str(features.get("urgency") or "elective").lower()
    if urgency not in {"elective", "emergency"}:
        urgency = "emergency" if "emerg" in urgency else "elective"

    with transaction.atomic():
        patient, _ = Patient.objects.update_or_create(
            hospital_id=hospital_id,
            defaults={
                "age": int_value(features.get("age"), 0),
                "sex": str(features.get("sex") or "Unknown")[:10],
                "bmi": float_value(features.get("bmi")),
                "smoking_history": bool_value(features.get("smoking_history")),
                "comorbidities": str(features.get("comorbidities") or ""),
                "baseline_spo2": float_value(features.get("baseline_spo2")),
            },
        )
        record = PerioperativeRecord.objects.create(
            patient=patient,
            surgery_type=str(features.get("surgery_type") or "Not recorded")[:100],
            urgency=urgency,
            surgery_duration=max(0, int_value(features.get("surgery_duration"), 0)),
            blood_loss=str(features.get("blood_loss") or "")[:50],
            ward=str(features.get("ward") or "")[:50],
            anesthesia_type=str(features.get("anesthesia_type") or "Not recorded")[:50],
            asa_class=str(features.get("asa_class") or "")[:10],
            residual_effects=bool_value(features.get("residual_effects")),
            opioid_use=bool_value(features.get("opioid_use")),
            airway_event=str(features.get("airway_event") or "")[:100],
            recovery_status=str(features.get("recovery_status") or "")[:50],
            postop_spo2=float_value(features.get("postop_spo2")),
            respiratory_rate=int_or_none(features.get("respiratory_rate")),
            pain_status=str(features.get("pain_status") or "")[:50],
            consciousness=str(features.get("consciousness") or "")[:50],
            time_since_surgery=int_or_none(features.get("time_since_surgery")),
            oxygen_before_prediction=bool_value(features.get("oxygen_before_prediction")),
        )
        active_model = ModelArtifact.objects.filter(is_active=True).first()
        prediction = PredictionResult.objects.create(
            record=record,
            predicted_probability=float(result.get("predicted_probability") or result.get("probability") or 0),
            predicted_class=str(result.get("predicted_class") or ""),
            risk_level=str(result.get("risk_level") or ""),
            recommendations=result.get("recommendations") or [],
            contributing_factors=result.get("contributing_factors") or result.get("factors") or [],
            model_version=active_model.name if active_model else str(payload.get("model_type") or "v1.0"),
        )

    result["id"] = prediction.id
    result["patient_id"] = patient.hospital_id
    result["model_version"] = prediction.model_version
    result["generated_at"] = prediction.generated_at.isoformat()
    return result
