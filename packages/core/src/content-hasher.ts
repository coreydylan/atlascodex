/**
 * Evidence-First Content Hasher
 * Content hashing and idempotency management with crypto module
 */

import { createHash, randomBytes } from 'crypto';

// Core content hashing interfaces
export interface ContentHash {
  hash: string;
  algorithm: 'sha256' | 'sha1' | 'md5';
  timestamp: number;
  metadata: {
    size: number;
    contentType: 'text' | 'html' | 'json' | 'binary';
    encoding?: string;
  };
}

export interface HashCache {
  hashes: Map<string, ContentHash>;
  maxSize: number;
  expiryMs: number;
  stats: {
    hits: number;
    misses: number;
    evictions: number;
    created: number;
  };
}

export interface IdempotencyKey {
  key: string;
  hash: string;
  createdAt: number;
  expiresAt: number;
  metadata: Record<string, any>;
}

export interface IdempotencyResult<T = any> {
  isReplay: boolean;
  key: string;
  data?: T;
  originalTimestamp?: number;
  metadata?: Record<string, any>;
}

export interface ContentFingerprint {
  structural: string;    // DOM structure hash
  textual: string;      // Text content hash
  semantic: string;     // Semantic content hash (normalized)
  combined: string;     // Combined fingerprint
  stability: number;    // Stability score (0-1)
}

/**
 * Content Hasher - Handles content hashing and idempotency management
 */
export class ContentHasher {
  private cache: HashCache;
  private idempotencyStore: Map<string, IdempotencyResult> = new Map();
  private fingerprintCache: Map<string, ContentFingerprint> = new Map();

  constructor(options: {
    maxCacheSize?: number;
    expiryMs?: number;
  } = {}) {
    this.cache = {
      hashes: new Map(),
      maxSize: options.maxCacheSize || 1000,
      expiryMs: options.expiryMs || 24 * 60 * 60 * 1000, // 24 hours
      stats: {
        hits: 0,
        misses: 0,
        evictions: 0,
        created: Date.now()
      }
    };
  }

  /**
   * Hash content with specified algorithm
   */
  hashContent(
    content: string | Buffer, 
    algorithm: 'sha256' | 'sha1' | 'md5' = 'sha256'
  ): ContentHash {
    const contentStr = typeof content === 'string' ? content : content.toString('utf8');
    const cacheKey = `${algorithm}:${contentStr.length}:${contentStr.substring(0, 100)}`;

    // Check cache first
    if (this.cache.hashes.has(cacheKey)) {
      const cached = this.cache.hashes.get(cacheKey)!;
      // Check if not expired
      if (Date.now() - cached.timestamp < this.cache.expiryMs) {
        this.cache.stats.hits++;
        return cached;
      } else {
        // Remove expired entry
        this.cache.hashes.delete(cacheKey);
      }
    }

    // Create new hash
    const hash = createHash(algorithm);
    hash.update(content);
    const hashValue = hash.digest('hex');

    const contentHash: ContentHash = {
      hash: hashValue,
      algorithm,
      timestamp: Date.now(),
      metadata: {
        size: Buffer.byteLength(contentStr, 'utf8'),
        contentType: this.detectContentType(contentStr),
        encoding: 'utf8'
      }
    };

    // Store in cache
    this.addToCache(cacheKey, contentHash);
    this.cache.stats.misses++;

    return contentHash;
  }

  /**
   * Hash multiple content pieces and combine
   */
  hashMultiple(
    contents: Array<string | Buffer>,
    algorithm: 'sha256' | 'sha1' | 'md5' = 'sha256'
  ): ContentHash {
    const hasher = createHash(algorithm);
    let totalSize = 0;
    let contentType: ContentHash['metadata']['contentType'] = 'text';

    contents.forEach(content => {
      const contentStr = typeof content === 'string' ? content : content.toString('utf8');
      hasher.update(contentStr);
      totalSize += Buffer.byteLength(contentStr, 'utf8');
      
      // Update content type based on detected types
      const detectedType = this.detectContentType(contentStr);
      if (detectedType !== 'text') {
        contentType = detectedType;
      }
    });

    return {
      hash: hasher.digest('hex'),
      algorithm,
      timestamp: Date.now(),
      metadata: {
        size: totalSize,
        contentType,
        encoding: 'utf8'
      }
    };
  }

  /**
   * Create content fingerprint for DOM/page analysis
   */
  createContentFingerprint(document: Document): ContentFingerprint {
    const url = document.URL || '';
    const cacheKey = `fingerprint:${url}`;

    // Check cache
    if (this.fingerprintCache.has(cacheKey)) {
      return this.fingerprintCache.get(cacheKey)!;
    }

    // Extract different content aspects
    const structuralContent = this.extractStructuralContent(document);
    const textualContent = this.extractTextualContent(document);
    const semanticContent = this.extractSemanticContent(document);

    // Create hashes
    const structural = this.hashContent(structuralContent).hash;
    const textual = this.hashContent(textualContent).hash;
    const semantic = this.hashContent(semanticContent).hash;
    const combined = this.hashContent(`${structural}:${textual}:${semantic}`).hash;

    // Calculate stability score
    const stability = this.calculateContentStability(document, {
      structural,
      textual,
      semantic
    });

    const fingerprint: ContentFingerprint = {
      structural,
      textual,
      semantic,
      combined,
      stability
    };

    // Cache the result
    this.fingerprintCache.set(cacheKey, fingerprint);

    return fingerprint;
  }

