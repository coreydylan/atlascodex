#!/bin/bash

# GPT-5 Migration Deployment Script
# 
# This script handles deployment of GPT-5 migration across different stages
# with safety checks, rollback capabilities, and monitoring.
#
# Usage:
#   ./scripts/deploy-gpt5.sh <stage> [options]
#
# Stages:
#   dev        - Development environment (100% traffic)
#   staging    - Staging environment (50% traffic)  
#   prod       - Production environment (gradual rollout)
#   rollback   - Emergency rollback to GPT-4
#
# Options:
#   --percentage=N     Set traffic percentage for production
#   --force           Skip confirmation prompts
#   --dry-run         Show what would be done without executing
#   --monitor         Enable continuous monitoring after deployment

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_ID="deploy-$(date +%s)"
LOG_FILE="/tmp/gpt5-deploy-${DEPLOYMENT_ID}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        INFO)  echo -e "${GREEN}[INFO]${NC} $message" | tee -a "$LOG_FILE" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC} $message" | tee -a "$LOG_FILE" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} $message" | tee -a "$LOG_FILE" ;;
        DEBUG) echo -e "${BLUE}[DEBUG]${NC} $message" | tee -a "$LOG_FILE" ;;
    esac
}

# Error handling
trap 'handle_error $? $LINENO' ERR

handle_error() {
    local exit_code=$1
    local line_number=$2
    log ERROR "Script failed at line $line_number with exit code $exit_code"
    log ERROR "Check log file: $LOG_FILE"
    exit $exit_code
}

# Usage information
usage() {
    cat << EOF
GPT-5 Migration Deployment Script

Usage: $0 <stage> [options]

Stages:
  dev        Deploy to development environment (100% GPT-5 traffic)
  staging    Deploy to staging environment (50% GPT-5 traffic)
  prod       Deploy to production environment (gradual rollout)
  rollback   Emergency rollback to GPT-4

Options:
  --percentage=N     Set traffic percentage for production (default: 10)
  --force           Skip confirmation prompts
  --dry-run         Show what would be done without executing
  --monitor         Enable continuous monitoring after deployment
  --help            Show this help message

Examples:
  $0 dev                           # Deploy to development
  $0 staging --monitor             # Deploy to staging with monitoring
  $0 prod --percentage=25          # Deploy to production with 25% traffic
  $0 rollback --force              # Emergency rollback without confirmation

EOF
}

# Parse command line arguments
STAGE=""
TRAFFIC_PERCENTAGE=10
FORCE=false
DRY_RUN=false
MONITOR=false

while [[ $# -gt 0 ]]; do
    case $1 in
        dev|staging|prod|rollback)
            STAGE="$1"
            shift
            ;;
        --percentage=*)
            TRAFFIC_PERCENTAGE="${1#*=}"
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --monitor)
            MONITOR=true
            shift
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            log ERROR "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate arguments
if [[ -z "$STAGE" ]]; then
    log ERROR "Stage is required"
    usage
    exit 1
fi

# Pre-deployment checks
pre_deployment_checks() {
    log INFO "Running pre-deployment checks..."
    
    # Check if we're in the right directory
    if [[ ! -f "$PROJECT_DIR/package.json" ]]; then
        log ERROR "Not in Atlas Codex project directory"
        exit 1
    fi
    
    # Check if GPT-5 migration files exist
    if [[ ! -f "$PROJECT_DIR/api/services/gpt5-client.js" ]]; then
        log ERROR "GPT-5 client not found. Run migration setup first."
        exit 1
    fi
    
    # Check environment variables
    if [[ -z "${OPENAI_API_KEY:-}" ]]; then
        log ERROR "OPENAI_API_KEY not set"
        exit 1
    fi
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2)
    local required_version="18.0.0"
    if ! printf '%s\n%s\n' "$required_version" "$node_version" | sort -V -C; then
        log ERROR "Node.js version $node_version is too old. Required: $required_version+"
        exit 1
    fi
    
    # Run tests
    log INFO "Running GPT-5 migration tests..."
    if ! npm run test:gpt5 > /dev/null 2>&1; then
        log ERROR "GPT-5 tests failed"
        exit 1
    fi
    
    log INFO "✓ Pre-deployment checks passed"
}

