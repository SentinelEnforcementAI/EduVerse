variable "project" {
  description = "Resource name prefix."
  type        = string
  default     = "sentinel-watch"
}

variable "app_url" {
  description = "Public base URL of the app (used for magic sign-in links), e.g. https://app.sentinelwatch.co.uk. Until DNS exists, the ALB URL output works."
  type        = string
}

variable "email_from" {
  description = "Verified SES sender identity, e.g. \"Sentinel Watch <signin@sentinelwatch.co.uk>\"."
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate ARN (eu-west-2) for HTTPS on the ALB. Leave empty to serve HTTP only during bootstrap."
  type        = string
  default     = ""
}

variable "web_image_tag" {
  description = "Tag of the web image in ECR to deploy."
  type        = string
  default     = "latest"
}

variable "worker_image_tag" {
  description = "Tag of the worker image in ECR to deploy."
  type        = string
  default     = "latest"
}

variable "db_instance_class" {
  description = "RDS instance class. Design-partner MVP default; revisit before broader rollout."
  type        = string
  default     = "db.t4g.micro"
}

variable "redis_node_type" {
  description = "ElastiCache node type."
  type        = string
  default     = "cache.t4g.micro"
}
