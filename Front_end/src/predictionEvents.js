export const PREDICTION_HISTORY_UPDATED_EVENT = 'postop-o2-prediction-history-updated'
export const MODEL_REGISTRY_UPDATED_EVENT = 'postop-o2-model-registry-updated'

export function notifyPredictionHistoryUpdated(prediction) {
  window.dispatchEvent(new CustomEvent(PREDICTION_HISTORY_UPDATED_EVENT, {
    detail: { prediction },
  }))
}

export function notifyModelRegistryUpdated(model) {
  window.dispatchEvent(new CustomEvent(MODEL_REGISTRY_UPDATED_EVENT, {
    detail: { model },
  }))
}
