# ═══════════════════════════════════════════════
# RKF Infrastructure — Google Cloud Production
# Region: Europe (GDPR requirement)
# ═══════════════════════════════════════════════

terraform {
  required_version = ">= 1.9.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.30"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "gcs" {
    bucket = "rkf-terraform-state"
    prefix = "prod"
  }
}

provider "google" {
  project = var.project_id
  region  = var.gcp_region
  zone    = var.gcp_zone

  default_labels = {
    project     = "rkf"
    environment = var.environment
    managedby   = "terraform"
  }
}

# ─── Variables ──────────────────────────────

variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
}

variable "gcp_region" {
  description = "Google Cloud region."
  type        = string
  default     = "europe-north1"
}

variable "gcp_zone" {
  description = "Google Cloud zone for compute resources."
  type        = string
  default     = "europe-north1-a"
}

variable "environment" {
  description = "Environment name."
  type        = string
  default     = "prod"
}

variable "vpc_cidr_block" {
  description = "Primary CIDR block for the production subnet."
  type        = string
  default     = "10.20.0.0/16"
}

variable "domain_name" {
  description = "Primary production domain for RKF."
  type        = string
}

variable "dns_managed_zone" {
  description = "Cloud DNS managed zone name for RKF domain."
  type        = string
}

variable "db_password" {
  description = "Cloud SQL master password."
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
  network_name = "rkf-${var.environment}-vpc"
  subnet_name  = "rkf-${var.environment}-subnet"
  instance_tag = "rkf-${var.environment}-web"

  db_name     = "rkf"
  db_username = "rkf_admin"

  api_port = 4000
  web_port = 80
}

# ─── Project Services ───────────────────────

