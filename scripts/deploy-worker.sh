#!/bin/bash
set -e

# Build and push
aws ecr get-login-password --region us-east-1 | docker login \
  --username AWS \
  --password-stdin $ECR_REGISTRY

docker build -t $ECR_REGISTRY/hivepay-worker:latest -f Dockerfile.worker .
docker push $ECR_REGISTRY/hivepay-worker:latest

# Deploy
ssh -i $SSH_KEY ec2-user@$EC2_HOST << 'EOF'
  aws ecr get-login-password --region us-east-1 | docker login \
    --username AWS \
    --password-stdin $ECR_REGISTRY
  docker pull $ECR_REGISTRY/hivepay-worker:latest
  docker rm -f hivepay-worker || true
  docker run -d \
    --name hivepay-worker \
    --restart unless-stopped \
    -e REDIS_URL="$REDIS_URL" \
    -e DATABASE_URL="$DATABASE_URL" \
    -e STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
    $ECR_REGISTRY/hivepay-worker:latest
EOF