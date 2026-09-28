# syntax=docker/dockerfile:1
#
# Multi-stage so build tooling (pip, compilers, headers) never ships to runtime.
# Non-root, with a read-only-friendly filesystem and a real healthcheck.

# ---------------------------------------------------------------- build stage
FROM python:3.12-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /build

# Only the dependency files are copied first. Docker caches this layer, so a
# source-only change does not re-download and recompile every wheel.
COPY requirements.txt .

RUN python -m venv /opt/venv \
 && /opt/venv/bin/pip install --upgrade pip \
 && /opt/venv/bin/pip install -r requirements.txt

# -------------------------------------------------------------- runtime stage
FROM python:3.12-slim AS runtime

# curl is needed by the HEALTHCHECK below.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

# Unprivileged account. A container process that runs as root and is reached
# through a container escape becomes a host-root shell; this removes that step.
RUN groupadd --system --gid 1001 app \
 && useradd --system --uid 1001 --gid app --create-home --home-dir /home/app app

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
COPY --chown=app:app app ./app

# The image must start without configuration, but must NOT start in production
# with a placeholder secret: config.py refuses that at import time.
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    UPLOAD_DIR=/app/uploads

RUN mkdir -p /app/uploads && chown -R app:app /app/uploads

USER app
EXPOSE 8000

# /health is the liveness probe: no database call, so a database blip does not
# cause the orchestrator to kill healthy containers. Use /ready to gate traffic.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
