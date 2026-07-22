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

  default_tags {
    tags = {
      Project   = "sentinel-watch"
      ManagedBy = "terraform"
    }
  }
}
