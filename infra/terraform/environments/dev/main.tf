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

variable "enable_ecs_service" {
  description = "Enable ECS service/task resources for RKF app."
  type        = bool
  default     = false

  validation {
    condition     = !var.enable_ecs_service || var.enable_alb
    error_message = "enable_ecs_service=true currently requires enable_alb=true."
  }
}

variable "enable_alb" {
  description = "Enable ALB + TLS path for ECS service (requires hosted zone + domain)."
  type        = bool
  default     = false
}

variable "domain_name" {
  description = "Primary domain for ACM certificate when ALB is enabled."
  type        = string
  default     = ""

  validation {
    condition     = !var.enable_alb || length(trimspace(var.domain_name)) > 0
    error_message = "domain_name must be set when enable_alb=true."
  }
}

variable "hosted_zone_id" {
  description = "Route53 hosted zone ID for ACM DNS validation when ALB is enabled."
  type        = string
  default     = ""

  validation {
    condition     = !var.enable_alb || length(trimspace(var.hosted_zone_id)) > 0
    error_message = "hosted_zone_id must be set when enable_alb=true."
  }
}

variable "subject_alternative_names" {
  description = "Optional SAN values for ACM certificate."
  type        = list(string)
  default     = []
}

variable "web_container_image" {
  description = "ECS image URI for web container."
  type        = string
  default     = null

  validation {
    condition     = !var.enable_ecs_service || length(trimspace(coalesce(var.web_container_image, ""))) > 0
    error_message = "web_container_image must be set when enable_ecs_service=true."
  }
}

variable "api_container_image" {
  description = "ECS image URI for API container."
  type        = string
  default     = null

  validation {
    condition     = !var.enable_ecs_service || length(trimspace(coalesce(var.api_container_image, ""))) > 0
    error_message = "api_container_image must be set when enable_ecs_service=true."
  }
}

variable "jwt_secret" {
  description = "JWT secret injected into API task definition."
  type        = string
  default     = null
  sensitive   = true

  validation {
    condition     = !var.enable_ecs_service || length(trimspace(coalesce(var.jwt_secret, ""))) > 0
    error_message = "jwt_secret must be set when enable_ecs_service=true."
  }
}

variable "cors_origin" {
  description = "CORS origin used by API service."
  type        = string
  default     = null

  validation {
    condition     = !var.enable_ecs_service || length(trimspace(coalesce(var.cors_origin, ""))) > 0
    error_message = "cors_origin must be set when enable_ecs_service=true."
  }
}

variable "ecs_desired_count" {
  description = "Desired number of running ECS tasks."
  type        = number
  default     = 2

  validation {
    condition     = var.ecs_desired_count > 0
    error_message = "ecs_desired_count must be greater than 0."
  }
}

locals {
  enable_service = var.enable_ecs_service
  enable_alb     = var.enable_alb
  database_url = "postgresql://${module.rds.username}:${var.db_password}@${module.rds.endpoint}:${module.rds.port}/${module.rds.db_name}"
  redis_url    = "redis://${module.redis.endpoint}:${module.redis.port}"
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

module "acm" {
  count  = local.enable_alb ? 1 : 0
  source = "../../modules/acm"

  domain_name               = var.domain_name
  hosted_zone_id            = var.hosted_zone_id
  subject_alternative_names = var.subject_alternative_names
}

module "alb" {
  count  = local.enable_alb ? 1 : 0
  source = "../../modules/alb"

  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  certificate_arn   = module.acm[0].certificate_arn
}

# ─── ECS Cluster ───────────────────────────

module "ecs" {
  source = "../../modules/ecs"

  environment         = var.environment
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.private_subnet_ids
  create_service      = local.enable_service
  desired_count       = var.ecs_desired_count
  alb_security_group_id = local.enable_alb ? module.alb[0].security_group_id : null
  target_group_arn      = local.enable_alb ? module.alb[0].web_target_group_arn : null
  web_container_image   = var.web_container_image
  api_container_image   = var.api_container_image
  database_url          = local.database_url
  redis_url             = local.redis_url
  jwt_secret            = var.jwt_secret
  cors_origin           = var.cors_origin
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

output "ecs_service_name" {
  value = module.ecs.service_name
}

output "alb_dns_name" {
  value = local.enable_alb ? module.alb[0].dns_name : null
}

output "acm_certificate_arn" {
  value = local.enable_alb ? module.acm[0].certificate_arn : null
}
