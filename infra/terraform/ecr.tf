resource "aws_ecr_repository" "web" {
  name                 = "${var.project}/web"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "worker" {
  name                 = "${var.project}/worker"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# Keep the last 20 images per repo.
resource "aws_ecr_lifecycle_policy" "cleanup" {
  for_each   = { web = aws_ecr_repository.web.name, worker = aws_ecr_repository.worker.name }
  repository = each.value

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "expire untagged and old images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 20
      }
      action = { type = "expire" }
    }]
  })
}
