variable "aws_region" {
  description = "AWS region for the staging-lite server."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name used for AWS resource tags."
  type        = string
  default     = "rapiv"
}

variable "instance_type" {
  description = "Small EC2 instance type for staging."
  type        = string
  default     = "t3.micro"
}

variable "key_name" {
  description = "Existing EC2 key pair name used for SSH deploys."
  type        = string
}

variable "allowed_ssh_cidr" {
  description = "CIDR allowed to SSH into the staging server. Use your public IP with /32."
  type        = string
}

variable "root_volume_size_gb" {
  description = "Root EBS volume size."
  type        = number
  default     = 20
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID. Leave empty to create DNS manually."
  type        = string
  default     = ""
}

variable "staging_domain" {
  description = "API staging domain, for example staging-api.rapiv.com."
  type        = string
}

variable "media_bucket_name" {
  description = "S3 bucket for staging media uploads. Leave empty to generate a unique account-scoped name."
  type        = string
  default     = ""
}

variable "deploy_artifacts_bucket_name" {
  description = "Private S3 bucket for GitHub Actions staging deployment artifacts. Leave empty to generate a unique account-scoped name."
  type        = string
  default     = ""
}

variable "github_owner" {
  description = "GitHub owner allowed to assume the staging deploy role."
  type        = string
  default     = "jediOut"
}

variable "github_repo" {
  description = "GitHub repository allowed to assume the staging deploy role."
  type        = string
  default     = "RapiV"
}

variable "github_branch" {
  description = "GitHub branch allowed to assume the staging deploy role."
  type        = string
  default     = "main"
}
