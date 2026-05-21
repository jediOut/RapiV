# RapiV Observability

Local stack:

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001
- Loki: http://localhost:3100

Start it with Docker Desktop running:

```bash
docker compose up -d prometheus loki promtail grafana
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

Prometheus scrapes the backend at `host.docker.internal:3000/api/metrics`, so the backend can keep running locally during development. Promtail collects Docker container logs into Loki. To see backend logs in Loki too, run the backend as a Docker container or add a local Promtail target for the backend log file.
