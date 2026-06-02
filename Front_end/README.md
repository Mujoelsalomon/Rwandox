# Postop Oxygen Requirement UI

Local dev (requires Node.js >=16):

1. cd to project folder

```bash
cd "c:/Users/HP-/Desktop/RESEARCH PROPOSALS/MACHINE LEARNING/postop-oxygen-ui"
npm install
npm run dev
```

2. Open the local dev URL shown by Vite (usually http://localhost:5173)

Local Wi-Fi testing:

1. From the project root, detect/write the current Wi-Fi URL:

```powershell
.\scripts\start-local-wifi.ps1
```

You can override the detected address:

```powershell
.\scripts\start-local-wifi.ps1 -LocalIp 192.168.1.25
```

2. Start the frontend on the local network:

```bash
cd Front_end
npm run dev -- --host 0.0.0.0
```

3. Open the frontend from another device on the same Wi-Fi:

```text
http://<LOCAL_IP>:5173
```

The helper writes `Front_end/.env.local` with:

```env
VITE_API_URL=http://<LOCAL_IP>:8000
VITE_LOCAL_IP=<LOCAL_IP>
VITE_LOCAL_FRONTEND_URL=http://<LOCAL_IP>:5173
```

Open System Administration, then choose `QR-code access` to show and download the local access QR code.

Build for production:

```bash
npm run build
npm run preview
```

Notes:

- This is a frontend mockup. Integrate the model API by adding an HTTP call to your prediction endpoint in `src/PostoperativeOxygenMLUIMockup.jsx` and wiring the form inputs.
- Bootstrap is installed locally and loaded globally from `src/main.jsx`, so Bootstrap classes and JavaScript components work across the React app without the CDN.
- Tailwind classes are used via CDN in `index.html`.
- Local Wi-Fi QR access is for local testing only.
- Users must be connected to the same Wi-Fi as the laptop running Vite.
- Do not use real patient identifiers or sensitive hospital data during local testing.
- Use dummy/test data only.
