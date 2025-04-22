terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# Generate private key
resource "tls_private_key" "worker" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

# Create AWS key pair
resource "aws_key_pair" "worker_key" {
  key_name   = "hivepay-worker-key"
  public_key = tls_private_key.worker.public_key_openssh
}

# Output the private key for saving
output "private_key" {
  value     = tls_private_key.worker.private_key_pem
  sensitive = true
}

resource "aws_security_group" "worker_sg" {
  name        = "hivepay-worker-sg"
  description = "Security group for queue worker"

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "hivepay-worker-sg"
  }
}

resource "aws_iam_role" "ec2_role" {
  name = "hivepay-worker-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_instance_profile" "worker_profile" {
  name = "hivepay-worker-instance-profile"
  role = aws_iam_role.ec2_role.name
}

resource "aws_iam_role_policy_attachment" "ecr_access" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy" "secrets_access" {
  name = "hivepay-secrets-access"
  role = aws_iam_role.ec2_role.name

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Action = [
        "ssm:GetParameter",
        "secretsmanager:GetSecretValue"
      ],
      Resource = "*"
    }]
  })
}

resource "aws_instance" "worker" {
  ami                    = "ami-0c518311db5640eff" # Verified ARM64 AMI (Amazon Linux 2023)
  instance_type          = "t4g.micro"             # ARM-based instance
  key_name               = aws_key_pair.worker_key.key_name
  vpc_security_group_ids = [aws_security_group.worker_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.worker_profile.name

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  user_data = <<-EOF
              #!/bin/bash
              sudo yum update -y
              sudo yum install docker -y
              sudo systemctl start docker
              sudo usermod -aG docker ec2-user
              
              aws ecr get-login-password --region us-east-1 | docker login \
                --username AWS \
                --password-stdin ${aws_ecr_repository.worker.repository_url}
              
              docker pull ${aws_ecr_repository.worker.repository_url}:latest
              
              docker run -d \
                --restart unless-stopped \
                --name hivepay-worker \
                --health-cmd="curl -f http://localhost:3000/health || exit 1" \
                --health-interval=30s \
                -e REDIS_URL="${var.redis_url}" \
                -e DATABASE_URL="${var.database_url}" \
                -e STRIPE_SECRET_KEY="$(aws ssm get-parameter --name /hivepay/stripe-key --with-decryption --query Parameter.Value --output text)" \
                ${aws_ecr_repository.worker.repository_url}:latest
              EOF

  tags = {
    Name = "hivepay-queue-worker"
  }
}

resource "aws_ecr_repository" "worker" {
  name         = "hivepay-worker"
  force_delete = true # Critical addition for cleanup
}

resource "aws_cloudwatch_dashboard" "worker" {
  dashboard_name = "hivepay-worker"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/EC2", "CPUUtilization", "InstanceId", aws_instance.worker.id]
          ],
          period = 300
          stat   = "Average"
          region = "us-east-1"
        }
      }
    ]
  })
}