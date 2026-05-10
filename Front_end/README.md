# Postop Oxygen Requirement UI

Local dev (requires Node.js >=16):

1. cd to project folder

```bash
cd "c:/Users/HP-/Desktop/RESEARCH PROPOSALS/MACHINE LEARNING/postop-oxygen-ui"
npm install
npm run dev
```

2. Open the local dev URL shown by Vite (usually http://localhost:5173)

Build for production:

```bash
npm run build
npm run preview
```

Notes:

- This is a frontend mockup. Integrate the model API by adding an HTTP call to your prediction endpoint in `src/PostoperativeOxygenMLUIMockup.jsx` and wiring the form inputs.
- Tailwind classes are used via CDN in `index.html`.
