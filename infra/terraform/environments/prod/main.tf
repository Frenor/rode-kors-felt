# ═══════════════════════════════════════════════
# RKF Infrastructure — AWS Production
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
    key            = "prod/terraform.tfstate"
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

variable "aws_region" {
  description = "AWS region."
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "Environment name."
  type        = string
  default     = "prod"
}

variable "vpc_cidr_block" {
  description = "Primary CIDR block for the production VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "domain_name" {
  description = "Primary production domain for RKF."
  type        = string
}

variable "hosted_zone_id" {
  description = "Route53 hosted zone identifier for the RKF domain."
  type        = string
}

variable "db_password" {
  description = "RDS master password."
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret for the API."
  type        = string
  sensitive   = true
}

variable "web_container_image" {
  description = "Container image URI for the web service."
  type        = string
}

variable "api_container_image" {
  description = "Container image URI for the API service."
  type        = string
}

variable "cors_origin" {
  description = "Browser origin allowed by the API."
  type        = string
  default     = null
}

locals {
  app_origin   = coalesce(var.cors_origin, "https://${var.domain_name}")
  database_url = "postgresql://${module.rds.username}:${var.db_password}@${module.rds.endpoint}:${module.rds.port}/${module.rds.db_name}"
  redis_url    = "redis://${module.redis.endpoint}:${module.redis.port}"
}

module "vpc" {
  source = "../../modules/vpc"

  environment             = var.environment
  cidr_block              = var.vpc_cidr_block
  availability_zone_count = 3
  single_nat_gateway      = false
}

module "rds" {
  source = "../../modules/rds"

  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  vpc_cidr_block     = module.vpc.vpc_cidr_block
  private_subnet_ids = module.vpc.private_subnet_ids
  db_password        = var.db_password
  instance_class     = "db.t4g.medium"
  multi_az           = true
}

module "redis" {
  source = "../../modules/redis"

  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  vpc_cidr_block     = module.vpc.vpc_cidr_block
  private_subnet_ids = module.vpc.private_subnet_ids
  node_type          = "cache.t4g.small"
}

module "acm" {
  source = "../../modules/acm"

  domain_name               = var.domain_name
  hosted_zone_id            = var.hosted_zone_id
  subject_alternative_names = ["*.${var.domain_name}"]
}

module "alb" {
  source = "../../modules/alb"

  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  certificate_arn   = module.acm.certificate_arn
}

module "ecs" {
  source = "../../modules/ecs"

  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  subnet_ids            = module.vpc.private_subnet_ids
  create_service        = true
  alb_security_group_id = module.alb.security_group_id
  target_group_arn      = module.alb.web_target_group_arn
  web_container_image   = var.web_container_image
  api_container_image   = var.api_container_image
  desired_count         = 2
  cpu                   = 1024
  memory                = 2048
  database_url          = local.database_url
  redis_url             = local.redis_url
  jwt_secret            = var.jwt_secret
  cors_origin           = local.app_origin
}

resource "aws_route53_record" "app" {
  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = module.alb.dns_name
    zone_id                = module.alb.zone_id
    evaluate_target_health = true
  }
}

output "app_url" {
  description = "Primary application URL."
  value       = "https://${var.domain_name}"
}

output "alb_dns_name" {
  description = "ALB DNS name."
  value       = module.alb.dns_name
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN."
  value       = module.ecs.cluster_arn
}

output "ecs_service_arn" {
  description = "ECS service identifier."
  value       = module.ecs.service_arn
}

output "ecs_service_name" {
  description = "ECS service name."
  value       = module.ecs.service_name
}

output "rds_endpoint" {
  description = "PostgreSQL endpoint."
  value       = module.rds.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis endpoint."
  value       = module.redis.endpoint
  sensitive   = true
}
