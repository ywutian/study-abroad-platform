#!/bin/bash

# ============================================
# Lumni - 一键部署脚本
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查必要工具
check_requirements() {
    log_info "检查依赖工具..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose 未安装"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

# 检查环境变量
check_env() {
    log_info "检查环境变量..."
    
    if [ ! -f ".env" ]; then
        log_warning ".env 文件不存在，从模板创建..."
        cp .env.example .env
        log_warning "请编辑 .env 文件填写必要配置后重新运行"
        exit 1
    fi
    
    # 检查必要变量
    source .env
    
    if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" == "your_jwt_secret_here_at_least_32_chars" ]; then
        log_error "请在 .env 中设置 JWT_SECRET"
        exit 1
    fi
    
    if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" == "your_secure_password_here" ]; then
        log_error "请在 .env 中设置 DB_PASSWORD"
        exit 1
    fi
    
    log_success "环境变量检查通过"
}

# 构建镜像
build() {
    log_info "构建 Docker 镜像..."
    docker compose build
    log_success "镜像构建完成"
}

# 启动服务
start() {
    log_info "启动服务..."
    docker compose up -d
    
    log_info "等待数据库启动..."
    sleep 5
    
    log_info "运行数据库迁移..."
    docker compose exec api npx prisma migrate deploy
    
    log_success "服务启动完成！"
    echo ""
    echo "========================================"
    echo "  🎉 部署成功！"
    echo "========================================"
    echo ""
    echo "  前端地址: http://localhost:${WEB_PORT:-3000}"
    echo "  API 地址: http://localhost:${API_PORT:-3001}"
    echo "  API 文档: http://localhost:${API_PORT:-3001}/api/docs"
    echo ""
    echo "  管理员账号: admin@test.com"
    echo "  管理员密码: Admin123!"
    echo ""
    echo "========================================"
}

# 停止服务
stop() {
    log_info "停止服务..."
    docker compose down
    log_success "服务已停止"
}

# 查看日志
logs() {
    docker compose logs -f "$@"
}

# 重启服务
restart() {
    stop
    start
}

# 数据库操作
db_seed() {
    log_info "运行数据库种子..."
    docker compose exec api npx prisma db seed
    log_success "数据库种子完成"
}

db_reset() {
    log_warning "这将清空所有数据！"
    read -p "确定继续? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker compose exec api npx prisma migrate reset --force
        log_success "数据库已重置"
    fi
}

# 同步学校数据
sync_schools() {
    log_info "同步 College Scorecard 数据..."
    docker compose exec api npx ts-node scripts/sync-scorecard.ts
    log_success "学校数据同步完成"
}

# 清理
clean() {
    log_info "清理 Docker 资源..."
    docker compose down -v --rmi local
    log_success "清理完成"
}

# 生产环境部署
deploy_prod() {
    log_info "生产环境部署..."
    docker compose --profile production up -d
    log_success "生产环境部署完成"
}

# 帮助信息
show_help() {
    echo "Lumni - 部署脚本"
    echo ""
    echo "用法: ./deploy.sh [命令]"
    echo ""
    echo "命令:"
    echo "  start       启动所有服务"
    echo "  stop        停止所有服务"
    echo "  restart     重启所有服务"
    echo "  build       构建 Docker 镜像"
    echo "  logs        查看日志 (可跟服务名)"
    echo "  db:seed     运行数据库种子"
    echo "  db:reset    重置数据库"
    echo "  sync        同步学校数据"
    echo "  clean       清理所有 Docker 资源"
    echo "  prod        生产环境部署"
    echo "  help        显示帮助信息"
    echo ""
    echo "示例:"
    echo "  ./deploy.sh start       # 启动服务"
    echo "  ./deploy.sh logs api    # 查看 API 日志"
    echo "  ./deploy.sh db:seed     # 导入初始数据"
}

# 主函数
main() {
    case "${1:-}" in
        start)
            check_requirements
            check_env
            build
            start
            ;;
        stop)
            stop
            ;;
        restart)
            restart
            ;;
        build)
            build
            ;;
        logs)
            shift
            logs "$@"
            ;;
        db:seed)
            db_seed
            ;;
        db:reset)
            db_reset
            ;;
        sync)
            sync_schools
            ;;
        clean)
            clean
            ;;
        prod)
            check_requirements
            check_env
            build
            deploy_prod
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            show_help
            ;;
    esac
}

main "$@"












