# COMP307---Final-Project

## Backend

Built with FastAPI, SQLModel, PostgreSQL, and Alembic.

### Folder Structure

    backend/
    ├── main.py               # FastAPI app entry point
    ├── alembic.ini           # Alembic configuration
    ├── requirements.txt      # Python dependencies
    ├── database/
    │   ├── __init__.py
    │   └── session.py        # Database connection and session
    ├── models/
    │   ├── __init__.py
    │   └── users.py          # User table and schemas
    ├── routes/
    │   ├── __init__.py       # Registers all routers
    │   └── authentication.py # Register and login endpoints
    └── alembic/
        └── versions/         # Migration files

### Setup

#### 1. Start the database
Make sure Docker is installed, then run:

```bash
docker start booking-db
```

If it's your first time:

```bash
docker run --name booking-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=booking_db \
  -p 5432:5432 \
  -v booking-db-data:/var/lib/postgresql/data \
  -d postgres
```

#### 2. Create and activate virtual environment

```bash
python -m venv venv
source venv/bin/activate
```

#### 3. Install dependencies

```bash
pip install -r requirements.txt
```

#### 4. Run migrations

```bash
alembic upgrade head
```

#### 5. Start the server

```bash
uvicorn main:app --reload
```

API is running at `http://localhost:8000`  
Swagger docs at `http://localhost:8000/docs`