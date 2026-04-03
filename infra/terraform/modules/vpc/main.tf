data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  availability_zones = slice(
    data.aws_availability_zones.available.names,
    0,
    min(length(data.aws_availability_zones.available.names), var.availability_zone_count),
  )

  public_subnet_cidrs = [
    for index, _az in local.availability_zones : cidrsubnet(var.cidr_block, 8, index)
  ]

  private_subnet_cidrs = [
    for index, _az in local.availability_zones : cidrsubnet(var.cidr_block, 8, index + 10)
  ]

  nat_gateway_count = var.single_nat_gateway ? 1 : length(local.availability_zones)
}

variable "environment" {
  description = "Environment name."
  type        = string
}

variable "cidr_block" {
  description = "Primary CIDR block for the VPC."
  type        = string
}

variable "availability_zone_count" {
  description = "Number of availability zones to use."
  type        = number
  default     = 3
}

variable "single_nat_gateway" {
  description = "Whether to create a single shared NAT gateway."
  type        = bool
  default     = false
}

resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "rkf-${var.environment}-vpc"
  }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name = "rkf-${var.environment}-igw"
  }
}

resource "aws_subnet" "public" {
  for_each = {
    for index, az in local.availability_zones : az => {
      cidr_block = local.public_subnet_cidrs[index]
    }
  }

  vpc_id                  = aws_vpc.this.id
  availability_zone       = each.key
  cidr_block              = each.value.cidr_block
  map_public_ip_on_launch = true

  tags = {
    Name = "rkf-${var.environment}-public-${each.key}"
    Tier = "public"
  }
}

resource "aws_subnet" "private" {
  for_each = {
    for index, az in local.availability_zones : az => {
      cidr_block = local.private_subnet_cidrs[index]
    }
  }

  vpc_id            = aws_vpc.this.id
  availability_zone = each.key
  cidr_block        = each.value.cidr_block

  tags = {
    Name = "rkf-${var.environment}-private-${each.key}"
    Tier = "private"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = {
    Name = "rkf-${var.environment}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_eip" "nat" {
  count  = local.nat_gateway_count
  domain = "vpc"

  tags = {
    Name = "rkf-${var.environment}-nat-eip-${count.index + 1}"
  }
}

resource "aws_nat_gateway" "this" {
  count = local.nat_gateway_count

  allocation_id = aws_eip.nat[count.index].id
  subnet_id = values(aws_subnet.public)[
    var.single_nat_gateway ? 0 : count.index
  ].id

  depends_on = [aws_internet_gateway.this]

  tags = {
    Name = "rkf-${var.environment}-nat-${count.index + 1}"
  }
}

resource "aws_route_table" "private" {
  count  = length(local.availability_zones)
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this[
      var.single_nat_gateway ? 0 : count.index
    ].id
  }

  tags = {
    Name = "rkf-${var.environment}-private-rt-${count.index + 1}"
  }
}

resource "aws_route_table_association" "private" {
  for_each = {
    for index, az in local.availability_zones : az => {
      subnet_id       = aws_subnet.private[az].id
      route_table_id  = aws_route_table.private[index].id
    }
  }

  subnet_id      = each.value.subnet_id
  route_table_id = each.value.route_table_id
}

output "vpc_id" {
  description = "VPC identifier."
  value       = aws_vpc.this.id
}

output "vpc_cidr_block" {
  description = "VPC CIDR block."
  value       = aws_vpc.this.cidr_block
}

output "availability_zones" {
  description = "Availability zones used by the VPC."
  value       = local.availability_zones
}

output "public_subnet_ids" {
  description = "Public subnet identifiers."
  value       = [for subnet in values(aws_subnet.public) : subnet.id]
}

output "private_subnet_ids" {
  description = "Private subnet identifiers."
  value       = [for subnet in values(aws_subnet.private) : subnet.id]
}