  /**
   * Generate idempotency key
   */
  generateIdempotencyKey(
    operation: string,
    parameters: Record<string, any>,
    expiryMs: number = 60 * 60 * 1000 // 1 hour
  ): IdempotencyKey {
    const keyData = {
      operation,
      parameters: this.normalizeParameters(parameters),
      timestamp: Date.now()
    };

    const keyString = JSON.stringify(keyData);
    const hash = this.hashContent(keyString).hash;
    const key = `idem:${operation}:${hash.substring(0, 16)}`;

    return {
      key,
      hash,
      createdAt: Date.now(),
      expiresAt: Date.now() + expiryMs,
      metadata: keyData
    };
  }

  /**
   * Check idempotency and store result
   */
  async handleIdempotency<T>(
    idempotencyKey: IdempotencyKey,
    operation: () => Promise<T>
  ): Promise<IdempotencyResult<T>> {
    // Check if we've seen this operation before
    if (this.idempotencyStore.has(idempotencyKey.key)) {
      const existing = this.idempotencyStore.get(idempotencyKey.key)!;
      
      // Check if not expired
      if (Date.now() < idempotencyKey.expiresAt) {
        return {
          isReplay: true,
          key: idempotencyKey.key,
          data: existing.data,
          originalTimestamp: existing.originalTimestamp,
          metadata: existing.metadata
        };
      } else {
        // Clean up expired entry
        this.idempotencyStore.delete(idempotencyKey.key);
      }
    }

    // Execute the operation
    const data = await operation();
    
    // Store the result
    const result: IdempotencyResult<T> = {
      isReplay: false,
      key: idempotencyKey.key,
      data,
      originalTimestamp: Date.now(),
      metadata: idempotencyKey.metadata
    };

    this.idempotencyStore.set(idempotencyKey.key, result);

    return result;
  }

  /**
   * Verify content integrity
   */
  verifyIntegrity(content: string | Buffer, expectedHash: string, algorithm: 'sha256' | 'sha1' | 'md5' = 'sha256'): boolean {
    const actualHash = this.hashContent(content, algorithm);
    return actualHash.hash === expectedHash;
  }

  /**
   * Generate content checksum for validation
   */
  generateChecksum(content: string | Buffer): string {
    return this.hashContent(content, 'sha256').hash.substring(0, 16);
  }

  /**
   * Compare two content hashes for similarity
   */
  compareHashes(hash1: ContentHash, hash2: ContentHash): {
    identical: boolean;
    similarity: number;
    differences: string[];
  } {
    const differences: string[] = [];

    if (hash1.algorithm !== hash2.algorithm) {
      differences.push('Different algorithms');
    }

    if (hash1.hash !== hash2.hash) {
      differences.push('Different hash values');
    }

    if (hash1.metadata.size !== hash2.metadata.size) {
      differences.push('Different content sizes');
    }

    if (hash1.metadata.contentType !== hash2.metadata.contentType) {
      differences.push('Different content types');
    }

    const identical = hash1.hash === hash2.hash && hash1.algorithm === hash2.algorithm;
    
    // Calculate similarity score based on hash prefixes and metadata
    let similarity = 0;
    if (identical) {
      similarity = 1.0;
    } else if (hash1.algorithm === hash2.algorithm) {
      // Compare hash prefixes for partial similarity
      const prefix1 = hash1.hash.substring(0, 8);
      const prefix2 = hash2.hash.substring(0, 8);
      let matchingChars = 0;
      for (let i = 0; i < Math.min(prefix1.length, prefix2.length); i++) {
        if (prefix1[i] === prefix2[i]) matchingChars++;
      }
      similarity = matchingChars / 8;

      // Factor in metadata similarity
      if (hash1.metadata.contentType === hash2.metadata.contentType) {
        similarity += 0.1;
      }
      
      const sizeDiff = Math.abs(hash1.metadata.size - hash2.metadata.size);
      const maxSize = Math.max(hash1.metadata.size, hash2.metadata.size);
      if (maxSize > 0) {
        similarity += (1 - sizeDiff / maxSize) * 0.1;
      }
    }

    return {
      identical,
      similarity: Math.min(similarity, 1.0),
      differences
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    
    // Clean up hash cache
    const hashEntries = Array.from(this.cache.hashes.entries());
    for (const [key, hash] of hashEntries) {
      if (now - hash.timestamp > this.cache.expiryMs) {
        this.cache.hashes.delete(key);
        this.cache.stats.evictions++;
      }
    }

    // Clean up idempotency store
    const idempotencyEntries = Array.from(this.idempotencyStore.entries());
    for (const [key, result] of idempotencyEntries) {
      // Assuming idempotency expires after 1 hour if not specified
      const expiryTime = (result.originalTimestamp || now) + (60 * 60 * 1000);
      if (now > expiryTime) {
        this.idempotencyStore.delete(key);
      }
    }

    // Clean up fingerprint cache (limit size)
    if (this.fingerprintCache.size > 100) {
      const entries = Array.from(this.fingerprintCache.entries());
      const toDelete = entries.slice(0, entries.length - 100);
      toDelete.forEach(([key]) => this.fingerprintCache.delete(key));
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): HashCache['stats'] & {
    idempotencyStoreSize: number;
    fingerprintCacheSize: number;
    cacheSize: number;
  } {
    return {
      ...this.cache.stats,
      cacheSize: this.cache.hashes.size,
      idempotencyStoreSize: this.idempotencyStore.size,
      fingerprintCacheSize: this.fingerprintCache.size
    };
  }

  // Private helper methods

  private addToCache(key: string, hash: ContentHash): void {
    // Ensure cache doesn't exceed max size
    if (this.cache.hashes.size >= this.cache.maxSize) {
      // Remove oldest entries (simple LRU)
      const entries = Array.from(this.cache.hashes.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, Math.floor(this.cache.maxSize * 0.1));
      toRemove.forEach(([key]) => {
        this.cache.hashes.delete(key);
        this.cache.stats.evictions++;
      });
    }

    this.cache.hashes.set(key, hash);
  }

  private detectContentType(content: string): ContentHash['metadata']['contentType'] {
    const trimmed = content.trim();
    
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
      return 'html';
    }
    
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch {
        return 'text';
      }
    }
    
    // Check for binary content markers
    if (content.includes('\0') || /[\x00-\x08\x0E-\x1F\x7F]/.test(content)) {
      return 'binary';
    }
    
    return 'text';
  }

