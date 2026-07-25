resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-db"
  subnet_ids = aws_subnet.private[*].id
}

# Postgres 16, private subnets only, encrypted at rest, automated backups.
# The master role (sentinel_owner) is used ONLY for migrations; the app
# connects as a separate non-owner role so row-level security never depends
# on FORCE alone — see infra/sql/app-role.sql and the runbook.
resource "aws_db_instance" "main" {
  identifier     = "${var.project}-db"
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  db_name  = "sentinel_watch"
  username = "sentinel_owner"
  # AWS generates and stores the master password in Secrets Manager.
  manage_master_user_password = true

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  backup_retention_period   = 14
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project}-db-final"

  # Multi-AZ failover. Off by default to keep the design-partner MVP
  # affordable; flip rds_multi_az = true before real pupil data arrives (a
  # standing CTO-DECISION in docs/HARDENING.md).
  multi_az = var.rds_multi_az
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project}-redis"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_cluster" "main" {
  cluster_id      = "${var.project}-redis"
  engine          = "redis"
  engine_version  = "7.1"
  node_type       = var.redis_node_type
  num_cache_nodes = 1
  port            = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]
}
