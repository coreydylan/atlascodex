/**
 * Evidence-First Support Systems Test
 * Tests for anchor-system, content-hasher, and production-safety
 */

import { 
  createAnchorSystem, 
  AnchorSystem, 
  isValidAnchorId 
} from '../anchor-system';

import { 
  createContentHasher, 
  ContentHasher, 
  quickHash, 
  generateSecureKey 
} from '../content-hasher';

import { 
  createProductionSafety, 
  ProductionSafety, 
  CircuitBreaker,
  defaultCircuitBreakerConfigs,
  defaultRateLimitConfigs 
} from '../production-safety';

describe('Evidence-First Support Systems', () => {
  describe('AnchorSystem', () => {
    let anchorSystem: AnchorSystem;

    beforeEach(() => {
      anchorSystem = createAnchorSystem();
    });

    test('should create anchor system instance', () => {
      expect(anchorSystem).toBeInstanceOf(AnchorSystem);
    });

    test('should validate anchor IDs', () => {
      expect(isValidAnchorId('abc123')).toBe(true);
      expect(isValidAnchorId('ABC123')).toBe(true);
      expect(isValidAnchorId('123abc')).toBe(true);
      expect(isValidAnchorId('')).toBe(false);
      expect(isValidAnchorId('abc-123')).toBe(false);
      expect(isValidAnchorId('abc_123')).toBe(false);
    });

    test('should get index metadata', () => {
      const metadata = anchorSystem.getIndexMetadata();
      expect(metadata).toHaveProperty('totalNodes', 0);
      expect(metadata).toHaveProperty('indexedAt');
      expect(metadata).toHaveProperty('pageUrl', '');
      expect(metadata).toHaveProperty('stability', 0);
    });

    test('should export index data', () => {
      const exportData = anchorSystem.exportIndex();
      expect(exportData).toHaveProperty('metadata');
      expect(exportData).toHaveProperty('nodeCount', 0);
      expect(exportData).toHaveProperty('selectorCount', 0);
      expect(exportData).toHaveProperty('xpathCount', 0);
      expect(exportData).toHaveProperty('textIndexCount', 0);
    });
  });

  describe('ContentHasher', () => {
    let contentHasher: ContentHasher;

    beforeEach(() => {
      contentHasher = createContentHasher({
        maxCacheSize: 100,
        expiryMs: 60000
      });
    });

    test('should create content hasher instance', () => {
      expect(contentHasher).toBeInstanceOf(ContentHasher);
    });

    test('should hash content with different algorithms', () => {
      const content = 'test content';
      
      const sha256Hash = contentHasher.hashContent(content, 'sha256');
      expect(sha256Hash.algorithm).toBe('sha256');
      expect(sha256Hash.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(sha256Hash.metadata.contentType).toBe('text');
      
      const sha1Hash = contentHasher.hashContent(content, 'sha1');
      expect(sha1Hash.algorithm).toBe('sha1');
      expect(sha1Hash.hash).toMatch(/^[a-f0-9]{40}$/);
      
      const md5Hash = contentHasher.hashContent(content, 'md5');
      expect(md5Hash.algorithm).toBe('md5');
      expect(md5Hash.hash).toMatch(/^[a-f0-9]{32}$/);
    });

    test('should hash multiple contents', () => {
      const contents = ['content1', 'content2', 'content3'];
      const multiHash = contentHasher.hashMultiple(contents);
      
      expect(multiHash.algorithm).toBe('sha256');
      expect(multiHash.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(multiHash.metadata.size).toBeGreaterThan(0);
    });

    test('should verify content integrity', () => {
      const content = 'test content for integrity';
      const hash = contentHasher.hashContent(content);
      
      expect(contentHasher.verifyIntegrity(content, hash.hash)).toBe(true);
      expect(contentHasher.verifyIntegrity('different content', hash.hash)).toBe(false);
    });

    test('should generate checksums', () => {
      const content = 'test content';
      const checksum = contentHasher.generateChecksum(content);
      
      expect(checksum).toMatch(/^[a-f0-9]{16}$/);
      expect(checksum.length).toBe(16);
    });

    test('should compare hashes', () => {
      const content1 = 'identical content';
      const content2 = 'identical content';
      const content3 = 'different content';
      
      const hash1 = contentHasher.hashContent(content1);
      const hash2 = contentHasher.hashContent(content2);
      const hash3 = contentHasher.hashContent(content3);
      
      const comparison12 = contentHasher.compareHashes(hash1, hash2);
      expect(comparison12.identical).toBe(true);
      expect(comparison12.similarity).toBe(1.0);
      expect(comparison12.differences).toHaveLength(0);
      
      const comparison13 = contentHasher.compareHashes(hash1, hash3);
      expect(comparison13.identical).toBe(false);
      expect(comparison13.similarity).toBeLessThan(1.0);
      expect(comparison13.differences).toContain('Different hash values');
    });

    test('should generate idempotency keys', () => {
      const operation = 'test_operation';
      const parameters = { param1: 'value1', param2: 123 };
      const key = contentHasher.generateIdempotencyKey(operation, parameters);
      
      expect(key.key).toMatch(/^idem:test_operation:[a-f0-9]{16}$/);
      expect(key.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(key.createdAt).toBeLessThanOrEqual(Date.now());
      expect(key.expiresAt).toBeGreaterThan(key.createdAt);
    });

    test('should get cache statistics', () => {
      // Hash some content to populate stats
      contentHasher.hashContent('test1');
      contentHasher.hashContent('test2');
      
      const stats = contentHasher.getStats();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('evictions');
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('idempotencyStoreSize');
      expect(stats).toHaveProperty('fingerprintCacheSize');
      expect(stats.misses).toBeGreaterThan(0);
    });

    test('utility functions should work', () => {
      const hash = quickHash('test content');
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
      
      const secureKey = generateSecureKey(16);
      expect(secureKey).toMatch(/^[a-f0-9]{32}$/);
      
      const defaultSecureKey = generateSecureKey();
      expect(defaultSecureKey).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('ProductionSafety', () => {
    let productionSafety: ProductionSafety;

    beforeEach(() => {
      productionSafety = createProductionSafety();
    });

    afterEach(() => {
      productionSafety.shutdown();
    });

    test('should create production safety instance', () => {
      expect(productionSafety).toBeInstanceOf(ProductionSafety);
    });

    test('should add circuit breakers', () => {
      const config = defaultCircuitBreakerConfigs.extraction;
      productionSafety.addCircuitBreaker('test_circuit', config);
      
      const metrics = productionSafety.getMetrics();
      expect(metrics.circuitBreakers).toHaveProperty('test_circuit');
    });

    test('should add rate limiters', () => {
      const config = defaultRateLimitConfigs.extraction;
      productionSafety.addRateLimiter('test_limiter', config);
      
      // Should not throw
      expect(() => productionSafety.addRateLimiter('test_limiter', config)).not.toThrow();
    });

    test('should add health checks', () => {
      productionSafety.addHealthCheck({
        name: 'test_health',
        checkFn: async () => ({
          status: 'healthy' as const,
          message: 'Test is healthy',
          timestamp: Date.now()
        }),
        intervalMs: 1000,
        timeoutMs: 500,
        retryCount: 1
      });
      
      // Allow some time for the check to run
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const systemHealth = productionSafety.getSystemHealth();
      expect(systemHealth.status).toBeDefined();
    });

    test('should get system metrics', () => {
      const metrics = productionSafety.getMetrics();
      expect(metrics).toHaveProperty('circuitBreakers');
      expect(metrics).toHaveProperty('rateLimits');
      expect(metrics).toHaveProperty('healthChecks');
      expect(metrics).toHaveProperty('system');
      expect(metrics.system).toHaveProperty('uptime');
      expect(metrics.system).toHaveProperty('totalRequests', 0);
      expect(metrics.system).toHaveProperty('successfulRequests', 0);
      expect(metrics.system).toHaveProperty('failedRequests', 0);
      expect(metrics.system).toHaveProperty('averageResponseTime', 0);
    });

    test('should get violations', () => {
      const violations = productionSafety.getViolations();
      expect(Array.isArray(violations)).toBe(true);
    });

    test('should handle circuit breaker execution', async () => {
      const config = defaultCircuitBreakerConfigs.extraction;
      productionSafety.addCircuitBreaker('test_execution', config);
      
      const testOperation = async () => {
        return 'success';
      };
      
      const result = await productionSafety.executeWithCircuitBreaker('test_execution', testOperation);
      expect(result).toBe('success');
      
      const metrics = productionSafety.getMetrics();
      expect(metrics.system.totalRequests).toBe(1);
      expect(metrics.system.successfulRequests).toBe(1);
    });

    test('should handle rate limiting', async () => {
      const config = defaultRateLimitConfigs.extraction;
      productionSafety.addRateLimiter('test_rate_limit', config);
      
      const context = { userId: 'test_user' };
      const result = await productionSafety.checkRateLimit('test_rate_limit', context);
      
      expect(result).toHaveProperty('allowed', true);
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('resetTime');
    });

    test('should shutdown cleanly', () => {
      expect(() => productionSafety.shutdown()).not.toThrow();
    });

    test('should handle emergency shutdown', () => {
      expect(() => productionSafety.emergencyShutdown('Test emergency')).not.toThrow();
      
      const violations = productionSafety.getViolations();
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[violations.length - 1].severity).toBe('critical');
    });
  });

  describe('CircuitBreaker', () => {
    test('should create circuit breaker and execute operations', async () => {
      const config = {
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        monitoringWindowMs: 5000,
        minimumRequests: 1
      };
      
      const circuitBreaker = new CircuitBreaker(config);
      
      const successOperation = async () => 'success';
      const result = await circuitBreaker.execute(successOperation);
      expect(result).toBe('success');
      
      const state = circuitBreaker.getState();
      expect(state.state).toBe('closed');
      expect(state.totalRequests).toBe(1);
      expect(state.successfulRequests).toBe(1);
    });

    test('should open circuit after failures', async () => {
      const config = {
        failureThreshold: 1,
        resetTimeoutMs: 100,
        monitoringWindowMs: 5000,
        minimumRequests: 1
      };
      
      const circuitBreaker = new CircuitBreaker(config);
      
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };
      
      try {
        await circuitBreaker.execute(failingOperation);
      } catch (error) {
        // Expected to fail
      }
      
      const state = circuitBreaker.getState();
      expect(state.state).toBe('open');
      expect(state.failureCount).toBe(1);
    });

    test('should reset circuit breaker', () => {
      const config = {
        failureThreshold: 5,
        resetTimeoutMs: 60000,
        monitoringWindowMs: 300000,
        minimumRequests: 10
      };
      
      const circuitBreaker = new CircuitBreaker(config);
      circuitBreaker.reset();
      
      const state = circuitBreaker.getState();
      expect(state.state).toBe('closed');
      expect(state.failureCount).toBe(0);
      expect(state.totalRequests).toBe(0);
    });
  });
});