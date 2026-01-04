#!/bin/bash

# ============================================
# 生产环境部署脚本
# 香港 VPS + Cloudflare Pages
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查必要的工具
check_requirements() {
    log_info "检查系统要求..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose 未安装"
        exit 1
    fi
    
    log_info "系统要求检查通过"
}

# 检查环境变量文件
check_env() {
    if [ ! -f ".env.production" ]; then
        log_error "未找到 .env.production 文件"
        log_info "请参考 ENV_TEMPLATE.md 创建配置文件"
        exit 1
    fi
    
    # 检查必要的环境变量
    source .env.production
    
    required_vars=(
        "POSTGRES_USER"
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "JWT_SECRET"
        "JWT_REFRESH_SECRET"
        "CORS_ORIGIN"
        "FRONTEND_URL"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "缺少必要的环境变量: $var"
            exit 1
        fi
    done
    
    log_info "环境变量检查通过"
}

# 拉取最新代码
pull_code() {
    log_info "拉取最新代码..."
    git pull origin main
}

# 构建镜像
build() {
    log_info "构建 Docker 镜像..."
    docker-compose -f docker-compose.prod.yml --env-file .env.production build
}

# 启动服务
start() {
    log_info "启动服务..."
    docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
    
    log_info "等待服务启动..."
    sleep 10
    
    # 检查健康状态
    if curl -sf http://localhost:3001/health > /dev/null; then
        log_info "API 服务启动成功 ✓"
    else
        log_error "API 服务启动失败"
        docker-compose -f docker-compose.prod.yml logs api
        exit 1
    fi
}

# 停止服务
stop() {
    log_info "停止服务..."
    docker-compose -f docker-compose.prod.yml --env-file .env.production down
}

# 重启服务
restart() {
    stop
    start
}

# 查看日志
logs() {
    docker-compose -f docker-compose.prod.yml logs -f "${1:-api}"
}

# 数据库迁移
migrate() {
    log_info "执行数据库迁移..."
    docker-compose -f docker-compose.prod.yml --env-file .env.production exec api npx prisma migrate deploy
}

# 数据库备份
backup() {
    local backup_dir="./backups"
    local backup_file="$backup_dir/db_$(date +%Y%m%d_%H%M%S).sql"
    
    mkdir -p "$backup_dir"
    
    log_info "备份数据库到 $backup_file..."
    
    source .env.production
    docker-compose -f docker-compose.prod.yml exec -T postgres \
        pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$backup_file"
    
    gzip "$backup_file"
    log_info "备份完成: ${backup_file}.gz"
}

# 初始化 SSL 证书
init_ssl() {
    if [ -z "$1" ]; then
        log_error "请提供域名: ./deploy.sh init-ssl api.your-domain.com"
        exit 1
    fi
    
    local domain=$1
    
    log_info "初始化 SSL 证书: $domain"
    
    # 先启动 nginx（仅 HTTP）
    docker-compose -f docker-compose.prod.yml --env-file .env.production up -d nginx
    
    # 获取证书
    docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
        --webroot -w /var/www/certbot \
        -d "$domain" \
        --email "${ADMIN_EMAIL:-admin@example.com}" \
        --agree-tos \
        --no-eff-email
    
    log_info "SSL 证书初始化完成"
    log_warn "请更新 nginx/nginx.prod.conf 中的域名配置"
}

# 状态检查
status() {
    log_info "服务状态:"
    docker-compose -f docker-compose.prod.yml ps
    
    echo ""
    log_info "健康检查:"
    
    if curl -sf http://localhost:3001/health > /dev/null; then
        echo -e "  API: ${GREEN}健康${NC}"
    else
        echo -e "  API: ${RED}异常${NC}"
    fi
    
    if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "  PostgreSQL: ${GREEN}健康${NC}"
    else
        echo -e "  PostgreSQL: ${RED}异常${NC}"
    fi
    
    if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo -e "  Redis: ${GREEN}健康${NC}"
    else
        echo -e "  Redis: ${RED}异常${NC}"
    fi
}

# 清理
clean() {
    log_warn "这将删除所有容器和镜像（数据卷保留）"
    read -p "确认继续? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose -f docker-compose.prod.yml down --rmi local
        log_info "清理完成"
    fi
}

# 完整部署
deploy() {
    check_requirements
    check_env
    pull_code
    build
    
    # 备份数据库（如果已运行）
    if docker-compose -f docker-compose.prod.yml ps postgres | grep -q "Up"; then
        backup
    fi
    
    start
    migrate
    
    log_info "========================================="
    log_info "部署完成!"
    log_info "API: https://api.your-domain.com"
    log_info "健康检查: https://api.your-domain.com/health"
    log_info "========================================="
}

# 帮助信息
help() {
    echo "用法: ./scripts/deploy.sh <命令>"
    echo ""
    echo "命令:"
    echo "  deploy      完整部署（拉取代码、构建、启动）"
    echo "  start       启动服务"
    echo "  stop        停止服务"
    echo "  restart     重启服务"
    echo "  build       构建镜像"
    echo "  logs [服务] 查看日志（默认 api）"
    echo "  status      查看状态"
    echo "  migrate     执行数据库迁移"
    echo "  backup      备份数据库"
    echo "  init-ssl    初始化 SSL 证书"
    echo "  clean       清理容器和镜像"
    echo "  help        显示帮助"
}

# 主入口
case "${1:-help}" in
    deploy)   deploy ;;
    start)    start ;;
    stop)     stop ;;
    restart)  restart ;;
    build)    build ;;
    logs)     logs "$2" ;;
    status)   status ;;
    migrate)  migrate ;;
    backup)   backup ;;
    init-ssl) init_ssl "$2" ;;
    clean)    clean ;;
    help)     help ;;
    *)
        log_error "未知命令: $1"
        help
        exit 1
        ;;
esac

