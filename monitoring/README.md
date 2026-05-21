# RapiV Observability

Local stack:

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001
- Loki: http://localhost:3100

Start the full local stack with Docker Desktop running:

```bash
docker compose up -d postgres redis backend prometheus loki promtail grafana
```

Backend metrics:

```bash
curl http://localhost:3000/api/metrics
```

Grafana credentials come from `.env`:

```env
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=replace-with-a-strong-local-password
```

Prometheus scrapes the backend container at `backend:3000/api/metrics`. Promtail collects Docker container logs into Loki, including backend logs when the backend runs through Docker Compose.
