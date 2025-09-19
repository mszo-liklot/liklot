#!/bin/bash

# Initial Server Setup Script for Crypto Tracker
# Run as root: sudo bash server-setup.sh

set -e

echo "🔧 Setting up server for Crypto Tracker..."

# Update system
apt update && apt upgrade -y

# Install essential packages
apt install -y \
    curl \
    wget \
    git \
    unzip \
    htop \
    iotop \
    net-tools \
    fail2ban \
    ufw \
    certbot \
    python3-certbot-nginx

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker ubuntu

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Node.js (for development)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3001/tcp  # Grafana (internal monitoring)
ufw --force enable

# Configure fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# Create project directory
mkdir -p /opt/crypto-tracker
mkdir -p /opt/backups/crypto-tracker
chown -R ubuntu:ubuntu /opt/crypto-tracker
chown -R ubuntu:ubuntu /opt/backups

# Create log rotation
cat > /etc/logrotate.d/crypto-tracker << EOF
/opt/crypto-tracker/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

# Setup monitoring
cat > /etc/systemd/system/crypto-monitor.service << EOF
[Unit]
Description=Crypto Tracker Monitoring
After=docker.service

[Service]
Type=oneshot
User=ubuntu
WorkingDirectory=/opt/crypto-tracker
ExecStart=/opt/crypto-tracker/scripts/health-check.sh

[Install]
WantedBy=multi-user.target
EOF

# Create monitoring timer (every 5 minutes)
cat > /etc/systemd/system/crypto-monitor.timer << EOF
[Unit]
Description=Run crypto monitoring every 5 minutes
Requires=crypto-monitor.service

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable crypto-monitor.timer
systemctl start crypto-monitor.timer

# Setup swap (if needed)
if [ ! -f /swapfile ]; then
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Configure system limits
cat >> /etc/security/limits.conf << EOF
ubuntu soft nofile 65536
ubuntu hard nofile 65536
EOF

echo "✅ Server setup completed!"
echo "🔄 Please reboot the server: sudo reboot"
echo "📋 Next steps:"
echo "  1. Clone project: git clone <your-repo> /opt/crypto-tracker"
echo "  2. Setup environment: cp .env.example .env.production"
echo "  3. Run deployment: ./scripts/deploy.sh production"