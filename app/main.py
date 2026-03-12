from fastapi import FastAPI

app = FastAPI(title="Instagram Account Manager")


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}
