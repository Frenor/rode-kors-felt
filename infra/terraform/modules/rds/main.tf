variable "environment" {
  description = "Environment name."
  type        = string
}

variable "vpc_id" {
  description = "VPC identifier."
  type        = string
}

variable "vpc_cidr_block" {
  description = "CIDR block allowed to access the database."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet identifiers for the DB subnet group."
  type        = list(string)
}

variable "db_name" {
  description = "Initial database name."
  type        = string
  default     = "rkf"
}

variable "db_username" {
  description = "Master database username."
  type        = string
  default     = "rkf_admin"
}

variable "db_password" {
  description = "Master database password."
  type        = string
  sensitive   = true
}

variable "instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.small"
}

variable "allocated_storage" {
  description = "Allocated storage in GiB."
  type        = number
  default     = 100
}

variable "max_allocated_storage" {
  description = "Maximum autoscaled storage in GiB."
  type        = number
  default     = 500
}

variable "backup_retention_period" {
  description = "Backup retention period in days."
  type        = number
  default     = 7
}

variable "multi_az" {
  description = "Whether to enable Multi-AZ."
  type        = bool
  default     = true
}

resource "aws_db_subnet_group" "this" {
  name       = "rkf-${var.environment}-db-subnets"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "rkf-${var.environment}-db-subnets"
  }
}

resource "aws_security_group" "this" {
  name        = "rkf-${var.environment}-rds"
  description = "Allows PostgreSQL traffic from within the VPC."
  vpc_id      = var.vpc_id

  ingress {
    description = "PostgreSQL"
    from_port   = 5432
    to_port     = 5432
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
    Name = "rkf-${var.environment}-rds-sg"
  }
}

resource "aws_db_instance" "this" {
  identifier                           = "rkf-${var.environment}-postgres"
  engine                               = "postgres"
  engine_version                       = "16"
  instance_class                       = var.instance_class
  allocated_storage                    = var.allocated_storage
  max_allocated_storage                = var.max_allocated_storage
  storage_type                         = "gp3"
  storage_encrypted                    = true
  db_name                              = var.db_name
  username                             = var.db_username
  password                             = var.db_password
  port                                 = 5432
  multi_az                             = var.multi_az
  publicly_accessible                  = false
  db_subnet_group_name                 = aws_db_subnet_group.this.name
  vpc_security_group_ids               = [aws_security_group.this.id]
  backup_retention_period              = var.backup_retention_period
  backup_window                        = "02:00-03:00"
  maintenance_window                   = "sun:03:00-sun:04:00"
  auto_minor_version_upgrade           = true
  deletion_protection                  = true
  skip_final_snapshot                  = false
  final_snapshot_identifier            = "rkf-${var.environment}-postgres-final"
  copy_tags_to_snapshot                = true
  performance_insights_enabled         = true
  performance_insights_retention_period = 7
  parameter_group_name                 = "default.postgres16"
  enabled_cloudwatch_logs_exports      = ["postgresql", "upgrade"]

  tags = {
    Name = "rkf-${var.environment}-postgres"
  }
}

output "endpoint" {
  description = "PostgreSQL endpoint."
  value       = aws_db_instance.this.address
}

output "port" {
  description = "PostgreSQL port."
  value       = aws_db_instance.this.port
}

output "db_name" {
  description = "Database name."
  value       = aws_db_instance.this.db_name
}

output "username" {
  description = "Master username."
  value       = aws_db_instance.this.username
}

output "security_group_id" {
  description = "Security group attached to the database."
  value       = aws_security_group.this.id
}
