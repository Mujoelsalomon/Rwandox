FROM node:18-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps || npm install

COPY . .

EXPOSE 5173

ENV HOST 0.0.0.0

CMD ["sh", "-c", "npm run dev -- --host 0.0.0.0 --port 5173"]
