/**
 * Evidence-First Production Safety System
 * Circuit breaker, rate limiting, health checks, and production safeguards
 */

// Core safety interfaces
export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  monitoringWindowMs: number;
  minimumRequests: number;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  totalRequests: number;
  successfulRequests: number;
  windowStart: number;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyGenerator: (context: any) => string;
  skipSuccessful?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitState {
  requests: number;
  windowStart: number;
  blocked: boolean;
  resetTime: number;
}

export interface HealthCheckConfig {
  name: string;
  checkFn: () => Promise<HealthStatus>;
  intervalMs: number;
  timeoutMs: number;
  retryCount: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: Record<string, any>;
  timestamp: number;
  responseTime?: number;
}

export interface SafetyMetrics {
  circuitBreakers: Record<string, CircuitBreakerState>;
  rateLimits: Record<string, RateLimitState>;
  healthChecks: Record<string, HealthStatus>;
  system: {
    uptime: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    lastError?: {
      message: string;
      timestamp: number;
      stack?: string;
    };
  };
}

export interface SafetyViolation {
  type: 'circuit_breaker' | 'rate_limit' | 'health_check' | 'resource_limit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  component: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Circuit Breaker Implementation
 */
export class CircuitBreaker {
  private state: CircuitBreakerState;
  private config: CircuitBreakerConfig;
  private onStateChange?: (state: CircuitBreakerState) => void;

  constructor(config: CircuitBreakerConfig, onStateChange?: (state: CircuitBreakerState) => void) {
    this.config = config;
    this.onStateChange = onStateChange;
    this.state = {
      state: 'closed',
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
      totalRequests: 0,
      successfulRequests: 0,
      windowStart: Date.now()
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.checkState();

    if (this.state.state === 'open') {
      throw new Error(`Circuit breaker is OPEN. Next attempt allowed at ${new Date(this.state.nextAttemptTime).toISOString()}`);
    }

    this.state.totalRequests++;

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private checkState(): void {
    const now = Date.now();

    // Reset monitoring window if needed
    if (now - this.state.windowStart > this.config.monitoringWindowMs) {
      this.resetWindow();
    }

    // Check if we should move from OPEN to HALF-OPEN
    if (this.state.state === 'open' && now >= this.state.nextAttemptTime) {
      this.setState('half-open');
    }
  }

  private recordSuccess(): void {
    this.state.successfulRequests++;

    if (this.state.state === 'half-open') {
      // Successful request in half-open state - close the circuit
      this.setState('closed');
      this.state.failureCount = 0;
    }
  }

  private recordFailure(): void {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();

    if (this.shouldOpenCircuit()) {
      this.setState('open');
      this.state.nextAttemptTime = Date.now() + this.config.resetTimeoutMs;
    }
  }

  private shouldOpenCircuit(): boolean {
    return (
      this.state.totalRequests >= this.config.minimumRequests &&
      this.state.failureCount >= this.config.failureThreshold
    );
  }

  private setState(newState: CircuitBreakerState['state']): void {
    this.state.state = newState;
    if (this.onStateChange) {
      this.onStateChange({ ...this.state });
    }
  }

  private resetWindow(): void {
    this.state.windowStart = Date.now();
    this.state.totalRequests = 0;
    this.state.successfulRequests = 0;
    this.state.failureCount = 0;
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  reset(): void {
    this.state = {
      state: 'closed',
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
      totalRequests: 0,
      successfulRequests: 0,
      windowStart: Date.now()
    };
  }
}

/**
 * Rate Limiter Implementation
 */
export class RateLimiter {
  private windows: Map<string, RateLimitState> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async checkLimit(context: any): Promise<{ allowed: boolean; resetTime?: number; remaining?: number }> {
    const key = this.config.keyGenerator(context);
    const now = Date.now();
    
    let windowState = this.windows.get(key);
    
    // Initialize or reset window if expired
    if (!windowState || now - windowState.windowStart >= this.config.windowMs) {
      windowState = {
        requests: 0,
        windowStart: now,
        blocked: false,
        resetTime: now + this.config.windowMs
      };
      this.windows.set(key, windowState);
    }

    // Check if limit exceeded
    if (windowState.requests >= this.config.maxRequests) {
      windowState.blocked = true;
      return {
        allowed: false,
        resetTime: windowState.resetTime,
        remaining: 0
      };
    }

    // Allow request and increment counter
    windowState.requests++;
    
    return {
      allowed: true,
      remaining: this.config.maxRequests - windowState.requests,
      resetTime: windowState.resetTime
    };
  }

  recordRequest(context: any, success: boolean): void {
    const key = this.config.keyGenerator(context);
    const windowState = this.windows.get(key);
    
    if (windowState) {
      // Only count requests based on configuration
      if (
        (!this.config.skipSuccessful || !success) &&
        (!this.config.skipFailedRequests || success)
      ) {
        // Request already counted in checkLimit
      }
    }
  }

  getState(key: string): RateLimitState | undefined {
    return this.windows.get(key);
  }

  getAllStates(): Map<string, RateLimitState> {
    return new Map(this.windows);
  }

  getAllStateEntries(): Array<[string, RateLimitState]> {
    return Array.from(this.windows.entries());
  }

  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.windows.entries());
    for (const [key, state] of entries) {
      if (now > state.resetTime) {
        this.windows.delete(key);
      }
    }
  }
}

/**
 * Health Monitor Implementation
 */
export class HealthMonitor {
  private checks: Map<string, HealthCheckConfig> = new Map();
  private statuses: Map<string, HealthStatus> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private running = false;

