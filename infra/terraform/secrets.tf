# Secret shells: Terraform creates them, values are set out-of-band (runbook
# step) so no credential ever passes through Terraform state or the repo.

# Postgres URL for the APP role (sentinel_app — non-owner, created by
# infra/sql/app-role.sql after first boot).
resource "aws_secretsmanager_secret" "database_url_app" {
  name        = "${var.project}/database-url-app"
  description = "Postgres connection string for the application role (non-owner)."
}

# Postgres URL for the OWNER role — used only by the one-off migration task.
resource "aws_secretsmanager_secret" "database_url_owner" {
  name        = "${var.project}/database-url-owner"
  description = "Postgres connection string for migrations (owner role)."
}

resource "aws_secretsmanager_secret" "wonde_api_key" {
  name        = "${var.project}/wonde-api-key"
  description = "Wonde API key (sandbox until DPAs are signed)."
}
