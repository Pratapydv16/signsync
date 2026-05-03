#!/bin/bash

# Start Flask Backend in the background
# We'll use 127.0.0.1 so it's only accessible to the Next.js proxy
python app.py &

# Start Next.js Frontend on the port Hugging Face expects
npm run start -- -p 7860
