variable "environment" {
  description = "Environment name."
  type        = string
}

variable "vpc_id" {
  description = "VPC identifier."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet identifiers for the load balancer."
  type        = list(string)
}

variable "certificate_arn" {
  description = "ACM certificate ARN for TLS."
  type        = string
}

variable "health_check_path" {
  description = "Target group health check path."
  type        = string
  default     = "/health"
}

resource "aws_security_group" "this" {
  name        = "rkf-${var.environment}-alb"
  description = "Public HTTPS ingress for RKF."
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "rkf-${var.environment}-alb-sg"
  }
}

resource "aws_lb" "this" {
  name               = "rkf-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.this.id]
  subnets            = var.public_subnet_ids

  tags = {
    Name = "rkf-${var.environment}-alb"
  }
}

resource "aws_lb_target_group" "web" {
  name        = "rkf-${var.environment}-web"
  port        = 80
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    enabled             = true
    path                = var.health_check_path
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
    matcher             = "200"
  }

  tags = {
    Name = "rkf-${var.environment}-web-tg"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

output "alb_arn" {
  description = "ALB ARN."
  value       = aws_lb.this.arn
}

output "dns_name" {
  description = "ALB DNS name."
  value       = aws_lb.this.dns_name
}

output "zone_id" {
  description = "ALB hosted zone id."
  value       = aws_lb.this.zone_id
}

output "security_group_id" {
  description = "Security group attached to the ALB."
  value       = aws_security_group.this.id
}

output "web_target_group_arn" {
  description = "Target group ARN for the web container."
  value       = aws_lb_target_group.web.arn
}
