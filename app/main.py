from fastapi import FastAPI

from app.routers.accounts import router as accounts_router
from app.routers.posts import router as posts_router

app = FastAPI(title="Instagram Account Manager")


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


app.include_router(accounts_router, prefix="/api")
app.include_router(posts_router, prefix="/api")