# Development deployment
deploy_development() {
    log INFO "🚀 Deploying to Development Environment"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY RUN] Would set environment variables:"
        log INFO "  GPT5_ENABLED=true"
        log INFO "  GPT5_TRAFFIC_PERCENTAGE=100"
        log INFO "  NODE_ENV=development"
        return
    fi
    
    # Set development environment variables
    export GPT5_ENABLED=true
    export GPT5_TRAFFIC_PERCENTAGE=100
    export GPT5_MODEL_SELECTION=auto
    export GPT5_FALLBACK_ENABLED=true
    export NODE_ENV=development
    
    # Update .env file
    cat > "$PROJECT_DIR/.env.development" << EOF
# GPT-5 Development Configuration
# Generated: $(date)
GPT5_ENABLED=true
GPT5_TRAFFIC_PERCENTAGE=100
GPT5_MODEL_SELECTION=auto
GPT5_FALLBACK_ENABLED=true
GPT5_REASONING_ENABLED=true
NODE_ENV=development
EOF
    
    # Deploy using existing script
    log INFO "Running development deployment..."
    cd "$PROJECT_DIR"
    npm run deploy:dev
    
    log INFO "✅ Development deployment complete"
}

# Staging deployment  
deploy_staging() {
    log INFO "🚀 Deploying to Staging Environment"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY RUN] Would set environment variables:"
        log INFO "  GPT5_ENABLED=true"
        log INFO "  GPT5_TRAFFIC_PERCENTAGE=50"
        log INFO "  NODE_ENV=staging"
        return
    fi
    
    # Set staging environment variables  
    export GPT5_ENABLED=true
    export GPT5_TRAFFIC_PERCENTAGE=50
    export GPT5_MODEL_SELECTION=auto
    export GPT5_FALLBACK_ENABLED=true
    export NODE_ENV=staging
    
    # Update environment configuration
    cat > "$PROJECT_DIR/.env.staging" << EOF
# GPT-5 Staging Configuration  
# Generated: $(date)
GPT5_ENABLED=true
GPT5_TRAFFIC_PERCENTAGE=50
GPT5_MODEL_SELECTION=auto
GPT5_FALLBACK_ENABLED=true
GPT5_REASONING_ENABLED=true
NODE_ENV=staging
EOF
    
    # Deploy to staging
    log INFO "Running staging deployment..."
    cd "$PROJECT_DIR"
    
    # Use serverless deploy with staging stage
    npx serverless deploy --stage staging
    
    log INFO "✅ Staging deployment complete"
}

# Production deployment
deploy_production() {
    log INFO "🚀 Deploying to Production Environment (${TRAFFIC_PERCENTAGE}% traffic)"
    
    if [[ "$FORCE" != "true" ]]; then
        log WARN "⚠️  Production deployment requires confirmation"
        echo -n "Deploy to production with ${TRAFFIC_PERCENTAGE}% GPT-5 traffic? (yes/no): "
        read -r confirmation
        if [[ "$confirmation" != "yes" ]]; then
            log INFO "Production deployment cancelled"
            exit 0
        fi
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY RUN] Would deploy to production with:"
        log INFO "  GPT5_ENABLED=true"
        log INFO "  GPT5_TRAFFIC_PERCENTAGE=$TRAFFIC_PERCENTAGE"
        log INFO "  NODE_ENV=production"
        return
    fi
    
    # Set production environment variables
    export GPT5_ENABLED=true
    export GPT5_TRAFFIC_PERCENTAGE="$TRAFFIC_PERCENTAGE"
    export GPT5_MODEL_SELECTION=auto
    export GPT5_FALLBACK_ENABLED=true
    export NODE_ENV=production
    
    # Create production environment config
    cat > "$PROJECT_DIR/.env.production" << EOF
