from fastapi import FastAPI, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from pydantic import BaseModel
from dotenv import load_dotenv
from datetime import datetime
from typing import Dict, Any, Optional
import json
from fastapi import Form
from fastapi.responses import RedirectResponse

from prediction_service import PredictionService
from trainer import train_model
from fastapi import UploadFile, File
import uuid
import threading
from pathlib import Path

# Simple in-memory job store for training jobs (id -> status dict)
TRAIN_JOBS: Dict[str, Dict[str, Any]] = {}

# Ensure datasets and models directories exist
Path(os.path.join(os.path.dirname(__file__), "datasets")).mkdir(parents=True, exist_ok=True)
Path(os.path.join(os.path.dirname(__file__), "models")).mkdir(parents=True, exist_ok=True)

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./postop_dev.db")

# Use sqlite connect args when using a file-based SQLite URL
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    age = Column(Integer)


class PredictionResult(Base):
    __tablename__ = "prediction_results"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, nullable=True)
    model_type = Column(String, nullable=False)
    probability = Column(Float, nullable=False)
    risk_level = Column(String, nullable=False)
    shap = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)

app = FastAPI()
 
# Enable CORS for local dev (vite / react frontends)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:5000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Templates (backend/templates)
templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))

class PatientCreate(BaseModel):
    name: str
    age: int


class PredictionRequest(BaseModel):
    features: Dict[str, Any]
    model_type: str
    model_path: Optional[str] = None
    patient_id: Optional[int] = None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/patients")
def create_patient(p: PatientCreate, db=Depends(get_db)):
    patient = Patient(name=p.name, age=p.age)
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return {"id": patient.id, "name": patient.name, "age": patient.age}

@app.get("/patients")
def list_patients(db=Depends(get_db)):
    patients = db.query(Patient).all()
    return patients


@app.post("/predict")
async def predict(request: Request, db=Depends(get_db)):
    """Run prediction for provided features, save result, and return explanation.

    Accepts either a structured body: {features: {...}, model_type: 'xgboost', model_path: '...'}
    or a flat body like {post_op_spo2: 90}. Falls back to a simple heuristic when no model is available.
    """
    body = {}
    try:
        body = await request.json()
    except Exception:
        body = {}

    # Normalize features
    features = body.get("features") if isinstance(body.get("features"), dict) else None
    if features is None:
        # Treat the whole body as features (flat payloads from the frontend stub)
        features = {k: v for k, v in body.items()}

    model_type = (body.get("model_type") or body.get("modelType") or "xgboost").lower()
    model_path = body.get("model_path") or body.get("modelPath") or os.getenv("MODEL_PATH")
    patient_id = body.get("patient_id") or body.get("patientId")

    # If a model path is configured and exists, try to use the PredictionService
    result = None
    if model_path and os.path.exists(model_path):
        try:
            service = PredictionService(model_path=model_path, model_type=model_type)
            result = service.predict(features)
        except Exception:
            result = None

    # Fallback stub when no model is available or prediction failed
    if result is None:
        # Use a simple heuristic similar to the frontend/node stub
        post_op_spo2 = None
        for key in ("post_op_spo2", "postOpSpO2", "post_op_spo2_percent", "postop_spo2"):
            if key in features:
                try:
                    post_op_spo2 = float(features[key])
                    break
                except Exception:
                    post_op_spo2 = None

        prob = 0.82
        if post_op_spo2 is not None:
            if post_op_spo2 < 92:
                prob += 0.08
            if post_op_spo2 < 88:
                prob += 0.05
        prob = max(0, min(0.99, prob))

        factors = [f"Post-op SpO₂: {int(post_op_spo2) if post_op_spo2 is not None else 'unknown'}%",
                   'Residual anesthetic effects', 'Prolonged operative time']
        recommendations = ['Apply supplemental oxygen and monitor SpO₂ closely.', 'Repeat observations in 15 minutes.']

        result = {"probability": prob, "risk_level": ("high" if prob >= 0.5 else "low"), "shap": None,
                  "factors": factors, "recommendations": recommendations}

    # Persist result
    pr = PredictionResult(
        patient_id=patient_id,
        model_type=model_type,
        probability=result["probability"],
        risk_level=result.get("risk_level", ("high" if result["probability"] >= 0.5 else "low")),
        shap=(json.dumps(result["shap"]) if result.get("shap") is not None else None),
    )
    db.add(pr)
    db.commit()
    db.refresh(pr)

    # Return combined payload (include any explanation fields from the result)
    out = {"id": pr.id, "probability": pr.probability, "risk_level": pr.risk_level}
    # Merge known explanation fields if present
    for key in ("shap", "factors", "recommendations"):
        if key in result and result[key] is not None:
            out[key] = result[key]

    return out