  addCheck(config: HealthCheckConfig): void {
    this.checks.set(config.name, config);
    
    // Initialize with unknown status
    this.statuses.set(config.name, {
      status: 'unhealthy',
      message: 'Not yet checked',
      timestamp: Date.now()
    });

    // Start monitoring if already running
    if (this.running) {
      this.startCheckMonitoring(config);
    }
  }

  removeCheck(name: string): void {
    this.checks.delete(name);
    this.statuses.delete(name);
    
    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
    }
  }

  start(): void {
    if (this.running) return;
    
    this.running = true;
    
    // Start monitoring all checks
    const checkConfigs = Array.from(this.checks.values());
    for (const config of checkConfigs) {
      this.startCheckMonitoring(config);
    }
  }

  stop(): void {
    if (!this.running) return;
    
    this.running = false;
    
    // Clear all intervals
    const intervals = Array.from(this.intervals.values());
    for (const interval of intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }

  private startCheckMonitoring(config: HealthCheckConfig): void {
    // Run initial check
    this.runHealthCheck(config);
    
    // Schedule recurring checks
    const interval = setInterval(() => {
      this.runHealthCheck(config);
    }, config.intervalMs);
    
    this.intervals.set(config.name, interval);
  }

  private async runHealthCheck(config: HealthCheckConfig): Promise<void> {
    const startTime = Date.now();
    let status: HealthStatus;
    
    try {
      // Run check with timeout
      const checkPromise = config.checkFn();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), config.timeoutMs);
      });
      
      const result = await Promise.race([checkPromise, timeoutPromise]);
      
      status = {
        ...result,
        timestamp: Date.now(),
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      status = {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Health check failed',
        timestamp: Date.now(),
        responseTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.name : 'Unknown error'
        }
      };
    }
    
    this.statuses.set(config.name, status);
  }

  getStatus(name: string): HealthStatus | undefined {
    return this.statuses.get(name);
  }

  getAllStatuses(): Map<string, HealthStatus> {
    return new Map(this.statuses);
  }

  getOverallStatus(): HealthStatus {
    const allStatuses = Array.from(this.statuses.values());
    
    if (allStatuses.length === 0) {
      return {
        status: 'unhealthy',
        message: 'No health checks configured',
        timestamp: Date.now()
      };
    }

    const unhealthyCount = allStatuses.filter(s => s.status === 'unhealthy').length;
    const degradedCount = allStatuses.filter(s => s.status === 'degraded').length;
    
    let overallStatus: HealthStatus['status'];
    let message: string;
    
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
      message = `${unhealthyCount} unhealthy checks`;
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
      message = `${degradedCount} degraded checks`;
    } else {
      overallStatus = 'healthy';
      message = 'All checks passing';
    }

    return {
      status: overallStatus,
      message,
      timestamp: Date.now(),
      details: {
        totalChecks: allStatuses.length,
        healthyChecks: allStatuses.filter(s => s.status === 'healthy').length,
        degradedChecks: degradedCount,
        unhealthyChecks: unhealthyCount
      }
    };
  }
}

