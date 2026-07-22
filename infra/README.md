# Deploying Sentinel Watch to AWS (eu-west-2)

Everything runs in AWS London — eu-west-2 — and nowhere else. The region is
hardcoded in the Terraform provider, in the application code (SES, Bedrock),
and narrowed again in IAM. UK data residency is structural, not
configuration.

## What gets built

- **VPC** with public subnets (load balancer, NAT) and private subnets
  (everything that can touch pupil data — no public IPs).
- **ECS Fargate** cluster with two services from two images:
  `web` (Next.js, behind an ALB) and `worker` (Wonde syncs + scheduled
  rules runs), plus a one-off `migrate` task definition.
- **RDS Postgres 16** — encrypted, private, 14-day backups, deletion
  protection. The master role is used only for migrations; the app connects
  as a non-owner role (see step 5).
- **ElastiCache Redis** for the job queues.
- **ECR** repositories, **Secrets Manager** shells, IAM roles scoped to
  exactly SES send + Bedrock invoke (web) and nothing extra (worker).

Rough steady-state cost at MVP sizing: ~£75–95/month, dominated by the NAT
gateway, ALB and Fargate hours.

## One-time bootstrap

**The easy way:** add the `sentinel-bootstrap` IAM user's access key as the
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` repository secrets, then run
the **Bootstrap AWS** workflow from the Actions tab. It performs every step
below — state bucket, terraform apply, SES identity, images, secrets,
migrations, app role, optional synthetic seed, first DSL account — and
prints the app URL when done. Re-running it is safe. Deactivate the access
key in IAM once you're signed in.

The manual steps below describe what the workflow does (and how to do it
by hand if you ever need to). Prerequisites for the manual path: Terraform
≥ 1.9, AWS CLI, Docker, admin credentials.

1. **Plan and apply the infrastructure**

   ```bash
   cd infra/terraform
   terraform init
   terraform apply \
     -var app_url="http://PLACEHOLDER" \
     -var email_from="Sentinel Watch <signin@yourdomain.co.uk>"
   ```

   The first apply creates everything except running containers (the ECR
   repos are empty, so services will show failed placements until step 3 —
   that's expected). Note the outputs; re-run `terraform output` any time.
   Re-apply with the real `app_url` once you know the ALB DNS name or have
   DNS set up.

2. **Verify the SES sender identity**

   In the SES console (eu-west-2): verify the sending domain (or a single
   address to start), and request production access — new accounts start in
   the SES sandbox, which can only email verified addresses. Sandbox mode is
   actually fine for the design-partner phase: verify the DSLs' addresses.

3. **Push first images**

   ```bash
   aws ecr get-login-password --region eu-west-2 | \
     docker login --username AWS --password-stdin <account>.dkr.ecr.eu-west-2.amazonaws.com
   docker build -f apps/web/Dockerfile  -t <ecr-web-url>:latest .
   docker build -f Dockerfile.worker    -t <ecr-worker-url>:latest .
   docker push <ecr-web-url>:latest
   docker push <ecr-worker-url>:latest
   ```

4. **Fill the secrets**

   - `sentinel-watch/database-url-owner` — build from the RDS endpoint
     output and the master password (AWS stored it in the secret named in
     the `rds_master_secret_arn` output):
     `postgresql://sentinel_owner:<master-password>@<rds-endpoint>:5432/sentinel_watch`
   - `sentinel-watch/wonde-api-key` — the Wonde sandbox key.
   - `sentinel-watch/database-url-app` — after step 5.

5. **Run migrations, then create the app role**

   Trigger the **Deploy** workflow (or run the migrate task by hand with
   `aws ecs run-task`). Once migrations succeed, connect to the database as
   `sentinel_owner` (from a bastion/CloudShell inside the VPC, or a
   temporary SSM port-forward) and run:

   ```bash
   psql "$OWNER_DATABASE_URL" -v app_password='<generate a long one>' \
        -f infra/sql/app-role.sql
   ```

   Then set `sentinel-watch/database-url-app` to the `sentinel_app`
   connection string. This is the role the web and worker services use —
   non-owner, DML-only, so row-level security never rests on FORCE alone.

6. **Provision the first DSL accounts**

   Sign-in is invite-only. Run the provisioning task with the worker image:

   ```bash
   aws ecs run-task --cluster sentinel-watch \
     --task-definition sentinel-watch-migrate \
     --overrides '{"containerOverrides":[{"name":"migrate","command":["pnpm","--filter","@sentinel/db","user:add:prod","--email","dsl@school.org.uk","--tenant","downlands","--name","A. Example"]}]}' \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[<private-subnets>],securityGroups=[<worker-sg>],assignPublicIp=DISABLED}"
   ```

7. **GitHub deploys**

   Create an IAM role trusting GitHub's OIDC provider for this repository,
   with permissions for ECR push, `ecs:RegisterTaskDefinition`/`RunTask`/
   `UpdateService`/`DescribeTasks`/waiters, and `ec2:DescribeSubnets`/
   `DescribeSecurityGroups`. Store its ARN as the `AWS_DEPLOY_ROLE_ARN`
   repository secret. From then on, releases are the **Deploy** workflow in
   the Actions tab: build → push → migrate → roll both services.

8. **DNS and TLS**

   Point your domain at the ALB (`alb_dns_name` output), issue an ACM
   certificate in eu-west-2, and re-apply with
   `-var certificate_arn=<arn> -var app_url=https://…` — the ALB then
   serves HTTPS and redirects HTTP.

## Decisions deliberately left open (CTO-DECISION)

- Remote Terraform state (S3 + DynamoDB) — do this immediately after
  bootstrap.
- Multi-AZ RDS and a second NAT gateway before real pupil data arrives.
- Web autoscaling / desired_count > 1, WAF on the ALB, CloudFront.
- Automatic deploys on merge to main (currently manual dispatch).
- Alerting (sync failures, migration failures, error rates) — CloudWatch
  alarms have obvious hooks in the log groups but nothing is wired yet.
