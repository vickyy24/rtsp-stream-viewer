FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install --no-install-recommends -y ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN python -m pip install --no-cache-dir -r requirements.txt

COPY . ./

EXPOSE 8000

CMD ["sh", "-c", "daphne --websocket-max-message-size 4096 -b 0.0.0.0 -p ${PORT:-8000} config.asgi:application"]
