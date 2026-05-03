# ─── Stage 1: Build Frontend ───
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ─── Stage 2: Final Image ───
FROM python:3.10-slim
WORKDIR /app

# Install Node.js for the frontend runner
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

# Copy built frontend from Stage 1
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy backend and model
COPY app.py model_utils.py model.p model_meta.json ./
COPY next.config.mjs tsconfig.json ./

# Startup script
COPY start.sh .
RUN chmod +x start.sh

# Expose the port Hugging Face expects (7860)
ENV PORT=7860
EXPOSE 7860

CMD ["./start.sh"]
