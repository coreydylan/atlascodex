terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "atlas-codex-terraform-state"
    key    = "atlas-codex/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "atlas-codex"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Variables
variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
  default     = "790856971687"
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# DynamoDB Tables
resource "aws_dynamodb_table" "jobs" {
  name           = "atlas-codex-jobs-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  
  attribute {
    name = "id"
    type = "S"
  }
  
  attribute {
    name = "userId"
    type = "S"
  }
  
  attribute {
    name = "createdAt"
    type = "N"
  }
  
  global_secondary_index {
    name     = "UserIndex"
    hash_key = "userId"
    range_key = "createdAt"
  }
  
  tags = {
    Name = "atlas-codex-jobs-${var.environment}"
  }
}

resource "aws_dynamodb_table" "dips" {
  name           = "atlas-codex-dips-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "domain"
  
  attribute {
    name = "domain"
    type = "S"
  }
  
  tags = {
    Name = "atlas-codex-dips-${var.environment}"
  }
}

resource "aws_dynamodb_table" "evidence" {
  name           = "atlas-codex-evidence-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "hash"
  
  attribute {
    name = "hash"
    type = "S"
  }
  
  attribute {
    name = "timestamp"
    type = "S"
  }
  
  global_secondary_index {
    name     = "TimestampIndex"
    hash_key = "timestamp"
  }
  
  tags = {
    Name = "atlas-codex-evidence-${var.environment}"
  }
}

# S3 Buckets
resource "aws_s3_bucket" "artifacts" {
  bucket = "atlas-codex-artifacts-${var.environment}"
  
  tags = {
    Name = "atlas-codex-artifacts-${var.environment}"
  }
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket" "evidence" {
  bucket = "atlas-codex-evidence-${var.environment}"
  
  tags = {
    Name = "atlas-codex-evidence-${var.environment}"
  }
}

resource "aws_s3_bucket_versioning" "evidence" {
  bucket = aws_s3_bucket.evidence.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# SQS Queue
resource "aws_sqs_queue" "jobs" {
  name                      = "atlas-codex-jobs-${var.environment}"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 1209600
  receive_wait_time_seconds = 10
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.jobs_dlq.arn
    maxReceiveCount     = 3
  })
  
  tags = {
    Name = "atlas-codex-jobs-${var.environment}"
  }
}

resource "aws_sqs_queue" "jobs_dlq" {
  name = "atlas-codex-jobs-dlq-${var.environment}"
  
  tags = {
    Name = "atlas-codex-jobs-dlq-${var.environment}"
  }
}

# ECR Repository
resource "aws_ecr_repository" "worker" {
  name                 = "atlas-codex-worker"
  image_tag_mutability = "MUTABLE"
  
  image_scanning_configuration {
    scan_on_push = true
  }
  
  tags = {
    Name = "atlas-codex-worker"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "atlas-codex-${var.environment}"
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  
  tags = {
    Name = "atlas-codex-${var.environment}"
  }
}

# VPC and Networking (simplified)
resource "aws_default_vpc" "default" {
  tags = {
    Name = "Default VPC"
  }
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [aws_default_vpc.default.id]
  }
}

# Security Group for ECS
resource "aws_security_group" "ecs" {
  name_prefix = "atlas-codex-ecs-${var.environment}"
  vpc_id      = aws_default_vpc.default.id
  
  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "atlas-codex-ecs-${var.environment}"
  }
}

# Outputs
output "dynamodb_jobs_table" {
  value = aws_dynamodb_table.jobs.name
}

output "dynamodb_dips_table" {
  value = aws_dynamodb_table.dips.name
}

output "dynamodb_evidence_table" {
  value = aws_dynamodb_table.evidence.name
}

output "s3_artifacts_bucket" {
  value = aws_s3_bucket.artifacts.bucket
}

output "s3_evidence_bucket" {
  value = aws_s3_bucket.evidence.bucket
}

output "sqs_queue_url" {
  value = aws_sqs_queue.jobs.url
}

output "ecr_repository_url" {
  value = aws_ecr_repository.worker.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}