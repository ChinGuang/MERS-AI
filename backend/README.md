# Setup Backend environment
Add these in Backend .env file:
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
DEEPGRAM_API_KEY=
CARTESIA_API_KEY=

Add these in Frontend .env file:
NEXT_PUBLIC_LIVEKIT_API_URL="http://localhost:8010"
NEXT_PUBLIC_TOGGLE_HARDCODE=true

5 terminals (Make sure Docker Desktop is open):
* cd backend, .venv\Scripts\activate, docker compose -f docker/docker-compose.yml --env-file .env up -d 
* cd backend, .venv\Scripts\activate, uvicorn livekit_agent.api:app --port 8010 --reload
* cd backend, .venv\Scripts\activate, python -m livekit_agent.worker dev
* cd backend, .venv\Scripts\activate, fastapi dev main.py
* cd frontend, npm i, npm run dev


# Database Migration
- to autogenerate migration file 
`alembic revision --autogenerate -m <message>`

- to upgrade database schema
`alembic upgrade head`

