# Dev Terraform Toggles

This environment keeps safe defaults: data stores and ECS cluster are created, but ECS service + ALB/ACM are opt-in.

## Default Behavior

- `enable_ecs_service=false`
- `enable_alb=false`

This prevents accidental creation of internet-facing resources during regular dev applies.

## Enable Full Service Path

When you want the full API+web service path, set all required values:

```hcl
enable_alb          = true
enable_ecs_service  = true
domain_name         = "dev.example.org"
hosted_zone_id      = "Z1234567890"
web_container_image = "123456789012.dkr.ecr.eu-central-1.amazonaws.com/rkf-web:latest"
api_container_image = "123456789012.dkr.ecr.eu-central-1.amazonaws.com/rkf-api:latest"
jwt_secret          = "replace-me"
cors_origin         = "https://dev.example.org"
```

## Validation Notes

- `enable_ecs_service=true` requires `enable_alb=true`
- `domain_name` + `hosted_zone_id` are required when ALB is enabled
- container image URIs + `jwt_secret` + `cors_origin` are required when ECS service is enabled
