#!/bin/bash

# Crypto Tracker Deployment Script
# Usage: ./scripts/deploy.sh [production|staging]

set -e

ENVIRONMENT=${1:-staging}
PROJECT_DIR="/opt/crypto-tracker"
BACKUP_DIR="/opt/backups/crypto-tracker"

echo "🚀 Starting deployment for $ENVIRONMENT environment..."

# Create backup
echo "📦 Creating backup..."
mkdir -p $BACKUP_DIR
sudo docker-compose -f docker-compose.$ENVIRONMENT.yml down
sudo tar -czf $BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).tar.gz \
    $PROJECT_DIR/postgres_data \
    $PROJECT_DIR/clickhouse_data \
    $PROJECT_DIR/redis_data

# Pull latest code
echo "📥 Pulling latest code..."
cd $PROJECT_DIR
git pull origin main

# Build and start services
echo "🏗️ Building and starting services..."
sudo docker-compose -f docker-compose.$ENVIRONMENT.yml build --no-cache
sudo docker-compose -f docker-compose.$ENVIRONMENT.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Health check
echo "🔍 Running health checks..."
curl -f http://localhost/health || exit 1

# SSL certificate renewal (if production)
if [ "$ENVIRONMENT" == "production" ]; then
    echo "🔒 Checking SSL certificates..."
    sudo certbot renew --quiet
    sudo docker-compose -f docker-compose.production.yml restart nginx
fi

echo "✅ Deployment completed successfully!"
echo "📊 Monitor at: http://localhost:3001 (Grafana)"
echo "🔍 Logs: docker-compose -f docker-compose.$ENVIRONMENT.yml logs -f"