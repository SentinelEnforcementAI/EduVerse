terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }

  # CTO-DECISION: remote state (S3 + DynamoDB lock) once the AWS account
  # exists. Local state is acceptable only for the very first bootstrap.
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
