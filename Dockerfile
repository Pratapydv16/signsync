# Use Node.js as the base (better for Next.js)
FROM node:20-slim

# Install Python and build essentials
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first
COPY requirements-prod.txt .
RUN pip3 install --no-cache-dir -r requirements-prod.txt

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the code
COPY . .

# Build the Next.js app
RUN npm run build

# Ensure start script is executable
RUN chmod +x start.sh

# Hugging Face uses port 7860
ENV PORT=7860
EXPOSE 7860

# Start both servers
CMD ["./start.sh"]
