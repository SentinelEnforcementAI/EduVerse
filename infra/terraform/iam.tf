data "aws_caller_identity" "current" {}

# Execution role: what ECS itself needs — pull images, write logs, read the
# secrets injected into task definitions.
resource "aws_iam_role" "task_execution" {
  name = "${var.project}-task-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "task_execution_managed" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "task_execution_secrets" {
  name = "read-app-secrets"
  role = aws_iam_role.task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_secretsmanager_secret.database_url_app.arn,
        aws_secretsmanager_secret.database_url_owner.arn,
        aws_secretsmanager_secret.wonde_api_key.arn,
      ]
    }]
  })
}

# Web task role: send sign-in email via SES and call Claude on Bedrock —
# both pinned to eu-west-2 in code; IAM narrows them again here.
resource "aws_iam_role" "web_task" {
  name = "${var.project}-web-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "web_task_permissions" {
  name = "ses-and-bedrock"
  role = aws_iam_role.web_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "SendSignInEmail"
        Effect   = "Allow"
        Action   = ["ses:SendEmail"]
        Resource = "*"
        Condition = {
          StringEquals = { "aws:RequestedRegion" = "eu-west-2" }
        }
      },
      {
        Sid      = "InvokeClaudeLondon"
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel"]
        Resource = "arn:aws:bedrock:eu-west-2::foundation-model/anthropic.*"
      },
    ]
  })
}

# Worker task role: nothing beyond network access to RDS/Redis today.
resource "aws_iam_role" "worker_task" {
  name = "${var.project}-worker-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}
