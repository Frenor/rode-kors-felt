variable "domain_name" {
  description = "Primary domain name for the certificate."
  type        = string
}

variable "hosted_zone_id" {
  description = "Route53 hosted zone identifier used for DNS validation."
  type        = string
}

variable "subject_alternative_names" {
  description = "Additional names for the certificate."
  type        = list(string)
  default     = []
}

resource "aws_acm_certificate" "this" {
  domain_name               = var.domain_name
  subject_alternative_names = var.subject_alternative_names
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "validation" {
  for_each = {
    for dvo in aws_acm_certificate.this.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id         = var.hosted_zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "this" {
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [for record in aws_route53_record.validation : record.fqdn]
}

output "certificate_arn" {
  description = "Validated ACM certificate ARN."
  value       = aws_acm_certificate_validation.this.certificate_arn
}
