export const PREDICTION_HISTORY_UPDATED_EVENT = 'postop-o2-prediction-history-updated'

export function notifyPredictionHistoryUpdated(prediction) {
  window.dispatchEvent(new CustomEvent(PREDICTION_HISTORY_UPDATED_EVENT, {
    detail: { prediction },
  }))
}
