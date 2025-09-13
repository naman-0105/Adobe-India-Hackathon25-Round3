#!/bin/bash
cd frontend && npm run dev -- --host 0.0.0.0 &
cd backend && npm start &
cd backend/python && uvicorn fastapi_app:app --host 0.0.0.0 --port 8000 &
wait -n