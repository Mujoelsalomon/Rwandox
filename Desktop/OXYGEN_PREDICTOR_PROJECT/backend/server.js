import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 5000

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.post('/predict', (req, res) => {
  // Expect a JSON body with optional fields; this is a stub.
  const body = req.body || {}
  const postOpSpO2 = Number(body.post_op_spo2 ?? body.postOpSpO2 ?? 90)

  // Base probability
  let prob = 0.82
  if (!Number.isNaN(postOpSpO2)) {
    if (postOpSpO2 < 92) prob += 0.08
    if (postOpSpO2 < 88) prob += 0.05
  }
  prob = Math.max(0, Math.min(0.99, prob))

  const factors = [
    `Post-op SpO₂: ${postOpSpO2}%`,
    'Residual anesthetic effects',
    'Prolonged operative time',
  ]

  const recommendations = [
    'Apply supplemental oxygen and monitor SpO₂ closely.',
    'Repeat observations in 15 minutes.',
  ]

  res.json({ probability: prob, factors, recommendations })
})

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Postop oxygen backend stub listening on http://localhost:${PORT}`)
})