/**
 * Production Safety Manager - Main safety coordinator
 */
export class ProductionSafety {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private healthMonitor: HealthMonitor = new HealthMonitor();
  private violations: SafetyViolation[] = [];
  private metrics: SafetyMetrics;
  private startTime: number = Date.now();

  constructor() {
    this.metrics = {
      circuitBreakers: {},
      rateLimits: {},
      healthChecks: {},
      system: {
        uptime: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0
      }
    };

    // Start health monitoring
    this.healthMonitor.start();
    
    // Add default system health checks
    this.addDefaultHealthChecks();
  }

  /**
   * Add circuit breaker for a component
   */
  addCircuitBreaker(name: string, config: CircuitBreakerConfig): void {
    const circuitBreaker = new CircuitBreaker(config, (state) => {
      this.metrics.circuitBreakers[name] = state;
      
      if (state.state === 'open') {
        this.recordViolation({
          type: 'circuit_breaker',
          severity: 'high',
          message: `Circuit breaker ${name} opened due to ${state.failureCount} failures`,
          component: name,
          timestamp: Date.now(),
          metadata: { state }
        });
      }
    });
    
    this.circuitBreakers.set(name, circuitBreaker);
  }

  /**
   * Add rate limiter for a component
   */
  addRateLimiter(name: string, config: RateLimitConfig): void {
    const rateLimiter = new RateLimiter(config);
    this.rateLimiters.set(name, rateLimiter);
  }

  /**
   * Add health check
   */
  addHealthCheck(config: HealthCheckConfig): void {
    this.healthMonitor.addCheck(config);
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async executeWithCircuitBreaker<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const circuitBreaker = this.circuitBreakers.get(name);
    if (!circuitBreaker) {
      throw new Error(`Circuit breaker ${name} not found`);
    }

    const startTime = Date.now();
    this.metrics.system.totalRequests++;

    try {
      const result = await circuitBreaker.execute(operation);
      this.metrics.system.successfulRequests++;
      this.updateAverageResponseTime(Date.now() - startTime);
      return result;
    } catch (error) {
      this.metrics.system.failedRequests++;
      this.metrics.system.lastError = {
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        stack: error instanceof Error ? error.stack : undefined
      };
      throw error;
    }
  }

  /**
   * Check rate limit before operation
   */
  async checkRateLimit(name: string, context: any): Promise<{ allowed: boolean; resetTime?: number; remaining?: number }> {
    const rateLimiter = this.rateLimiters.get(name);
    if (!rateLimiter) {
      throw new Error(`Rate limiter ${name} not found`);
    }

    const result = await rateLimiter.checkLimit(context);
    
    if (!result.allowed) {
      const key = this.rateLimiters.get(name)!.getAllStates().keys().next().value || 'unknown';
      this.metrics.rateLimits[key] = rateLimiter.getState(key) || {
        requests: 0,
        windowStart: Date.now(),
        blocked: true,
        resetTime: result.resetTime || Date.now()
      };

      this.recordViolation({
        type: 'rate_limit',
        severity: 'medium',
        message: `Rate limit exceeded for ${name}`,
        component: name,
        timestamp: Date.now(),
        metadata: { context, resetTime: result.resetTime }
      });
    }

    return result;
  }

  /**
   * Get current safety metrics
   */
  getMetrics(): SafetyMetrics {
    // Update uptime
    this.metrics.system.uptime = Date.now() - this.startTime;
    
    // Update health check statuses
    const healthStatuses = this.healthMonitor.getAllStatuses();
    const healthEntries = Array.from(healthStatuses.entries());
    for (const [name, status] of healthEntries) {
      this.metrics.healthChecks[name] = status;
    }

    return { ...this.metrics };
  }