  private extractStructuralContent(document: Document): string {
    const structuralElements: string[] = [];
    
    // Extract tag structure without content
    const walker = document.createTreeWalker(
      document.body || document.documentElement,
      NodeFilter.SHOW_ELEMENT,
      null
    );

    let node: Node | null;
    while (node = walker.nextNode()) {
      const element = node as Element;
      structuralElements.push(element.tagName.toLowerCase());
    }

    return structuralElements.join(':');
  }

  private extractTextualContent(document: Document): string {
    const textContent = document.body?.textContent || document.textContent || '';
    return textContent.replace(/\s+/g, ' ').trim();
  }

  private extractSemanticContent(document: Document): string {
    // Extract meaningful content (headings, important text, etc.)
    const semanticSelectors = ['h1', 'h2', 'h3', 'title', '[role="heading"]', '.title', '.headline'];
    const semanticContent: string[] = [];

    semanticSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          const text = element.textContent?.trim();
          if (text) {
            semanticContent.push(text);
          }
        });
      } catch (error) {
        // Ignore selector errors
      }
    });

    return semanticContent.join(' | ').toLowerCase().replace(/\s+/g, ' ');
  }

  private calculateContentStability(document: Document, hashes: any): number {
    let stability = 0.5; // Base stability

    // Check for stable elements
    const stableElements = document.querySelectorAll('[id], [data-testid], [data-cy]');
    if (stableElements.length > 0) {
      stability += 0.2;
    }

    // Check content length (longer content tends to be more stable)
    const textContent = document.textContent || '';
    const textLength = textContent.length;
    if (textLength > 1000) {
      stability += 0.1;
    }

    // Check for timestamps or dynamic content markers
    const dynamicMarkers = ['updated', 'timestamp', 'last-modified', 'generated'];
    const hasTimestamp = dynamicMarkers.some(marker => 
      textContent.toLowerCase().includes(marker)
    );
    
    if (hasTimestamp) {
      stability -= 0.1;
    }

    return Math.max(0, Math.min(1, stability));
  }

  private normalizeParameters(params: Record<string, any>): Record<string, any> {
    // Sort keys and normalize values for consistent hashing
    const normalized: Record<string, any> = {};
    const sortedKeys = Object.keys(params).sort();
    
    sortedKeys.forEach(key => {
      const value = params[key];
      if (typeof value === 'object' && value !== null) {
        normalized[key] = JSON.stringify(value);
      } else {
        normalized[key] = String(value);
      }
    });
    
    return normalized;
  }
}

/**
 * Create and return a new ContentHasher instance
 */
export function createContentHasher(options?: {
  maxCacheSize?: number;
  expiryMs?: number;
}): ContentHasher {
  return new ContentHasher(options);
}

/**
 * Utility function to generate a quick hash for small content
 */
export function quickHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Utility function to generate a secure random key
 */
export function generateSecureKey(length: number = 32): string {
  return randomBytes(length).toString('hex');
}