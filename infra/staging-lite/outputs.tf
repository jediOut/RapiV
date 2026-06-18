output "staging_public_ip" {
  description = "Public IP for the staging EC2 instance."
  value       = aws_instance.staging.public_ip
}

output "staging_instance_id" {
  description = "EC2 instance ID for AWS Systems Manager Session Manager."
  value       = aws_instance.staging.id
}

output "staging_api_url" {
  description = "API base URL for Expo."
  value       = var.hosted_zone_id == "" ? "http://${aws_instance.staging.public_ip}/api" : "https://${var.staging_domain}/api"
}

output "media_bucket_name" {
  description = "S3 bucket name for staging media uploads."
  value       = aws_s3_bucket.media.bucket
}

output "media_public_base_url" {
  description = "Public base URL for staging media files."
  value       = "https://${aws_s3_bucket.media.bucket}.s3.${var.aws_region}.amazonaws.com"
}

output "deploy_artifacts_bucket_name" {
  description = "S3 bucket for short-lived staging deployment artifacts."
  value       = aws_s3_bucket.deploy_artifacts.bucket
}

output "backend_ecr_repository_url" {
  description = "ECR repository URL for the staging backend image."
  value       = aws_ecr_repository.backend.repository_url
}

output "github_actions_deploy_role_arn" {
  description = "IAM role ARN assumed by GitHub Actions for staging deploys."
  value       = aws_iam_role.github_actions_deploy.arn
}
