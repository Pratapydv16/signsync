#!/bin/bash

# Start Flask Backend in the background
python3 app.py &

# Start Next.js Frontend on the port Hugging Face expects
npm run start -- -p 7860
