terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }

  # Remote state in S3 (native lockfile). The bootstrap workflow creates
  # the bucket and passes the config at init; for local plans without it,
  # use `terraform init -backend=false`.
  backend "s3" {}
}

# UK data residency is structural: the region is hardcoded, not a variable.
# All data and inference stays in AWS London (eu-west-2).
provider "aws" {
  region = "eu-west-2"

  # Tagged by stack so a per-customer silo (project = sentinel-<slug>) carries
  # its own cost-allocation and inventory tag, not the demo stack's.
  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
    }
  }
}