@app.post("/upload-dataset")
async def upload_dataset(file: UploadFile = File(...)):
    dest_dir = os.path.join(os.path.dirname(__file__), "datasets")
    os.makedirs(dest_dir, exist_ok=True)
    dest_path = os.path.join(dest_dir, file.filename)
    with open(dest_path, "wb") as f:
        f.write(await file.read())
    return {"dataset_path": dest_path}


def _run_training_job(job_id: str, dataset_path: str, target: Optional[str], model_type: str):
    TRAIN_JOBS[job_id]["status"] = "running"
    try:
        res = train_model(dataset_path, target_column=target, model_type=model_type)
        TRAIN_JOBS[job_id]["status"] = "completed"
        TRAIN_JOBS[job_id]["result"] = res
    except Exception as e:
        TRAIN_JOBS[job_id]["status"] = "failed"
        TRAIN_JOBS[job_id]["error"] = str(e)


@app.post("/train")
async def start_training(payload: Dict[str, Any]):
    dataset_path = payload.get("dataset_path")
    target = payload.get("target")
    model_type = payload.get("model_type", "sklearn")
    if not dataset_path or not os.path.exists(dataset_path):
        return {"error": "dataset_path missing or does not exist"}

    job_id = str(uuid.uuid4())
    TRAIN_JOBS[job_id] = {"status": "queued", "dataset": dataset_path}
    thread = threading.Thread(target=_run_training_job, args=(job_id, dataset_path, target, model_type), daemon=True)
    thread.start()
    return {"job_id": job_id}


@app.get("/train/status/{job_id}")
def train_status(job_id: str):
    job = TRAIN_JOBS.get(job_id)
    if not job:
        return {"error": "job not found"}
    return job


@app.get("/models")
def list_models():
    models_dir = os.path.join(os.path.dirname(__file__), "models")
    files = []
    if os.path.exists(models_dir):
        for fn in os.listdir(models_dir):
            files.append(os.path.join(models_dir, fn))
    return {"models": files}


@app.get("/models/download")
def download_model(path: str):
    # Safety: ensure the requested file is inside the models directory
    models_dir = os.path.join(os.path.dirname(__file__), "models")
    requested = os.path.abspath(path)
    if not requested.startswith(os.path.abspath(models_dir)):
        return {"error": "invalid path"}
    if not os.path.exists(requested):
        return {"error": "file not found"}
    return FileResponse(requested, filename=os.path.basename(requested), media_type='application/octet-stream')


@app.get("/results/{result_id}", response_class=HTMLResponse)
def view_result(request: Request, result_id: int, db=Depends(get_db)):
    """Render HTML view for a saved prediction result."""
    res = db.query(PredictionResult).filter(PredictionResult.id == result_id).first()
    if not res:
        return HTMLResponse(content="<h3>Result not found</h3>", status_code=404)

    # Try fetch patient if linked
    patient = None
    if res.patient_id:
        patient = db.query(Patient).filter(Patient.id == res.patient_id).first()

    shap = None
    try:
        if res.shap:
            shap = json.loads(res.shap)
    except Exception:
        shap = None

    # Render template
    return templates.TemplateResponse("result.html", {"request": request, "result": res, "patient": patient, "shap": shap})
