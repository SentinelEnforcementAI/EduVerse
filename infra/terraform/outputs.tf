output "alb_dns_name" {
  description = "Public entry point until DNS is set up."
  value       = aws_lb.main.dns_name
}

output "ecr_web_repository_url" {
  value = aws_ecr_repository.web.repository_url
}

output "ecr_worker_repository_url" {
  value = aws_ecr_repository.worker.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "rds_endpoint" {
  description = "Postgres endpoint (private — reachable from the VPC only)."
  value       = aws_db_instance.main.address
}

output "rds_master_secret_arn" {
  description = "AWS-managed secret holding the owner (master) password."
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}

output "redis_endpoint" {
  value = aws_elasticache_cluster.main.cache_nodes[0].address
}

output "private_subnet_ids" {
  description = "For aws ecs run-task network configuration."
  value       = aws_subnet.private[*].id
}

output "worker_security_group_id" {
  description = "For aws ecs run-task network configuration."
  value       = aws_security_group.worker.id
}