resource "google_project_service" "services" {
  for_each = toset([
    "compute.googleapis.com",
    "secretmanager.googleapis.com",
    "dns.googleapis.com",
    "redis.googleapis.com",
    "servicenetworking.googleapis.com",
    "sqladmin.googleapis.com",
  ])

  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

# ─── Network ────────────────────────────────

resource "google_compute_network" "vpc" {
  name                    = local.network_name
  auto_create_subnetworks = false

  depends_on = [google_project_service.services]
}

resource "google_compute_subnetwork" "primary" {
  name                     = local.subnet_name
  ip_cidr_range            = var.vpc_cidr_block
  region                   = var.gcp_region
  network                  = google_compute_network.vpc.id
  private_ip_google_access = true
}

resource "google_compute_router" "nat" {
  name    = "rkf-${var.environment}-router"
  region  = var.gcp_region
  network = google_compute_network.vpc.id
}

resource "google_compute_router_nat" "nat" {
  name                               = "rkf-${var.environment}-nat"
  region                             = var.gcp_region
  router                             = google_compute_router.nat.name
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

resource "google_compute_firewall" "allow_lb_health_checks" {
  name    = "rkf-${var.environment}-allow-lb-health"
  network = google_compute_network.vpc.name

  source_ranges = [
    "35.191.0.0/16",
    "130.211.0.0/22",
  ]

  allow {
    protocol = "tcp"
    ports    = [tostring(local.web_port)]
  }

  target_tags = [local.instance_tag]
}

# ─── Private Service Networking ─────────────

resource "google_compute_global_address" "private_services" {
  name          = "rkf-${var.environment}-private-services"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id

  depends_on = [google_project_service.services]
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services.name]

  depends_on = [google_project_service.services]
}

# ─── Cloud SQL (PostgreSQL) ─────────────────

resource "google_sql_database_instance" "postgres" {
  name             = "rkf-${var.environment}-postgres"
  database_version = "POSTGRES_16"
  region           = var.gcp_region

  settings {
    tier              = "db-custom-2-7680"
    availability_type = "REGIONAL"

    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"
      point_in_time_recovery_enabled = true
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
    }
  }

  deletion_protection = true

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

resource "google_sql_database" "rkf" {
  name     = local.db_name
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "rkf_admin" {
  name     = local.db_username
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}

# ─── Memorystore (Redis) ────────────────────

resource "google_redis_instance" "redis" {
  name               = "rkf-${var.environment}-redis"
  tier               = "STANDARD_HA"
  memory_size_gb     = 1
  region             = var.gcp_region
  authorized_network = google_compute_network.vpc.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"
  redis_version      = "REDIS_7_0"
  auth_enabled       = true

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

# ─── Compute Engine + Managed Instance Group ─

resource "random_id" "deploy_nonce" {
  byte_length = 4
}

resource "google_service_account" "app" {
  account_id   = "rkf-${var.environment}-app"
  display_name = "RKF ${var.environment} app runtime"
}

resource "google_project_iam_member" "app_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_project_iam_member" "app_monitoring" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_project_iam_member" "app_artifact_registry_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_project_iam_member" "app_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "rkf-${var.environment}-db-password"

  replication {
    user_managed {
      replicas {
        location = var.gcp_region
      }
    }
  }
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = var.db_password
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "rkf-${var.environment}-jwt-secret"

  replication {
    user_managed {
      replicas {
        location = var.gcp_region
      }
    }
  }
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = var.jwt_secret
}

resource "google_secret_manager_secret" "redis_auth" {
  secret_id = "rkf-${var.environment}-redis-auth"

  replication {
    user_managed {
      replicas {
        location = var.gcp_region
      }
    }
  }
}

resource "google_secret_manager_secret_version" "redis_auth" {
  secret      = google_secret_manager_secret.redis_auth.id
  secret_data = google_redis_instance.redis.auth_string
}

locals {
  startup_script = <<-EOT
    #!/bin/bash
    set -euo pipefail

    WEB_IMAGE="${var.web_container_image}"
    API_IMAGE="${var.api_container_image}"
    DB_PASSWORD_SECRET="${google_secret_manager_secret.db_password.secret_id}"
    JWT_SECRET_SECRET="${google_secret_manager_secret.jwt_secret.secret_id}"
    REDIS_AUTH_SECRET="${google_secret_manager_secret.redis_auth.secret_id}"

    # Configure Docker auth when Artifact Registry images are used.
    if [[ "$API_IMAGE" == *".pkg.dev/"* || "$WEB_IMAGE" == *".pkg.dev/"* ]]; then
      gcloud auth configure-docker --quiet
    fi

    docker rm -f rkf-web rkf-api || true

    docker pull "$API_IMAGE"
    docker pull "$WEB_IMAGE"

    DB_PASSWORD="$(gcloud secrets versions access latest --secret="$DB_PASSWORD_SECRET")"
    JWT_SECRET="$(gcloud secrets versions access latest --secret="$JWT_SECRET_SECRET")"
    REDIS_AUTH="$(gcloud secrets versions access latest --secret="$REDIS_AUTH_SECRET")"

    DATABASE_URL="postgresql://${google_sql_user.rkf_admin.name}:$DB_PASSWORD@${google_sql_database_instance.postgres.private_ip_address}:5432/${google_sql_database.rkf.name}"
    REDIS_URL="redis://:$REDIS_AUTH@${google_redis_instance.redis.host}:${google_redis_instance.redis.port}"

    docker run -d \
      --name rkf-api \
      --restart always \
      -p ${local.api_port}:${local.api_port} \
      -e NODE_ENV=production \
      -e HOST=0.0.0.0 \
      -e PORT=${local.api_port} \
      -e LOG_LEVEL=info \
      -e DATABASE_URL="$DATABASE_URL" \
      -e REDIS_URL="$REDIS_URL" \
      -e JWT_SECRET="$JWT_SECRET" \
      -e CORS_ORIGIN='${local.app_origin}' \
      "$API_IMAGE"

    until wget -qO- "http://127.0.0.1:${local.api_port}/health" >/dev/null; do
      sleep 2
    done

    docker run -d \
      --name rkf-web \
      --restart always \
      -p ${local.web_port}:${local.web_port} \
      "$WEB_IMAGE"
  EOT
}

resource "google_compute_instance_template" "app" {
  name_prefix    = "rkf-${var.environment}-tpl-"
  machine_type   = "e2-standard-2"
  can_ip_forward = false

  tags = [local.instance_tag]

  disk {
    source_image = "projects/cos-cloud/global/images/family/cos-stable"
    auto_delete  = true
    boot         = true
  }

  network_interface {
    subnetwork = google_compute_subnetwork.primary.id
  }

  metadata = {
    enable-oslogin         = "TRUE"
    block-project-ssh-keys = "TRUE"
  }

  metadata_startup_script = local.startup_script

  service_account {
    email  = google_service_account.app.email
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  depends_on = [
    google_project_iam_member.app_logging,
    google_project_iam_member.app_monitoring,
    google_project_iam_member.app_artifact_registry_reader,
    google_project_iam_member.app_secret_accessor,
    google_secret_manager_secret_version.db_password,
    google_secret_manager_secret_version.jwt_secret,
    google_secret_manager_secret_version.redis_auth,
    google_compute_router_nat.nat,
  ]

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_health_check" "web" {
  name = "rkf-${var.environment}-web-health"

  http_health_check {
    port         = local.web_port
    request_path = "/health"
  }
}

resource "google_compute_region_instance_group_manager" "app" {
  name               = "rkf-${var.environment}-mig"
  base_instance_name = "rkf-${var.environment}-app"
  region             = var.gcp_region

  version {
    instance_template = google_compute_instance_template.app.id
    name              = "v${random_id.deploy_nonce.hex}"
  }

  target_size = 2

  named_port {
    name = "http"
    port = local.web_port
  }

  auto_healing_policies {
    health_check      = google_compute_health_check.web.id
    initial_delay_sec = 180
  }
}

resource "google_compute_region_autoscaler" "app" {
  name   = "rkf-${var.environment}-autoscaler"
  target = google_compute_region_instance_group_manager.app.id
  region = var.gcp_region

  autoscaling_policy {
    min_replicas    = 2
    max_replicas    = 6
    cooldown_period = 90

    cpu_utilization {
      target = 0.65
    }
  }
}

# ─── HTTPS Load Balancer + Managed TLS ──────

resource "google_compute_backend_service" "web" {
  name                  = "rkf-${var.environment}-web-backend"
  protocol              = "HTTP"
  port_name             = "http"
  timeout_sec           = 30
  load_balancing_scheme = "EXTERNAL_MANAGED"
  health_checks         = [google_compute_health_check.web.id]

  backend {
    group           = google_compute_region_instance_group_manager.app.instance_group
    balancing_mode  = "UTILIZATION"
    capacity_scaler = 1.0
  }
}

resource "google_compute_managed_ssl_certificate" "web" {
  name = "rkf-${var.environment}-cert"

  managed {
    domains = [var.domain_name]
  }
}

resource "google_compute_url_map" "https" {
  name            = "rkf-${var.environment}-https-map"
  default_service = google_compute_backend_service.web.id
}

resource "google_compute_target_https_proxy" "web" {
  name             = "rkf-${var.environment}-https-proxy"
  url_map          = google_compute_url_map.https.id
  ssl_certificates = [google_compute_managed_ssl_certificate.web.id]
}

resource "google_compute_global_address" "app" {
  name = "rkf-${var.environment}-lb-ip"
}

resource "google_compute_global_forwarding_rule" "https" {
  name                  = "rkf-${var.environment}-https-fr"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  ip_address            = google_compute_global_address.app.id
  port_range            = "443"
  target                = google_compute_target_https_proxy.web.id
}

resource "google_compute_url_map" "http_redirect" {
  name = "rkf-${var.environment}-http-redirect"

  default_url_redirect {
    https_redirect = true
    strip_query    = false
  }
}

resource "google_compute_target_http_proxy" "redirect" {
  name    = "rkf-${var.environment}-http-proxy"
  url_map = google_compute_url_map.http_redirect.id
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "rkf-${var.environment}-http-fr"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  ip_address            = google_compute_global_address.app.id
  port_range            = "80"
  target                = google_compute_target_http_proxy.redirect.id
}

# ─── DNS ────────────────────────────────────

resource "google_dns_record_set" "app" {
  name         = "${var.domain_name}."
  managed_zone = var.dns_managed_zone
  type         = "A"
  ttl          = 300

  rrdatas = [google_compute_global_address.app.address]
}

# ─── Outputs ───────────────────────────────

output "app_url" {
  description = "Primary application URL."
  value       = "https://${var.domain_name}"
}

output "load_balancer_ip" {
  description = "Global load balancer public IP."
  value       = google_compute_global_address.app.address
}

output "instance_group" {
  description = "Managed instance group name."
  value       = google_compute_region_instance_group_manager.app.name
}

output "sql_instance_connection_name" {
  description = "Cloud SQL connection name."
  value       = google_sql_database_instance.postgres.connection_name
}

output "rds_endpoint" {
  description = "PostgreSQL endpoint (Cloud SQL private IP)."
  value       = google_sql_database_instance.postgres.private_ip_address
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis endpoint."
  value       = google_redis_instance.redis.host
  sensitive   = true
}
