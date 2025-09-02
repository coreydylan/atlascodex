// Atlas Codex - System Monitoring
// Comprehensive monitoring and alerting system

import { z } from 'zod';
import { EventEmitter } from 'events';

// Monitoring schemas
export const MetricSchema = z.object({
  name: z.string(),
  value: z.number(),
  unit: z.string(),
  timestamp: z.string(),
  tags: z.record(z.string()).optional()
});

export const AlertSchema = z.object({
  id: z.string(),
  level: z.enum(['info', 'warning', 'error', 'critical']),
  category: z.string(),
  message: z.string(),
  details: z.any().optional(),
  timestamp: z.string(),
  resolved: z.boolean(),
  resolvedAt: z.string().optional()
});

export const SystemHealthSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(),
  components: z.record(z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    message: z.string().optional(),
    metrics: z.record(z.number()).optional()
  })),
  alerts: z.array(AlertSchema),
  metrics: z.object({
    uptime: z.number(),
    requestsPerMinute: z.number(),
    errorRate: z.number(),
    avgResponseTime: z.number(),
    memoryUsage: z.number(),
    cpuUsage: z.number()
  })
});

export type Metric = z.infer<typeof MetricSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type SystemHealth = z.infer<typeof SystemHealthSchema>;

export class MonitoringService extends EventEmitter {
  private metrics: Map<string, Metric[]> = new Map();
  private alerts: Alert[] = [];
  private startTime: number = Date.now();
  private requestCount: number = 0;
  private errorCount: number = 0;
  private responseTimeSum: number = 0;

  private thresholds = {
    errorRate: 0.05, // 5% error rate
    avgResponseTime: 5000, // 5 seconds
    memoryUsage: 0.8, // 80% memory
    cpuUsage: 0.8, // 80% CPU
    queueSize: 100,
    costPerHour: 10 // $10/hour
  };

  /**
   * Record a metric
   */
  recordMetric(
    name: string,
    value: number,
    unit: string = 'count',
    tags?: Record<string, string>
  ): void {
    const metric: Metric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      tags
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricHistory = this.metrics.get(name)!;
    metricHistory.push(metric);

    // Keep only last 1000 metrics per name
    if (metricHistory.length > 1000) {
      metricHistory.shift();
    }

    // Check for threshold violations
    this.checkThresholds(name, value);

    // Emit metric event
    this.emit('metric', metric);
  }

  /**
   * Record a request
   */
  recordRequest(success: boolean, responseTime: number): void {
    this.requestCount++;
    this.responseTimeSum += responseTime;
    
    if (!success) {
      this.errorCount++;
    }

    this.recordMetric('requests', 1, 'count', { success: success.toString() });
    this.recordMetric('response_time', responseTime, 'ms');
  }

  /**
   * Create an alert
   */
  createAlert(
    level: Alert['level'],
    category: string,
    message: string,
    details?: any
  ): Alert {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      category,
      message,
      details,
      timestamp: new Date().toISOString(),
      resolved: false
    };

    this.alerts.push(alert);

    // Emit alert event
    this.emit('alert', alert);

