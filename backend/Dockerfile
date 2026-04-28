# Backend image for the Ability CV API.
#
# Built on python:3.11-slim with libreoffice + pandoc installed so that
# extractor.py can:
#   - parse .docx natively via python-docx
#   - convert legacy .doc to .docx via `soffice --headless`
#   - fall back to pandoc for edge cases
#
# Render auto-detects this Dockerfile when render.yaml has runtime: docker.

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBIAN_FRONTEND=noninteractive

# System packages:
#   libreoffice-core + libreoffice-writer  -> ~250MB, enough for .doc/.docx
#   pandoc                                  -> fallback document converter
#   poppler-utils                           -> provides pdftotext for the PDF path
#   fonts-dejavu                            -> avoids font warnings in soffice
#   ca-certificates, curl                   -> required for HTTPS to api.anthropic.com
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libreoffice-core \
        libreoffice-writer \
        pandoc \
        poppler-utils \
        fonts-dejavu \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first so they cache when only application code changes.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application code.
COPY . .

# Render injects $PORT at runtime; default to 8000 for local docker run.
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
