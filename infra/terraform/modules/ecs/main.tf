variable "environment" {
  description = "Environment name."
  type        = string
}

variable "vpc_id" {
  description = "VPC identifier."
  type        = string
}

variable "subnet_ids" {
  description = "Subnet identifiers for ECS tasks."
  type        = list(string)
}

variable "create_service" {
  description = "Whether to create the full Fargate service."
  type        = bool
  default     = false
}

variable "alb_security_group_id" {
  description = "ALB security group allowed to reach the service."
  type        = string
  default     = null
}

variable "target_group_arn" {
  description = "Target group ARN attached to the ECS service."
  type        = string
  default     = null
}

variable "desired_count" {
  description = "Desired ECS service task count."
  type        = number
  default     = 2
}

variable "cpu" {
  description = "Task CPU units."
  type        = number
  default     = 1024
}

variable "memory" {
  description = "Task memory in MiB."
  type        = number
  default     = 2048
}

variable "web_container_image" {
  description = "Container image for the web application."
  type        = string
  default     = null
}

variable "api_container_image" {
  description = "Container image for the API application."
  type        = string
  default     = null
}

variable "web_container_port" {
  description = "Web container port."
  type        = number
  default     = 80
}

variable "api_container_port" {
  description = "API container port."
  type        = number
  default     = 4000
}

variable "database_url" {
  description = "Database connection string for the API."
  type        = string
  default     = null
  sensitive   = true
}

variable "redis_url" {
  description = "Redis connection string for the API."
  type        = string
  default     = null
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT secret for the API."
  type        = string
  default     = null
  sensitive   = true
}

variable "cors_origin" {
  description = "CORS origin allowed by the API."
  type        = string
  default     = null
}

locals {
  service_name    = "rkf-${var.environment}"
  cluster_name    = "rkf-${var.environment}"
  log_group_name  = "/ecs/rkf-${var.environment}"
  container_defs = var.create_service ? [
    {
      name      = "api"
      image     = var.api_container_image
      essential = true
      portMappings = [
        {
          containerPort = var.api_container_port
          hostPort      = var.api_container_port
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "HOST", value = "0.0.0.0" },
        { name = "PORT", value = tostring(var.api_container_port) },
        { name = "LOG_LEVEL", value = "info" },
        { name = "DATABASE_URL", value = var.database_url },
        { name = "REDIS_URL", value = var.redis_url },
        { name = "JWT_SECRET", value = var.jwt_secret },
        { name = "CORS_ORIGIN", value = var.cors_origin },
      ]
      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://127.0.0.1:${var.api_container_port}/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = local.log_group_name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "api"
        }
      }
    },
    {
      name      = "web"
      image     = var.web_container_image
      essential = true
      dependsOn = [
        {
          containerName = "api"
          condition     = "HEALTHY"
        }
      ]
      portMappings = [
        {
          containerPort = var.web_container_port
          hostPort      = var.web_container_port
          protocol      = "tcp"
        }
      ]
      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://127.0.0.1:${var.web_container_port}/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 15
      }
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = local.log_group_name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "web"
        }
      }
    }
  ] : []
}

data "aws_region" "current" {}

resource "aws_cloudwatch_log_group" "this" {
  count             = var.create_service ? 1 : 0
  name              = local.log_group_name
  retention_in_days = 30
}

resource "aws_ecs_cluster" "this" {
  name = local.cluster_name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

data "aws_iam_policy_document" "ecs_tasks_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "rkf-${var.environment}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task" {
  name               = "rkf-${var.environment}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json
}

resource "aws_security_group" "service" {
  count       = var.create_service ? 1 : 0
  name        = "rkf-${var.environment}-ecs"
  description = "Allows traffic from the ALB to the RKF ECS service."
  vpc_id      = var.vpc_id

  ingress {
    description     = "HTTP from ALB"
    from_port       = var.web_container_port
    to_port         = var.web_container_port
    protocol        = "tcp"
    security_groups = [var.alb_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "rkf-${var.environment}-ecs-sg"
  }
}

resource "aws_ecs_task_definition" "this" {
  count                    = var.create_service ? 1 : 0
  family                   = local.service_name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = tostring(var.cpu)
  memory                   = tostring(var.memory)
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn
  container_definitions    = jsonencode(local.container_defs)
}

resource "aws_ecs_service" "this" {
  count                              = var.create_service ? 1 : 0
  name                               = local.service_name
  cluster                            = aws_ecs_cluster.this.id
  task_definition                    = aws_ecs_task_definition.this[0].arn
  desired_count                      = var.desired_count
  launch_type                        = "FARGATE"
  health_check_grace_period_seconds  = 120
  enable_execute_command             = true
  wait_for_steady_state              = false

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    assign_public_ip = false
    security_groups  = [aws_security_group.service[0].id]
    subnets          = var.subnet_ids
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "web"
    container_port   = var.web_container_port
  }

  depends_on = [
    aws_iam_role_policy_attachment.execution,
    aws_cloudwatch_log_group.this,
  ]
}

output "cluster_arn" {
  description = "ECS cluster ARN."
  value       = aws_ecs_cluster.this.arn
}

output "cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.this.name
}

output "service_arn" {
  description = "ECS service identifier."
  value       = var.create_service ? aws_ecs_service.this[0].id : null
}

output "service_name" {
  description = "ECS service name."
  value       = var.create_service ? aws_ecs_service.this[0].name : null
}

output "service_security_group_id" {
  description = "Security group attached to ECS tasks."
  value       = var.create_service ? aws_security_group.service[0].id : null
}
