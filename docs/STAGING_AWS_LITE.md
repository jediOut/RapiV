# RapiV staging-lite on AWS

This staging setup is intentionally small and cheap: one EC2 instance runs Docker Compose with Caddy, the backend, Postgres, and Redis. It gives the Expo apps a real HTTPS API without using Cloudflare tunnels.

## Architecture

```text
staging-api.example.com
  -> EC2 public IP
      -> Caddy HTTPS reverse proxy
          -> backend:3000
      -> Postgres private Docker network
      -> Redis private Docker network
```

Use this for staging only. Production should move Postgres to RDS, Redis to ElastiCache/Valkey, and the API to ECS behind an ALB.

## 1. Create the AWS server

Create an EC2 key pair in AWS first, then copy the Terraform example:

```powershell
Copy-Item infra/staging-lite/terraform.tfvars.example infra/staging-lite/terraform.tfvars
```

Edit `infra/staging-lite/terraform.tfvars`:

```hcl
key_name         = "your-ec2-key-pair"
allowed_ssh_cidr = "your-public-ip/32"
staging_domain   = "staging-api.your-domain.com"
hosted_zone_id   = "optional-route53-zone-id"
```

If you do not have a domain yet, keep DNS disabled and use any placeholder domain:

```hcl
allowed_ssh_cidr = "your-public-ip/32"
hosted_zone_id   = ""
staging_domain   = "staging-api.local"
```

Apply Terraform:

```powershell
cd infra/staging-lite
terraform init
terraform apply
```

If `hosted_zone_id` is empty, create an `A` record manually:

```text
staging-api.your-domain.com -> EC2 public IP
```

## 2. Prepare staging environment variables

Copy the example file:

```powershell
Copy-Item deploy/staging.env.example deploy/staging.env
```

Edit `deploy/staging.env` and replace every placeholder. Keep `DB_SYNCHRONIZE=false`; run migrations explicitly.

## 3. First deploy to the EC2 instance

From your machine, copy the repo to the server or use GitHub Actions later. The server path created by Terraform is:

```text
/opt/rapiv
```

On the EC2 instance:

```bash
cd /opt/rapiv
docker compose -f docker-compose.staging.yml build backend migrate
docker compose -f docker-compose.staging.yml --profile tools run --rm migrate
docker compose -f docker-compose.staging.yml up -d backend caddy
```

Without a domain, expose the API over plain HTTP on port `80`:

```bash
cd /opt/rapiv
docker compose -f docker-compose.staging.yml -f docker-compose.staging-ip.yml build backend migrate
docker compose -f docker-compose.staging.yml -f docker-compose.staging-ip.yml --profile tools run --rm migrate
docker compose -f docker-compose.staging.yml -f docker-compose.staging-ip.yml up -d backend
```

Verify:

```bash
curl https://staging-api.your-domain.com/api/health
```

Or, without a domain:

```bash
curl http://EC2_PUBLIC_IP/api/health
```

Expected response:

```json
{"ok":true,"service":"rapiv-backend","uptimeSeconds":123}
```

## 4. Deploy with GitHub Actions

The workflow `.github/workflows/deploy-staging-lite.yml` is manual. Configure these GitHub repository secrets:

```text
STAGING_HOST=EC2 public IP or DNS name
STAGING_SSH_USER=ubuntu
STAGING_SSH_PRIVATE_KEY=private key matching the EC2 key pair
STAGING_ENV_FILE=full contents of deploy/staging.env
```

Then run:

```text
Actions -> Deploy staging-lite -> Run workflow
```

The workflow uploads the repository, writes `deploy/staging.env` on the server, builds the backend image, runs TypeORM migrations, and starts the API.

Run it with `use_domain=false` while you do not have a domain. Later, when you add a real domain, run it with `use_domain=true` to start Caddy/HTTPS.

## 5. Test Expo apps against AWS staging

Run each app locally with the staging API:

```powershell
$env:EXPO_PUBLIC_API_URL="https://staging-api.your-domain.com/api"
cd cliente-frontend
npx expo start
```

Repeat with `negocio-frontend` and `repartidor-frontend`.

Without a domain:

```powershell
$env:EXPO_PUBLIC_API_URL="http://EC2_PUBLIC_IP/api"
cd cliente-frontend
npx expo start
```

For one-off commands without changing your shell session:

```powershell
cd cliente-frontend
$env:EXPO_PUBLIC_API_URL="https://staging-api.your-domain.com/api"; npx expo start
```

## 6. Cost controls

Keep staging small:

- Use `t3.micro` or another free-tier/credit-friendly instance while possible.
- Do not expose Postgres or Redis to the internet.
- Avoid NAT Gateway, ALB, RDS, and ElastiCache for this staging-lite environment.
- Set AWS Budgets alerts before leaving resources running.
- Stop the EC2 instance when you are not testing, if you can tolerate downtime.
