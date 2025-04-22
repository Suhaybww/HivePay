output "ec2_public_ip" {
  value = aws_instance.worker.public_ip
}

output "ecr_repository_url" {
  value = aws_ecr_repository.worker.repository_url
}