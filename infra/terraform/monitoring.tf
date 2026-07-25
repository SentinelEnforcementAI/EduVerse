# Monitoring and alerting (commercialisation slice 8: production hardening).
# CloudWatch alarms on the load balancer, database and services, plus
# log-metric-filter alarms on application errors, all notifying an SNS topic.
# The log groups already existed (ecs.tf); this wires alarms onto them —
# closing the "hooks exist, nothing is wired" gap noted in infra/README.md.
#
# Set alerts_email to receive notifications; otherwise the topic is created
# without a subscription and subscribers can be added later.

resource "aws_sns_topic" "alerts" {
  name = "${var.project}-alerts"
}

resource "aws_sns_topic_subscription" "alerts_email" {
  count     = var.alerts_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alerts_email
}

locals {
  alarm_actions = [aws_sns_topic.alerts.arn]
}

# ── Load balancer ───────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${var.project}-alb-5xx"
  alarm_description   = "The load balancer is returning 5xx responses."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_ELB_5XX_Count"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions          = { LoadBalancer = aws_lb.main.arn_suffix }
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts" {
  alarm_name          = "${var.project}-alb-unhealthy-hosts"
  alarm_description   = "The web target group has unhealthy hosts."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.web.arn_suffix
  }
  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
}

# ── Database ────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  alarm_name          = "${var.project}-rds-free-storage-low"
  alarm_description   = "RDS free storage is low."
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 1
  # 2 GiB — well before the 20 GiB base fills (autoscaling goes to 100 GiB).
  threshold           = 2 * 1024 * 1024 * 1024
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.identifier }
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.project}-rds-cpu-high"
  alarm_description   = "RDS CPU is sustained high."
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.identifier }
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}

# ── Services (running task counts) ──────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "web_running" {
  alarm_name          = "${var.project}-web-not-running"
  alarm_description   = "The web service has no running tasks."
  namespace           = "AWS/ECS"
  metric_name         = "RunningTaskCount"
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.web.name
  }
  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "worker_running" {
  alarm_name          = "${var.project}-worker-not-running"
  alarm_description   = "The worker service has no running tasks — syncs and rule runs are stalled."
  namespace           = "AWS/ECS"
  metric_name         = "RunningTaskCount"
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.worker.name
  }
  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
}

# ── Application errors (log metric filters) ─────────────────────────────────
# The web server emits one JSON line per server error via the observability
# seam ("level":"error"); the worker logs errors to stderr. Count them and
# alarm on a spike.

resource "aws_cloudwatch_log_metric_filter" "web_errors" {
  name           = "${var.project}-web-errors"
  log_group_name = aws_cloudwatch_log_group.web.name
  pattern        = "{ $.level = \"error\" }"
  metric_transformation {
    name          = "WebErrors"
    namespace     = "${var.project}/app"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "web_errors" {
  alarm_name          = "${var.project}-web-errors"
  alarm_description   = "A spike of server errors in the web service."
  namespace           = "${var.project}/app"
  metric_name         = "WebErrors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 10
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
}
