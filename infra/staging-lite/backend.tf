terraform {
  backend "s3" {
    bucket       = "rapiv-terraform-state-687337999212-us-east-1"
    key          = "staging-lite/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
