output "staging_public_ip" {
  description = "Public IP for the staging EC2 instance."
  value       = aws_instance.staging.public_ip
}

output "staging_api_url" {
  description = "API base URL for Expo."
  value       = var.hosted_zone_id == "" ? "http://${aws_instance.staging.public_ip}/api" : "https://${var.staging_domain}/api"
}
