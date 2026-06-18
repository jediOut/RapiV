terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_security_group" "staging" {
  name        = "${var.project_name}-staging-lite"
  description = "RapiV staging-lite EC2 access"

  ingress {
    description = "HTTP for ACME challenge and staging API"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS API"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Outbound internet"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

resource "aws_iam_role" "ssm" {
  name = "${var.project_name}-staging-lite-ssm"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "ssm_managed_instance_core" {
  role       = aws_iam_role.ssm.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "media_bucket_access" {
  name = "${var.project_name}-staging-lite-media"
  role = aws_iam_role.ssm.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.media.arn}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "deploy_bucket_read" {
  name = "${var.project_name}-staging-lite-deploy-read"
  role = aws_iam_role.ssm.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.deploy_artifacts.arn}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "ecr_pull" {
  name = "${var.project_name}-staging-lite-ecr-pull"
  role = aws_iam_role.ssm.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EcrAuth"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Sid    = "PullBackendImage"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ]
        Resource = aws_ecr_repository.backend.arn
      }
    ]
  })
}

resource "aws_iam_instance_profile" "ssm" {
  name = "${var.project_name}-staging-lite-ssm"
  role = aws_iam_role.ssm.name

  tags = local.tags
}

resource "aws_iam_role" "github_actions_deploy" {
  name = "${var.project_name}-staging-lite-github-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRoleWithWebIdentity"
        Effect = "Allow"
        Principal = {
          Federated = local.github_oidc_provider_arn
        }
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:ref:refs/heads/${var.github_deploy_branch}"
          }
        }
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name = "${var.project_name}-staging-lite-github-deploy"
  role = aws_iam_role.github_actions_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DeployArtifactAccess"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.deploy_artifacts.arn}/releases/*"
      },
      {
        Sid    = "EcrAuth"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Sid    = "DescribeBackendRepository"
        Effect = "Allow"
        Action = [
          "ecr:DescribeRepositories"
        ]
        Resource = "*"
      },
      {
        Sid    = "PushBackendImage"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeImages",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart"
        ]
        Resource = aws_ecr_repository.backend.arn
      },
      {
        Sid    = "SendSsmDeployCommand"
        Effect = "Allow"
        Action = [
          "ssm:SendCommand"
        ]
        Resource = [
          "arn:aws:ssm:${var.aws_region}::document/AWS-RunShellScript",
          aws_instance.staging.arn
        ]
      },
      {
        Sid    = "ReadSsmDeployCommandResult"
        Effect = "Allow"
        Action = [
          "ssm:GetCommandInvocation",
          "ssm:ListCommandInvocations"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_s3_bucket" "deploy_artifacts" {
  bucket = local.deploy_artifacts_bucket_name

  tags = merge(local.tags, {
    Name = local.deploy_artifacts_bucket_name
  })
}

resource "aws_s3_bucket_public_access_block" "deploy_artifacts" {
  bucket = aws_s3_bucket.deploy_artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "deploy_artifacts" {
  bucket = aws_s3_bucket.deploy_artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "deploy_artifacts" {
  bucket = aws_s3_bucket.deploy_artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "deploy_artifacts" {
  bucket = aws_s3_bucket.deploy_artifacts.id

  rule {
    id     = "expire-deploy-artifacts"
    status = "Enabled"

    filter {
      prefix = "releases/"
    }

    expiration {
      days = 7
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}

resource "aws_s3_bucket" "media" {
  bucket = local.media_bucket_name

  tags = merge(local.tags, {
    Name = local.media_bucket_name
  })
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = false
  ignore_public_acls      = true
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "media_public_read" {
  bucket = aws_s3_bucket.media.id

  depends_on = [
    aws_s3_bucket_public_access_block.media
  ]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadMedia"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.media.arn}/*"
      }
    ]
  })
}

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "HEAD"]
    allowed_origins = ["*"]
    max_age_seconds = 3000
  }
}

resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-backend-staging"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(local.tags, {
    Name = "${var.project_name}-backend-staging"
  })
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep the latest 30 staging backend images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 30
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

resource "aws_instance" "staging" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  iam_instance_profile        = aws_iam_instance_profile.ssm.name
  key_name                    = var.key_name
  vpc_security_group_ids      = [aws_security_group.staging.id]
  associate_public_ip_address = true

  root_block_device {
    volume_size = var.root_volume_size_gb
    volume_type = "gp3"
    encrypted   = true
  }

  lifecycle {
    ignore_changes = [
      ami
    ]
  }

  user_data = <<-USER_DATA
    #!/usr/bin/env bash
    set -euo pipefail

    apt-get update
    apt-get install -y ca-certificates curl git
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" > /etc/apt/sources.list.d/docker.list
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    usermod -aG docker ubuntu
    mkdir -p /opt/rapiv
    chown ubuntu:ubuntu /opt/rapiv
  USER_DATA

  tags = merge(local.tags, {
    Name = "${var.project_name}-staging-lite"
  })
}

resource "aws_route53_record" "api" {
  count   = var.hosted_zone_id == "" ? 0 : 1
  zone_id = var.hosted_zone_id
  name    = var.staging_domain
  type    = "A"
  ttl     = 60
  records = [aws_instance.staging.public_ip]
}

locals {
  media_bucket_name            = var.media_bucket_name != "" ? var.media_bucket_name : "${var.project_name}-media-staging-${data.aws_caller_identity.current.account_id}"
  deploy_artifacts_bucket_name = var.deploy_artifacts_bucket_name != "" ? var.deploy_artifacts_bucket_name : "${var.project_name}-deploy-staging-${data.aws_caller_identity.current.account_id}"
  github_oidc_provider_arn     = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"

  tags = {
    Project     = var.project_name
    Environment = "staging"
    ManagedBy   = "terraform"
  }
}
