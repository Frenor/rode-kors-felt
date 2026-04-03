variable "environment" {
  description = "Environment name."
  type        = string
}

variable "vpc_id" {
  description = "VPC identifier."
  type        = string
}

variable "vpc_cidr_block" {
  description = "CIDR block allowed to access Redis."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet identifiers for the cache subnet group."
  type        = list(string)
}

variable "node_type" {
  description = "ElastiCache node type."
  type        = string
  default     = "cache.t4g.small"
}

resource "aws_elasticache_subnet_group" "this" {
  name       = "rkf-${var.environment}-redis-subnets"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "this" {
  name        = "rkf-${var.environment}-redis"
  description = "Allows Redis traffic from within the VPC."
  vpc_id      = var.vpc_id

  ingress {
    description = "Redis"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "rkf-${var.environment}-redis-sg"
  }
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id       = "rkf-${var.environment}-redis"
  description                = "RKF Redis for ${var.environment}."
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = var.node_type
  port                       = 6379
  parameter_group_name       = "default.redis7"
  subnet_group_name          = aws_elasticache_subnet_group.this.name
  security_group_ids         = [aws_security_group.this.id]
  automatic_failover_enabled = true
  multi_az_enabled           = true
  num_cache_clusters         = 2
  at_rest_encryption_enabled = true
  apply_immediately          = true

  tags = {
    Name = "rkf-${var.environment}-redis"
  }
}

output "endpoint" {
  description = "Primary Redis endpoint."
  value       = aws_elasticache_replication_group.this.primary_endpoint_address
}

output "reader_endpoint" {
  description = "Reader Redis endpoint."
  value       = aws_elasticache_replication_group.this.reader_endpoint_address
}

output "port" {
  description = "Redis port."
  value       = aws_elasticache_replication_group.this.port
}

output "security_group_id" {
  description = "Security group attached to the cache cluster."
  value       = aws_security_group.this.id
}
