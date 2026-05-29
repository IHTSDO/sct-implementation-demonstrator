# Snowstorm-X Dashboard Local Runbook

## Purpose

Use this runbook to launch a local Snowstorm-X/Snowstorm Dashboard instance for demonstrations of SNOMED CT terminology services. This document belongs to the implementation demonstrator workspace; it does not vendor or replace the upstream Snowstorm-X repository.

## Upstream Sources

- [Snowstorm-X dashboard README section](https://github.com/IHTSDO/snowstorm-x#latest-snowstormx-feature-snowstorm-dashboard-beta)
- [docker-environment.example.txt](https://github.com/IHTSDO/snowstorm-x/blob/master/docker-environment.example.txt)
- [docker-compose.yml](https://github.com/IHTSDO/snowstorm-x/blob/master/docker-compose.yml)
- [snomedinternational/snowstorm-x Docker tags](https://hub.docker.com/r/snomedinternational/snowstorm-x/tags)

## Prerequisites

- Docker Desktop or Docker Engine.
- Docker Compose v2, available as `docker compose`.
- SNOMED International MLDS credentials with permission to download SNOMED CT release packages.
- Enough local memory for Elasticsearch and Snowstorm. The upstream compose file reserves several GB for Elasticsearch and starts Snowstorm with a multi-GB JVM heap.

## Setup

Create the Snowstorm-X working folder outside this repository, or in the repository-local ignored workspace `.local/snowstorm-x`. Do not commit the generated environment file.

```bash
mkdir -p .local/snowstorm-x
cd .local/snowstorm-x
```

Download or copy the upstream environment example into the folder:

```bash
curl -L -o docker-environment.example.txt \
  https://raw.githubusercontent.com/IHTSDO/snowstorm-x/master/docker-environment.example.txt
```

Create the local environment file:

```bash
cp docker-environment.example.txt docker-environment.txt
```

Edit `docker-environment.txt` and add the MLDS credentials:

```text
SYNDICATION_USERNAME=your_mlds_username
SYNDICATION_PASSWORD=your_mlds_password
```

The upstream Snowstorm-X compose file reads this file explicitly with:

```yaml
env_file:
  - docker-environment.txt
```

You do not need a generic `.env` file for the upstream compose file unless you intentionally modify the compose configuration. If you are adapting values from another local file, such as a Snowstorm Lite environment file, copy only `SYNDICATION_USERNAME` and `SYNDICATION_PASSWORD` for this stack and keep the resulting file out of Git.

Download or copy the upstream Docker Compose file:

```bash
curl -L -o docker-compose.yml \
  https://raw.githubusercontent.com/IHTSDO/snowstorm-x/master/docker-compose.yml
```

Start the stack:

```bash
docker compose up
```

## Access

Open the dashboard/FHIR endpoint:

```text
http://localhost:8080/fhir/
```

If the compose stack also starts the SNOMED CT Browser container, the browser may be available on:

```text
http://localhost/
```

## Demo Readiness Checklist

- `docker compose ps` shows the Elasticsearch and Snowstorm containers running.
- Elasticsearch health checks have passed before Snowstorm starts.
- `http://localhost:8080/fhir/` opens in a browser.
- The dashboard loads without MLDS authentication errors.
- Ports `80`, `8080`, and `9200` are not already in use by another local service.
- The Docker memory limit is high enough for Elasticsearch and Snowstorm.

## Security

Never commit `docker-environment.txt`. It contains MLDS credentials.

Never commit `.env`, `*.env`, or Snowstorm Lite environment files. These files can contain MLDS credentials and admin passwords.

Keep the Snowstorm-X working folder outside this repository unless there is a specific reason to keep it nearby. If it is kept near the repository, use an ignored local folder and verify `git status` before committing.

This repository ignores `.local/`, so `.local/snowstorm-x/docker-environment.txt` and the local compose runtime files can be used for demos without being pushed.

## Image Note

As checked on 2026-05-27, the upstream `docker-compose.yml` file uses:

```text
snomedinternational/snowstorm-x:10.11.11
```

Docker Hub also publishes:

```text
snomedinternational/snowstorm-x:latest
```

Use the upstream compose file as provided unless you intentionally verify and switch tags before a demo. The Snowstorm-X repository describes the dashboard as beta, so confirm the intended image and tag when preparing a live demonstration.

## Troubleshooting

### MLDS Credentials

If startup fails during package download or the dashboard reports authorization errors, confirm that `SYNDICATION_USERNAME` and `SYNDICATION_PASSWORD` are correct and that the MLDS account has download permissions.

### Docker Memory

If Elasticsearch exits, Snowstorm never starts, or the machine becomes unstable, increase the Docker memory allocation and restart the stack.

### Occupied Ports

If Docker reports port binding failures, check whether another local service is already using `80`, `8080`, or `9200`. Stop the conflicting service or adjust the port mappings in the local copy of `docker-compose.yml`.

For example, if another local Snowstorm instance already uses host port `8080`, change only the host-side port in the Snowstorm service:

```yaml
ports:
  - 8081:8080
```

Then open `http://localhost:8081/fhir/`.

### Elasticsearch Startup Time

Snowstorm waits for Elasticsearch to pass its health check. On a cold start, Elasticsearch can take a while to initialize, especially on machines with limited memory or disk throughput.

### Traceability Log Permission

If Snowstorm exits with `FileNotFoundException: authoring-traceability.log (Permission denied)`, set a writable working directory for the Snowstorm service in the local compose file:

```yaml
snowstorm:
  working_dir: /tmp
```

### Clean Restart

Stop the stack with:

```bash
docker compose down
```

To remove the persisted Elasticsearch volume and start from an empty index, use:

```bash
docker compose down -v
```

Only remove volumes when you are comfortable losing locally loaded terminology data.
