#!/bin/sh
# 家庭AI应用自动部署脚本
# 通过GitHub API检查更新，如有新提交则自动部署

APP_DIR="/mnt/sda4/family-ai-app"
LOG_FILE="/mnt/sda4/family-ai-app/deploy.log"
GITHUB_REPO="chaoswjw-dot/family-ai-app"
LAST_SHA_FILE="/mnt/sda4/family-ai-app/.last_sha"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# 获取GitHub最新commit SHA
get_latest_sha() {
    # 使用代理访问GitHub API
    curl -s --proxy http://192.168.50.2:7890 \
        "https://api.github.com/repos/$GITHUB_REPO/commits/main" \
        | grep -o '"sha": "[^"]*"' | head -1 | cut -d'"' -f4
}

# 获取上次部署的SHA
get_last_sha() {
    if [ -f "$LAST_SHA_FILE" ]; then
        cat "$LAST_SHA_FILE"
    else
        echo ""
    fi
}

# 保存当前SHA
save_sha() {
    echo "$1" > "$LAST_SHA_FILE"
}

# 主逻辑
log "开始检查更新..."

LATEST_SHA=$(get_latest_sha)
LAST_SHA=$(get_last_sha)

if [ -z "$LATEST_SHA" ]; then
    log "无法获取最新SHA，跳过本次检查"
    exit 1
fi

log "最新SHA: $LATEST_SHA"
log "上次SHA: $LAST_SHA"

if [ "$LATEST_SHA" != "$LAST_SHA" ]; then
    log "发现新更新，开始部署..."

    # 下载最新代码
    cd "$APP_DIR"

    # 使用代理下载最新代码压缩包
    curl -sL --proxy http://192.168.50.2:7890 \
        "https://github.com/$GITHUB_REPO/archive/main.tar.gz" \
        -o /tmp/family-ai-app.tar.gz

    if [ $? -eq 0 ]; then
        # 解压并覆盖src目录
        tar -xzf /tmp/family-ai-app.tar.gz -C /tmp/
        cp -r /tmp/family-ai-app-main/src "$APP_DIR/"
        rm -rf /tmp/family-ai-app.tar.gz /tmp/family-ai-app-main

        # 重新构建并启动容器
        export DOCKER_BUILDKIT=0
        docker-compose down
        docker-compose up -d --build

        if [ $? -eq 0 ]; then
            save_sha "$LATEST_SHA"
            log "部署成功！"
        else
            log "部署失败！"
        fi
    else
        log "下载代码失败"
    fi
else
    log "没有新更新"
fi
