/**
 * Evidence-First Support Systems Integration Example
 * Demonstrates how anchor-system, content-hasher, and production-safety work together
 */

import { createAnchorSystem } from './anchor-system';
import { createContentHasher } from './content-hasher';
import { createProductionSafety, defaultCircuitBreakerConfigs, defaultRateLimitConfigs } from './production-safety';

/**
 * Example: Evidence-First Page Processing with Safety and Integrity
 */
export async function evidenceFirstPageProcessingExample(document: Document, url: string) {
  console.log('🔍 Starting Evidence-First Page Processing Example');

  // 1. Initialize support systems
  const anchorSystem = createAnchorSystem();
  const contentHasher = createContentHasher({ maxCacheSize: 1000, expiryMs: 3600000 });
  const productionSafety = createProductionSafety();

  try {
    // 2. Set up production safety measures
    console.log('⚙️ Setting up production safety...');
    
    // Add circuit breakers for different operations
    productionSafety.addCircuitBreaker('dom_indexing', {
      ...defaultCircuitBreakerConfigs.extraction,
      failureThreshold: 3
    });
    
    productionSafety.addCircuitBreaker('content_hashing', {
      ...defaultCircuitBreakerConfigs.extraction,
      failureThreshold: 2
    });

    // Add rate limiting
    productionSafety.addRateLimiter('page_processing', {
      ...defaultRateLimitConfigs.extraction,
      maxRequests: 10,
      windowMs: 60000 // 1 minute
    });

    // Add health checks
    productionSafety.addHealthCheck({
      name: 'memory_usage',
      checkFn: async () => {
        const usage = process.memoryUsage();
        const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
        return {
          status: heapUsedMB > 100 ? 'degraded' : 'healthy',
          message: `Heap usage: ${heapUsedMB}MB`,
          timestamp: Date.now(),
          details: { heapUsedMB }
        };
      },
      intervalMs: 30000,
      timeoutMs: 5000,
      retryCount: 2
    });

    // 3. Check rate limits
    console.log('🚦 Checking rate limits...');
    const rateLimitResult = await productionSafety.checkRateLimit('page_processing', { url });
    if (!rateLimitResult.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${rateLimitResult.resetTime ? new Date(rateLimitResult.resetTime).toISOString() : 'unknown'}`);
    }
    console.log(`✅ Rate limit check passed. Remaining requests: ${rateLimitResult.remaining}`);

    // 4. Create content fingerprint with circuit breaker protection
    console.log('🔐 Creating content fingerprint...');
    const fingerprint = await productionSafety.executeWithCircuitBreaker('content_hashing', async () => {
      return contentHasher.createContentFingerprint(document);
    });
    
    console.log('📋 Content Fingerprint:');
    console.log(`  - Structural: ${fingerprint.structural.substring(0, 16)}...`);
    console.log(`  - Textual: ${fingerprint.textual.substring(0, 16)}...`);
    console.log(`  - Semantic: ${fingerprint.semantic.substring(0, 16)}...`);
    console.log(`  - Combined: ${fingerprint.combined.substring(0, 16)}...`);
    console.log(`  - Stability: ${(fingerprint.stability * 100).toFixed(1)}%`);

    // 5. Index DOM with anchor system with circuit breaker protection
    console.log('⚓ Indexing DOM with anchor system...');
    const anchorIndex = await productionSafety.executeWithCircuitBreaker('dom_indexing', async () => {
      return anchorSystem.indexDocument(document, url);
    });

    console.log('📊 Anchor Index Results:');
    console.log(`  - Total nodes indexed: ${anchorIndex.metadata.totalNodes}`);
    console.log(`  - Index stability: ${(anchorIndex.metadata.stability * 100).toFixed(1)}%`);
    console.log(`  - Indexed at: ${new Date(anchorIndex.metadata.indexedAt).toISOString()}`);

    // 6. Generate idempotency key for this operation
    console.log('🔑 Generating idempotency key...');
    const idempotencyKey = contentHasher.generateIdempotencyKey('page_processing', {
      url,
      fingerprintHash: fingerprint.combined,
      timestamp: Date.now()
    });

    console.log(`  - Idempotency key: ${idempotencyKey.key}`);
    console.log(`  - Expires at: ${new Date(idempotencyKey.expiresAt).toISOString()}`);

    // 7. Demonstrate anchor cross-validation
    console.log('🔍 Testing anchor cross-validation...');
    const sampleAnchors = Array.from(anchorIndex.nodes.keys()).slice(0, 3);
    if (sampleAnchors.length >= 2) {
      const crossValidation = await anchorSystem.crossValidateAnchors(sampleAnchors);
      console.log('✅ Cross-validation results:');
      console.log(`  - Agreement score: ${(crossValidation.agreement * 100).toFixed(1)}%`);
      console.log(`  - Conflicts found: ${crossValidation.conflicts.length}`);
      console.log(`  - Recommendations: ${crossValidation.recommendations.length}`);
    }

    // 8. Content integrity verification
    console.log('🛡️ Verifying content integrity...');
    const pageContent = document.textContent || '';
    const contentHash = contentHasher.hashContent(pageContent);
    const isIntegrityValid = contentHasher.verifyIntegrity(pageContent, contentHash.hash);
    console.log(`  - Content hash: ${contentHash.hash.substring(0, 16)}...`);
    console.log(`  - Integrity valid: ${isIntegrityValid ? '✅' : '❌'}`);
    console.log(`  - Content size: ${contentHash.metadata.size} bytes`);

    // 9. Production metrics and health
    console.log('📈 Production metrics...');
    const metrics = productionSafety.getMetrics();
    const systemHealth = productionSafety.getSystemHealth();
    
    console.log('🏥 System Health:');
    console.log(`  - Status: ${systemHealth.status}`);
    console.log(`  - Message: ${systemHealth.message}`);
    console.log(`  - Uptime: ${Math.round(metrics.system.uptime / 1000)}s`);
    console.log(`  - Total requests: ${metrics.system.totalRequests}`);
    console.log(`  - Success rate: ${metrics.system.totalRequests > 0 ? ((metrics.system.successfulRequests / metrics.system.totalRequests) * 100).toFixed(1) : 0}%`);

    // 10. Content hasher statistics
    const hasherStats = contentHasher.getStats();
    console.log('💾 Content Hasher Stats:');
    console.log(`  - Cache hits: ${hasherStats.hits}`);
    console.log(`  - Cache misses: ${hasherStats.misses}`);
    console.log(`  - Cache size: ${hasherStats.cacheSize}`);
    console.log(`  - Hit rate: ${hasherStats.hits + hasherStats.misses > 0 ? ((hasherStats.hits / (hasherStats.hits + hasherStats.misses)) * 100).toFixed(1) : 0}%`);

    console.log('✅ Evidence-First processing completed successfully!');

    return {
      success: true,
      results: {
        fingerprint,
        anchorIndex: anchorIndex.metadata,
        idempotencyKey: idempotencyKey.key,
        contentHash: contentHash.hash.substring(0, 16),
        systemHealth: systemHealth.status,
        metrics: {
          uptime: metrics.system.uptime,
          totalRequests: metrics.system.totalRequests,
          successRate: metrics.system.totalRequests > 0 ? (metrics.system.successfulRequests / metrics.system.totalRequests) : 0
        }
      }
    };

  } catch (error) {
    console.error('❌ Error during Evidence-First processing:', error);
    
    // Get violations for debugging
    const violations = productionSafety.getViolations(10);
    if (violations.length > 0) {
      console.log('⚠️ Recent safety violations:');
      violations.forEach(violation => {
        console.log(`  - ${violation.type}: ${violation.message} (${violation.severity})`);
      });
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      violations: violations.map(v => ({
        type: v.type,
        message: v.message,
        severity: v.severity
      }))
    };

  } finally {
    // Clean up resources
    console.log('🧹 Cleaning up resources...');
    contentHasher.cleanup();
    productionSafety.shutdown();
    console.log('🔚 Cleanup completed');
  }
}

/**
 * Example: Idempotent Operation with Safety Guards
 */
export async function idempotentOperationExample() {
  console.log('🔄 Starting Idempotent Operation Example');

  const contentHasher = createContentHasher();
  const productionSafety = createProductionSafety();

  try {
    // Set up circuit breaker for the operation
    productionSafety.addCircuitBreaker('data_processing', defaultCircuitBreakerConfigs.extraction);

    const operationParams = {
      action: 'process_data',
      input: 'sample data',
      timestamp: Date.now()
    };

    // Generate idempotency key
    const idempotencyKey = contentHasher.generateIdempotencyKey(
      'data_processing_operation',
      operationParams,
      300000 // 5 minutes
    );

    console.log(`🔑 Operation key: ${idempotencyKey.key}`);

    // Execute idempotent operation
    const result = await contentHasher.handleIdempotency(idempotencyKey, async () => {
      console.log('⚡ Executing operation (this should only happen once)...');
      
      // Simulate some work with circuit breaker protection
      return await productionSafety.executeWithCircuitBreaker('data_processing', async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing
        return {
          processed: operationParams.input.toUpperCase(),
          processedAt: new Date().toISOString(),
          hash: contentHasher.quickHash(operationParams.input)
        };
      });
    });

    console.log('📋 Operation Result:');
    console.log(`  - Is replay: ${result.isReplay}`);
    console.log(`  - Key: ${result.key}`);
    console.log(`  - Data: ${JSON.stringify(result.data, null, 2)}`);

    // Try the same operation again (should be replayed)
    console.log('🔄 Attempting same operation again...');
    const replayResult = await contentHasher.handleIdempotency(idempotencyKey, async () => {
      console.log('⚡ This should NOT execute due to idempotency');
      throw new Error('This should not happen!');
    });

    console.log('📋 Replay Result:');
    console.log(`  - Is replay: ${replayResult.isReplay}`);
    console.log(`  - Original timestamp: ${replayResult.originalTimestamp ? new Date(replayResult.originalTimestamp).toISOString() : 'N/A'}`);

    return {
      success: true,
      firstExecution: result,
      secondExecution: replayResult
    };

  } catch (error) {
    console.error('❌ Error in idempotent operation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    productionSafety.shutdown();
  }
}

/**
 * Example: Circuit Breaker Demonstration
 */
export async function circuitBreakerExample() {
  console.log('⚡ Starting Circuit Breaker Example');

  const productionSafety = createProductionSafety();

  try {
    // Set up a circuit breaker with low thresholds for demo
    productionSafety.addCircuitBreaker('demo_service', {
      failureThreshold: 2,
      resetTimeoutMs: 2000, // 2 seconds
      monitoringWindowMs: 10000, // 10 seconds
      minimumRequests: 1
    });

    // Simulate a failing operation
    let callCount = 0;
    const flakyOperation = async () => {
      callCount++;
      console.log(`📞 Call #${callCount}`);
      
      if (callCount <= 3) {
        throw new Error(`Simulated failure #${callCount}`);
      }
      return `Success on call #${callCount}`;
    };

    // Execute operations and observe circuit breaker behavior
    for (let i = 1; i <= 6; i++) {
      try {
        console.log(`\n--- Attempt ${i} ---`);
        const result = await productionSafety.executeWithCircuitBreaker('demo_service', flakyOperation);
        console.log(`✅ Success: ${result}`);
      } catch (error) {
        console.log(`❌ Failed: ${error instanceof Error ? error.message : error}`);
        
        // Show circuit breaker state
        const metrics = productionSafety.getMetrics();
        const cbState = metrics.circuitBreakers['demo_service'];
        if (cbState) {
          console.log(`🔌 Circuit breaker state: ${cbState.state}`);
          console.log(`📊 Failures: ${cbState.failureCount}/${cbState.totalRequests}`);
        }
      }

      // Small delay between attempts
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Wait for circuit breaker to reset (half-open state)
    console.log('\n⏳ Waiting for circuit breaker reset...');
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Try again after reset
    try {
      console.log('\n--- Attempt after reset ---');
      const result = await productionSafety.executeWithCircuitBreaker('demo_service', flakyOperation);
      console.log(`✅ Success after reset: ${result}`);
    } catch (error) {
      console.log(`❌ Still failing: ${error instanceof Error ? error.message : error}`);
    }

    const finalMetrics = productionSafety.getMetrics();
    const finalState = finalMetrics.circuitBreakers['demo_service'];
    
    console.log('\n📊 Final Circuit Breaker State:');
    console.log(`  - State: ${finalState.state}`);
    console.log(`  - Total requests: ${finalState.totalRequests}`);
    console.log(`  - Successful requests: ${finalState.successfulRequests}`);
    console.log(`  - Failure count: ${finalState.failureCount}`);

    return {
      success: true,
      finalState,
      totalCalls: callCount
    };

  } catch (error) {
    console.error('❌ Error in circuit breaker demo:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    productionSafety.shutdown();
  }
}

// Export utility function to run all examples
export async function runAllExamples(document?: Document, url?: string) {
  console.log('🚀 Running All Evidence-First Support Examples');
  console.log('=' .repeat(60));

  const results = {
    pageProcessing: null as any,
    idempotentOperation: null as any,
    circuitBreaker: null as any
  };

  // 1. Page Processing Example (requires DOM)
  if (document && url) {
    console.log('\n1️⃣ PAGE PROCESSING EXAMPLE');
    console.log('-'.repeat(30));
    results.pageProcessing = await evidenceFirstPageProcessingExample(document, url);
  } else {
    console.log('\n1️⃣ PAGE PROCESSING EXAMPLE - SKIPPED (No DOM provided)');
  }

  // 2. Idempotent Operation Example
  console.log('\n2️⃣ IDEMPOTENT OPERATION EXAMPLE');
  console.log('-'.repeat(35));
  results.idempotentOperation = await idempotentOperationExample();

  // 3. Circuit Breaker Example
  console.log('\n3️⃣ CIRCUIT BREAKER EXAMPLE');
  console.log('-'.repeat(26));
  results.circuitBreaker = await circuitBreakerExample();

  console.log('\n🎯 All Examples Completed!');
  console.log('='.repeat(60));

  return results;
}