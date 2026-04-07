# ═══════════════════════════════════════════════
# RKF Infrastructure — Google Cloud Production
# Deployment model: Cloud Run (single public URL)
#
# - web (nginx) is the ingress container on port 8080
# - api is a sidecar container on port 4000
# - Cloud SQL + Memorystore use private IPs; Cloud Run reaches them via VPC Access connector
# ═══════════════════════════════════════════════

terraform {
  required_version = ">= 1.9.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.30"
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

variable "run_connector_cidr" {
  description = "CIDR range reserved for the Serverless VPC Access connector."
  type        = string
  default     = "10.20.250.0/28"
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
  description = "Container image URI for the web (nginx) container."
  type        = string
}

variable "api_container_image" {
  description = "Container image URI for the API container."
  type        = string
}

variable "cors_origin" {
  description = "Optional explicit CORS origin for the API (comma-separated)."
  type        = string
  default     = null
}

variable "min_instances" {
  description = "Minimum Cloud Run instances (0 is cheapest; >0 reduces cold starts)."
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum Cloud Run instances."
  type        = number
  default     = 3
}

locals {
  network_name = "rkf-${var.environment}-vpc"
  subnet_name  = "rkf-${var.environment}-subnet"

  db_name     = "rkf"
  db_username = "rkf_admin"

  api_port = 4000
  web_port = 8080
}

# ─── Project Services ───────────────────────

resource "google_project_service" "services" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "compute.googleapis.com",
    "redis.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "servicenetworking.googleapis.com",
    "sqladmin.googleapis.com",
    "vpcaccess.googleapis.com",
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
    # Downscaled default: single-zone + smaller tier (cheaper than HA/regional).
    tier              = "db-custom-1-3840"
    availability_type = "ZONAL"

    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"
      point_in_time_recovery_enabled = true
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
      ssl_mode        = "TRUSTED_CLIENT_CERTIFICATE_REQUIRED"
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
  # Downscaled default: non-HA tier.
  tier               = "BASIC"
  memory_size_gb     = 1
  region             = var.gcp_region
  authorized_network = google_compute_network.vpc.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"
  redis_version      = "REDIS_7_0"
  auth_enabled       = true

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

# ─── Service Account + IAM ──────────────────

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

# ─── Secrets ────────────────────────────────

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

# ─── Serverless VPC Access (for private IP DB/Redis) ───────────────

resource "google_vpc_access_connector" "run" {
  name          = "rkf-${var.environment}-run-conn"
  region        = var.gcp_region
  network       = google_compute_network.vpc.name
  ip_cidr_range = var.run_connector_cidr

  depends_on = [google_project_service.services]
}

# ─── Cloud Run (multi-container, single public URL) ────────────────

resource "google_cloud_run_v2_service" "app" {
  name     = "rkf-${var.environment}"
  location = var.gcp_region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.app.email

    vpc_access {
      connector = google_vpc_access_connector.run.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    # Ingress container
    containers {
      name  = "web"
      image = var.web_container_image

      ports {
        container_port = local.web_port
      }
    }

    # Sidecar API container (reachable via localhost from nginx)
    containers {
      name  = "api"
      image = var.api_container_image

      ports {
        container_port = local.api_port
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "HOST"
        value = "0.0.0.0"
      }

      env {
        name  = "PORT"
        value = tostring(local.api_port)
      }

      env {
        name  = "LOG_LEVEL"
        value = "info"
      }

      env {
        name  = "DATABASE_URL"
        value = "postgresql://${google_sql_user.rkf_admin.name}:${var.db_password}@${google_sql_database_instance.postgres.private_ip_address}:5432/${google_sql_database.rkf.name}"
      }

      env {
        name  = "REDIS_URL"
        value = "redis://:${google_redis_instance.redis.auth_string}@${google_redis_instance.redis.host}:${google_redis_instance.redis.port}"
      }

      env {
        name  = "JWT_SECRET"
        value = var.jwt_secret
      }

      dynamic "env" {
        for_each = var.cors_origin == null ? [] : [var.cors_origin]
        content {
          name  = "CORS_ORIGIN"
          value = env.value
        }
      }
    }
  }

  depends_on = [
    google_project_iam_member.app_logging,
    google_project_iam_member.app_monitoring,
    google_project_iam_member.app_artifact_registry_reader,
    google_project_iam_member.app_secret_accessor,
    google_secret_manager_secret_version.db_password,
    google_secret_manager_secret_version.jwt_secret,
    google_secret_manager_secret_version.redis_auth,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  project  = var.project_id
  location = var.gcp_region
  name     = google_cloud_run_v2_service.app.name

  role   = "roles/run.invoker"
  member = "allUsers"
}

# ─── Outputs ───────────────────────────────

output "service_url" {
  description = "Public Cloud Run URL (built-in GCP domain)."
  value       = google_cloud_run_v2_service.app.uri
}

output "sql_instance_connection_name" {
  description = "Cloud SQL connection name."
  value       = google_sql_database_instance.postgres.connection_name
}

output "postgres_private_ip" {
  description = "PostgreSQL private IP."
  value       = google_sql_database_instance.postgres.private_ip_address
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis endpoint."
  value       = google_redis_instance.redis.host
  sensitive   = true
}