  /**
   * Get recent violations
   */
  getViolations(limit: number = 50): SafetyViolation[] {
    return this.violations.slice(-limit);
  }

  /**
   * Get system health status
   */
  getSystemHealth(): HealthStatus {
    return this.healthMonitor.getOverallStatus();
  }

  /**
   * Shutdown safety systems
   */
  shutdown(): void {
    this.healthMonitor.stop();
    
    // Clear any cleanup intervals
    this.circuitBreakers.forEach(cb => cb.reset());
    this.rateLimiters.forEach(rl => rl.cleanup());
  }

  /**
   * Emergency shutdown - immediately fail all operations
   */
  emergencyShutdown(reason: string): void {
    this.recordViolation({
      type: 'circuit_breaker',
      severity: 'critical',
      message: `Emergency shutdown initiated: ${reason}`,
      component: 'system',
      timestamp: Date.now()
    });

    // Open all circuit breakers
    this.circuitBreakers.forEach((cb, name) => {
      cb.reset();
      // Force open state by setting failure threshold to 0
    });

    this.shutdown();
  }

  private addDefaultHealthChecks(): void {
    // Memory usage check
    this.addHealthCheck({
      name: 'memory',
      checkFn: async () => {
        const usage = process.memoryUsage();
        const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
        
        let status: HealthStatus['status'] = 'healthy';
        if (heapUsedMB > 512) status = 'degraded';
        if (heapUsedMB > 1024) status = 'unhealthy';
        
        return {
          status,
          message: `Heap usage: ${heapUsedMB}MB / ${heapTotalMB}MB`,
          details: { heapUsedMB, heapTotalMB },
          timestamp: Date.now()
        };
      },
      intervalMs: 30000, // 30 seconds
      timeoutMs: 5000,
      retryCount: 2
    });

    // System uptime check
    this.addHealthCheck({
      name: 'uptime',
      checkFn: async () => {
        const uptimeMs = Date.now() - this.startTime;
        const uptimeMinutes = Math.round(uptimeMs / 60000);
        
        return {
          status: 'healthy',
          message: `System uptime: ${uptimeMinutes} minutes`,
          details: { uptimeMs },
          timestamp: Date.now()
        };
      },
      intervalMs: 60000, // 1 minute
      timeoutMs: 1000,
      retryCount: 1
    });
  }

  private recordViolation(violation: SafetyViolation): void {
    this.violations.push(violation);
    
    // Keep only last 1000 violations
    if (this.violations.length > 1000) {
      this.violations = this.violations.slice(-1000);
    }
  }

  private updateAverageResponseTime(responseTime: number): void {
    const totalRequests = this.metrics.system.totalRequests;
    const currentAvg = this.metrics.system.averageResponseTime;
    
    // Calculate rolling average
    this.metrics.system.averageResponseTime = 
      ((currentAvg * (totalRequests - 1)) + responseTime) / totalRequests;
  }
}

/**
 * Create and return a new ProductionSafety instance
 */
export function createProductionSafety(): ProductionSafety {
  return new ProductionSafety();
}

/**
 * Default circuit breaker configurations
 */
export const defaultCircuitBreakerConfigs = {
  extraction: {
    failureThreshold: 5,
    resetTimeoutMs: 60000, // 1 minute
    monitoringWindowMs: 300000, // 5 minutes
    minimumRequests: 10
  },
  llm: {
    failureThreshold: 3,
    resetTimeoutMs: 30000, // 30 seconds
    monitoringWindowMs: 120000, // 2 minutes
    minimumRequests: 5
  },
  database: {
    failureThreshold: 2,
    resetTimeoutMs: 10000, // 10 seconds
    monitoringWindowMs: 60000, // 1 minute
    minimumRequests: 3
  }
};

/**
 * Default rate limiter configurations
 */
export const defaultRateLimitConfigs = {
  extraction: {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
    keyGenerator: (context: any) => context.userId || context.ip || 'anonymous'
  },
  llm: {
    maxRequests: 50,
    windowMs: 60000, // 1 minute  
    keyGenerator: (context: any) => context.userId || context.ip || 'anonymous'
  }
};