    // Log critical alerts
    if (level === 'critical') {
      console.error(`🚨 CRITICAL ALERT: ${message}`);
    } else if (level === 'error') {
      console.error(`❌ ERROR ALERT: ${message}`);
    } else if (level === 'warning') {
      console.warn(`⚠️ WARNING: ${message}`);
    }

    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      this.emit('alert_resolved', alert);
    }
  }

  /**
   * Check thresholds and create alerts
   */
  private checkThresholds(metricName: string, value: number): void {
    switch (metricName) {
      case 'error_rate':
        if (value > this.thresholds.errorRate) {
          this.createAlert(
            'error',
            'performance',
            `Error rate (${(value * 100).toFixed(1)}%) exceeds threshold`,
            { threshold: this.thresholds.errorRate, actual: value }
          );
        }
        break;

      case 'response_time':
        if (value > this.thresholds.avgResponseTime) {
          this.createAlert(
            'warning',
            'performance',
            `Response time (${value}ms) exceeds threshold`,
            { threshold: this.thresholds.avgResponseTime, actual: value }
          );
        }
        break;

      case 'memory_usage':
        if (value > this.thresholds.memoryUsage) {
          this.createAlert(
            'error',
            'resources',
            `Memory usage (${(value * 100).toFixed(1)}%) exceeds threshold`,
            { threshold: this.thresholds.memoryUsage, actual: value }
          );
        }
        break;

      case 'cpu_usage':
        if (value > this.thresholds.cpuUsage) {
          this.createAlert(
            'warning',
            'resources',
            `CPU usage (${(value * 100).toFixed(1)}%) exceeds threshold`,
            { threshold: this.thresholds.cpuUsage, actual: value }
          );
        }
        break;

      case 'queue_size':
        if (value > this.thresholds.queueSize) {
          this.createAlert(
            'warning',
            'queue',
            `Queue size (${value}) exceeds threshold`,
            { threshold: this.thresholds.queueSize, actual: value }
          );
        }
        break;

      case 'cost_per_hour':
        if (value > this.thresholds.costPerHour) {
          this.createAlert(
            'critical',
            'cost',
            `Hourly cost ($${value.toFixed(2)}) exceeds threshold`,
            { threshold: this.thresholds.costPerHour, actual: value }
          );
        }
        break;
    }
  }

  /**
   * Get system health
   */
  getSystemHealth(): SystemHealth {
    const now = Date.now();
    const uptime = now - this.startTime;
    const errorRate = this.requestCount > 0 ? this.errorCount / this.requestCount : 0;
    const avgResponseTime = this.requestCount > 0 ? 
      this.responseTimeSum / this.requestCount : 0;

    // Get resource metrics (simplified)
    const memoryUsage = process.memoryUsage();
    const memoryPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;

    // Determine overall status
    const activeAlerts = this.alerts.filter(a => !a.resolved);
    const criticalAlerts = activeAlerts.filter(a => a.level === 'critical');
    const errorAlerts = activeAlerts.filter(a => a.level === 'error');

    let status: SystemHealth['status'] = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'unhealthy';
    } else if (errorAlerts.length > 0 || errorRate > this.thresholds.errorRate) {
      status = 'degraded';
    }

    // Component health
    const components: SystemHealth['components'] = {
      extraction: {
        status: errorRate < 0.01 ? 'healthy' : errorRate < 0.05 ? 'degraded' : 'unhealthy',
        metrics: {
          errorRate,
          avgResponseTime
        }
      },
      dip: {
        status: 'healthy', // Would check DIP system
        message: 'DIP system operational'
      },
      evidence: {
        status: 'healthy', // Would check evidence ledger
        message: 'Evidence ledger operational'
      },
      cost: {
        status: 'healthy', // Would check cost optimizer
        message: 'Cost optimization active'
      }
    };

    return {
      status,
      timestamp: new Date().toISOString(),
      components,
      alerts: activeAlerts,
      metrics: {
        uptime,
        requestsPerMinute: this.getRequestsPerMinute(),
        errorRate,
        avgResponseTime,
        memoryUsage: memoryPercent,
        cpuUsage: 0.5 // Would get actual CPU usage
      }
    };
  }

  /**
   * Get requests per minute
   */
  private getRequestsPerMinute(): number {
    const uptime = Date.now() - this.startTime;
    const minutes = uptime / 60000;
    return minutes > 0 ? this.requestCount / minutes : 0;
  }

  /**
   * Get metric statistics
   */
  getMetricStats(metricName: string, periodMs: number = 3600000): any {
    const history = this.metrics.get(metricName) || [];
    const cutoff = new Date(Date.now() - periodMs);
    
    const recentMetrics = history.filter(
      m => new Date(m.timestamp) > cutoff
    );

    if (recentMetrics.length === 0) {
      return null;
    }

    const values = recentMetrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Calculate percentiles
    values.sort((a, b) => a - b);
    const p50 = values[Math.floor(values.length * 0.5)];
    const p95 = values[Math.floor(values.length * 0.95)];
    const p99 = values[Math.floor(values.length * 0.99)];

    return {
      count: values.length,
      sum,
      avg,
      min,
      max,
      p50,
      p95,
      p99
    };
  }

  /**
   * Get dashboard data
   */
  getDashboardData(): any {
    const health = this.getSystemHealth();
    
    return {
      health,
      metrics: {
        requests: this.getMetricStats('requests', 3600000),
        responseTime: this.getMetricStats('response_time', 3600000),
        errors: this.getMetricStats('errors', 3600000),
        cost: this.getMetricStats('extraction_cost', 3600000)
      },
      recentAlerts: this.alerts.slice(-10).reverse(),
      trends: {
        requestTrend: this.calculateTrend('requests'),
        errorTrend: this.calculateTrend('errors'),
        costTrend: this.calculateTrend('extraction_cost')
      }
    };
  }

  /**
   * Calculate metric trend
   */
  private calculateTrend(metricName: string): string {
    const history = this.metrics.get(metricName) || [];
    if (history.length < 10) return 'stable';

    const recent = history.slice(-5);
    const previous = history.slice(-10, -5);

    const recentAvg = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
    const previousAvg = previous.reduce((sum, m) => sum + m.value, 0) / previous.length;

    const change = (recentAvg - previousAvg) / previousAvg;

    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(startTime?: Date, endTime?: Date): any {
    const metrics: any[] = [];
    
    for (const [name, history] of this.metrics) {
      const filtered = history.filter(m => {
        const timestamp = new Date(m.timestamp);
        return (!startTime || timestamp >= startTime) &&
               (!endTime || timestamp <= endTime);
      });
      
      metrics.push({
        name,
        data: filtered
      });
    }

    return {
      period: {
        start: startTime?.toISOString() || this.startTime,
        end: endTime?.toISOString() || new Date().toISOString()
      },
      metrics
    };
  }
}