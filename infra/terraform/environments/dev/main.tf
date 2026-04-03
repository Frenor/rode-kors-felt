# ═══════════════════════════════════════════════
# RKF Infrastructure — AWS Bootstrap
# Region: eu-central-1 (Frankfurt) — GDPR requirement
# ═══════════════════════════════════════════════

terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }

  backend "s3" {
    bucket         = "rkf-terraform-state"
    key            = "dev/terraform.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "rkf-terraform-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "rkf"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ─── Variables ──────────────────────────────

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}

# ─── VPC ────────────────────────────────────

module "vpc" {
  source = "../../modules/vpc"

  environment        = var.environment
  cidr_block         = "10.0.0.0/16"
  single_nat_gateway = true
}

# ─── RDS PostgreSQL ─────────────────────────

module "rds" {
  source = "../../modules/rds"

  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  vpc_cidr_block     = module.vpc.vpc_cidr_block
  private_subnet_ids = module.vpc.private_subnet_ids
  db_password        = var.db_password
  instance_class     = "db.t4g.micro"
  multi_az           = false
}

# ─── ElastiCache Redis ─────────────────────

module "redis" {
  source = "../../modules/redis"

  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  vpc_cidr_block     = module.vpc.vpc_cidr_block
  private_subnet_ids = module.vpc.private_subnet_ids
  node_type          = "cache.t4g.micro"
}

# ─── ECS Cluster ───────────────────────────

module "ecs" {
  source = "../../modules/ecs"

  environment    = var.environment
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids
  create_service = false
}

# ─── Outputs ───────────────────────────────

output "vpc_id" {
  value = module.vpc.vpc_id
}

output "rds_endpoint" {
  value     = module.rds.endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = module.redis.endpoint
  sensitive = true
}

output "ecs_cluster_arn" {
  value = module.ecs.cluster_arn
}
