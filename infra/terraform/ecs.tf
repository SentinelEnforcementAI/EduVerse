resource "aws_ecs_cluster" "main" {
  name = var.project

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${var.project}/web"
  retention_in_days = 90
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.project}/worker"
  retention_in_days = 90
}

locals {
  redis_url = "redis://${aws_elasticache_cluster.main.cache_nodes[0].address}:6379"

  log_config = {
    web    = { group = aws_cloudwatch_log_group.web.name }
    worker = { group = aws_cloudwatch_log_group.worker.name }
  }
}

resource "aws_ecs_task_definition" "web" {
  family                   = "${var.project}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.web_task.arn

  container_definitions = jsonencode([{
    name         = "web"
    image        = "${aws_ecr_repository.web.repository_url}:${var.web_image_tag}"
    essential    = true
    portMappings = [{ containerPort = 3000, protocol = "tcp" }]
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "APP_URL", value = var.app_url },
      { name = "EMAIL_TRANSPORT", value = "ses" },
      { name = "EMAIL_FROM", value = var.email_from },
    ]
    secrets = [
      {
        name      = "DATABASE_URL"
        valueFrom = aws_secretsmanager_secret.database_url_app.arn
      },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = local.log_config.web.group
        awslogs-region        = "eu-west-2"
        awslogs-stream-prefix = "web"
      }
    }
  }])
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.project}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.worker_task.arn

  container_definitions = jsonencode([{
    name      = "worker"
    image     = "${aws_ecr_repository.worker.repository_url}:${var.worker_image_tag}"
    essential = true
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "REDIS_URL", value = local.redis_url },
    ]
    secrets = [
      {
        name      = "DATABASE_URL"
        valueFrom = aws_secretsmanager_secret.database_url_app.arn
      },
      {
        name      = "WONDE_API_KEY"
        valueFrom = aws_secretsmanager_secret.wonde_api_key.arn
      },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = local.log_config.worker.group
        awslogs-region        = "eu-west-2"
        awslogs-stream-prefix = "worker"
      }
    }
  }])
}

# One-off migrations/admin task (aws ecs run-task from the workflows).
# Runs as the DB owner; the long-lived services never hold owner
# credentials. Sized for the heaviest one-off job — the synthetic seed
# generates two full schools in memory (512MB OOM-killed it).
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${var.project}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 1024
  memory                   = 4096
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.worker_task.arn

  container_definitions = jsonencode([{
    name        = "migrate"
    image       = "${aws_ecr_repository.worker.repository_url}:${var.worker_image_tag}"
    essential   = true
    command     = ["pnpm", "--filter", "@sentinel/db", "db:deploy:prod"]
    environment = [{ name = "NODE_ENV", value = "production" }]
    secrets = [
      {
        name      = "DATABASE_URL"
        valueFrom = aws_secretsmanager_secret.database_url_owner.arn
      },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = local.log_config.worker.group
        awslogs-region        = "eu-west-2"
        awslogs-stream-prefix = "migrate"
      }
    }
  }])
}

resource "aws_ecs_service" "web" {
  name            = "web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.web.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }

  # CTO-DECISION: desired_count 2 + autoscaling before broader rollout.
  lifecycle {
    ignore_changes = [desired_count]
  }

  depends_on = [aws_lb_listener.http]
}

resource "aws_ecs_service" "worker" {
  name            = "worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.worker.id]
    assign_public_ip = false
  }

  lifecycle {
    ignore_changes = [desired_count]
  }
}
