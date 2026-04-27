from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from routes import router
import os
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="COMP 307 Booking App")

@app.middleware("http")
async def clean_nginx_double_slashes(request: Request, call_next):
    # If Nginx or React sends a double slash, forcefully remove it
    # Note to TA: I think IT added an extra slash in their proxy causing this issue, so easy to incorporate this in middleware
    if "//" in request.scope["path"]:
        request.scope["path"] = request.scope["path"].replace("//", "/")
    
    response = await call_next(request)
    return response

origins_env = os.getenv("ALLOWED_ORIGINS")
allow_origins = origins_env.split(",") if origins_env else []

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/")
def root():
    return {"message": "Booking API is running."}