# GPT-5 Production Configuration
# Generated: $(date)
# Traffic Percentage: ${TRAFFIC_PERCENTAGE}%
GPT5_ENABLED=true
GPT5_TRAFFIC_PERCENTAGE=$TRAFFIC_PERCENTAGE
GPT5_MODEL_SELECTION=auto
GPT5_FALLBACK_ENABLED=true
GPT5_REASONING_ENABLED=true
NODE_ENV=production
EOF
    
    # Deploy to production
    log INFO "Running production deployment..."
    cd "$PROJECT_DIR"
    
    # Use production deployment script
    if [[ -f "./deploy-production.sh" ]]; then
        ./deploy-production.sh
    else
        npx serverless deploy --stage production
    fi
    
    # Update GitHub environment if using GitHub Actions
    if command -v gh &> /dev/null; then
        log INFO "Updating GitHub environment variables..."
        gh secret set GPT5_ENABLED --body "true" --env production
        gh secret set GPT5_TRAFFIC_PERCENTAGE --body "$TRAFFIC_PERCENTAGE" --env production
    fi
    
    log INFO "✅ Production deployment complete"
}

# Emergency rollback
deploy_rollback() {
    log WARN "🚨 Initiating Emergency Rollback"
    
    if [[ "$FORCE" != "true" ]]; then
        log WARN "⚠️  Emergency rollback requires confirmation"
        echo -n "Execute emergency rollback to GPT-4? (yes/no): "
        read -r confirmation
        if [[ "$confirmation" != "yes" ]]; then
            log INFO "Rollback cancelled"
            exit 0
        fi
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY RUN] Would execute rollback script"
        return
    fi
    
    # Execute rollback script
    log INFO "Executing rollback script..."
    node "$SCRIPT_DIR/rollback-gpt5.js" --environment="$NODE_ENV"
    
    # Redeploy with GPT-4 configuration
    log INFO "Redeploying with GPT-4 configuration..."
    cd "$PROJECT_DIR"
    
    export GPT5_ENABLED=false
    export FORCE_GPT4=true
    
    # Deploy based on current environment
    case "${NODE_ENV:-development}" in
        production)
            if [[ -f "./deploy-production.sh" ]]; then
                ./deploy-production.sh
            else
                npx serverless deploy --stage production
            fi
            ;;
        staging)
            npx serverless deploy --stage staging
            ;;
        *)
            npm run deploy:dev
            ;;
    esac
    
    log INFO "✅ Emergency rollback complete"
}

# Post-deployment monitoring
monitor_deployment() {
    if [[ "$MONITOR" != "true" ]]; then
        return
    fi
    
    log INFO "📊 Starting post-deployment monitoring..."
    
    # Monitor for 10 minutes
    local end_time=$(($(date +%s) + 600))
    local error_count=0
    
    while [[ $(date +%s) -lt $end_time ]]; do
        # Check health endpoint
        if curl -sf "https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/${STAGE}/health" > /dev/null; then
            log INFO "✓ Health check passed"
        else
            error_count=$((error_count + 1))
            log WARN "✗ Health check failed (count: $error_count)"
            
            if [[ $error_count -ge 3 ]]; then
                log ERROR "Multiple health check failures detected!"
                log ERROR "Consider running emergency rollback"
                break
            fi
        fi
        
        sleep 30
    done
    
    log INFO "📊 Monitoring complete"
}

# Main execution
main() {
    log INFO "🌟 GPT-5 Migration Deployment Started"
    log INFO "Stage: $STAGE"
    log INFO "Deployment ID: $DEPLOYMENT_ID"
    log INFO "Log file: $LOG_FILE"
    
    # Run pre-deployment checks (except for rollback)
    if [[ "$STAGE" != "rollback" ]]; then
        pre_deployment_checks
    fi
    
    # Execute deployment based on stage
    case "$STAGE" in
        dev)
            deploy_development
            ;;
        staging)
            deploy_staging
            ;;
        prod)
            deploy_production
            ;;
        rollback)
            deploy_rollback
            ;;
    esac
    
    # Post-deployment monitoring
    monitor_deployment
    
    log INFO "✅ GPT-5 deployment process complete"
    log INFO "📋 Summary:"
    log INFO "  Stage: $STAGE"
    log INFO "  Traffic: ${TRAFFIC_PERCENTAGE}%"
    log INFO "  Log file: $LOG_FILE"
}

# Execute main function
main "$@"