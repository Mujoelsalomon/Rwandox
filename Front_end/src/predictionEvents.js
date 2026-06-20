export const PREDICTION_HISTORY_UPDATED_EVENT = 'postop-o2-prediction-history-updated'
export const MODEL_REGISTRY_UPDATED_EVENT = 'postop-o2-model-registry-updated'
const PREDICTION_HISTORY_UPDATED_STORAGE_KEY = `${PREDICTION_HISTORY_UPDATED_EVENT}:broadcast`
const MODEL_REGISTRY_UPDATED_STORAGE_KEY = `${MODEL_REGISTRY_UPDATED_EVENT}:broadcast`

export function notifyPredictionHistoryUpdated(prediction) {
  dispatchPredictionHistoryUpdated({ prediction })
  broadcastEvent(PREDICTION_HISTORY_UPDATED_STORAGE_KEY, { prediction })
}

export function notifyModelRegistryUpdated(model) {
  dispatchModelRegistryUpdated({ model })
  broadcastEvent(MODEL_REGISTRY_UPDATED_STORAGE_KEY, { model })
}

function dispatchPredictionHistoryUpdated(detail) {
  window.dispatchEvent(new CustomEvent(PREDICTION_HISTORY_UPDATED_EVENT, { detail }))
}

function dispatchModelRegistryUpdated(detail) {
  window.dispatchEvent(new CustomEvent(MODEL_REGISTRY_UPDATED_EVENT, { detail }))
}

function broadcastEvent(key, detail) {
  try {
    window.localStorage.setItem(key, JSON.stringify({
      ...detail,
      updatedAt: new Date().toISOString(),
    }))
  } catch {
    // The local event has already been dispatched; cross-tab sync is best effort.
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === PREDICTION_HISTORY_UPDATED_STORAGE_KEY && event.newValue) {
      dispatchPredictionHistoryUpdated(readBroadcastDetail(event.newValue))
    }
    if (event.key === MODEL_REGISTRY_UPDATED_STORAGE_KEY && event.newValue) {
      dispatchModelRegistryUpdated(readBroadcastDetail(event.newValue))
    }
  })
}

function readBroadcastDetail(value) {
  try {
    return JSON.parse(value) || {}
  } catch {
    return {}
  }
}
