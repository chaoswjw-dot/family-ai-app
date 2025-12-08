#!/bin/bash

# 家庭AI助手部署脚本
# 部署到 192.168.50.3，通过 ai.dgzs.me 访问

set -e

# 配置
ROUTER_IP="192.168.50.3"
SSH_KEY="W:/claude project/08_其他项目/router/claude_ssh_key_192.168.50.3"
REMOTE_DIR="/root/family-ai-app"
LOCAL_DIR="$(dirname "$0")"

echo "=========================================="
echo "  家庭AI助手 - 部署到 ai.dgzs.me"
echo "=========================================="

# 1. 打包项目文件
echo ""
echo "[1/5] 打包项目文件..."
cd "$LOCAL_DIR"
tar --exclude='node_modules' --exclude='.next' --exclude='.git' -czf /tmp/family-ai-app.tar.gz .

# 2. 上传到路由器
echo ""
echo "[2/5] 上传到路由器 $ROUTER_IP..."
scp -i "$SSH_KEY" /tmp/family-ai-app.tar.gz root@$ROUTER_IP:/tmp/

# 3. 在路由器上解压并构建
echo ""
echo "[3/5] 在路由器上部署..."
ssh -i "$SSH_KEY" root@$ROUTER_IP << 'REMOTE_SCRIPT'
set -e

# 创建目录
mkdir -p /root/family-ai-app
cd /root/family-ai-app

# 解压
tar -xzf /tmp/family-ai-app.tar.gz
rm /tmp/family-ai-app.tar.gz

# 停止旧容器（如果存在）
docker stop family-ai-app 2>/dev/null || true
docker rm family-ai-app 2>/dev/null || true

# 构建镜像
echo "构建 Docker 镜像..."
docker build -t family-ai-app:latest .

# 启动容器
echo "启动容器..."
docker run -d \
  --name family-ai-app \
  --restart always \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e ANTHROPIC_API_KEY=cr_651766132209045ddf1320a2bf6d8d945b7c2ceff0e25653a69479b6628d68a2 \
  -e ANTHROPIC_BASE_URL=https://us050zycntbwqsmot.imds.ai/api \
  -e GEMINI_API_KEY=AIzaSyDXOFIgafYUHQVvW2w-_5vzYIm45kb7QZI \
  family-ai-app:latest

echo "容器已启动！"
docker ps | grep family-ai-app
REMOTE_SCRIPT

# 4. 配置 Cloudflare Tunnel
echo ""
echo "[4/5] 配置 Cloudflare Tunnel..."
ssh -i "$SSH_KEY" root@$ROUTER_IP << 'TUNNEL_SCRIPT'
# 检查并更新 cloudflared 配置
CONFIG_FILE="/etc/cloudflared/config.yml"

# 备份原配置
cp $CONFIG_FILE ${CONFIG_FILE}.bak

# 检查是否已有 ai.dgzs.me 配置
if grep -q "ai.dgzs.me" $CONFIG_FILE; then
    echo "ai.dgzs.me 已存在配置中"
else
    echo "添加 ai.dgzs.me 到 Tunnel 配置..."
    # 在 http_status:404 之前插入新规则
    sed -i '/http_status:404/i\  - hostname: ai.dgzs.me\n    service: http://localhost:3000' $CONFIG_FILE
fi

echo ""
echo "当前 Tunnel 配置:"
cat $CONFIG_FILE

# 重启 cloudflared
echo ""
echo "重启 Cloudflare Tunnel..."
/etc/init.d/cloudflared restart

# 等待服务启动
sleep 3
ps | grep cloudflared | grep -v grep
TUNNEL_SCRIPT

# 5. 配置 DNS（需要代理）
echo ""
echo "[5/5] 配置 DNS 记录..."
ssh -i "$SSH_KEY" root@$ROUTER_IP << 'DNS_SCRIPT'
export https_proxy=http://192.168.50.2:7890
export http_proxy=http://192.168.50.2:7890

# 添加 DNS 路由
cloudflared tunnel route dns n8n-tunnel ai.dgzs.me 2>/dev/null || echo "DNS 记录可能已存在"
DNS_SCRIPT

echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo ""
echo "内网访问: http://192.168.50.3:3000"
echo "外网访问: https://ai.dgzs.me"
echo ""
echo "注意: DNS 可能需要几分钟生效"
echo ""

# 清理临时文件
rm -f /tmp/family-ai-app.tar.gz
