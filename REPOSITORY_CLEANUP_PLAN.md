# Repository Cleanup Plan - Atlas Codex

**Date**: September 4, 2025  
**Goal**: Clean, focused repository with only essential production components

## 🎯 Critical Path Analysis

### 🟢 **KEEP - Production Critical Components**

#### **Core API System**
```
api/
├── lambda.js                    # Main Lambda handler (CRITICAL)
├── evidence-first-bridge.js     # Navigation-enhanced unified extractor (CRITICAL)
├── worker-enhanced.js           # Plan-based fallback system (CRITICAL) 
├── atlas-generator-integration.js # AI processing (CRITICAL)
└── ai-processor.js              # AI processing fallback (CRITICAL)
```

#### **Frontend Application**
```
packages/frontend/
├── src/App.tsx                  # Main application (CRITICAL)
├── src/components/              # UI components (CRITICAL)
├── package.json                 # Dependencies (CRITICAL)
├── vercel.json                  # Deployment config (CRITICAL)
└── vite.config.ts              # Build config (CRITICAL)
```

#### **Core Library (Selective)**
```
packages/core/
├── src/index.ts                 # Main export (KEEP)
├── src/schema-contracts.ts      # Schema system (KEEP) 
├── package.json                 # Dependencies (KEEP)
└── README.md                    # Documentation (KEEP)
```

#### **Configuration Files**
```
├── serverless.yml               # AWS deployment (CRITICAL)
├── package.json                 # Root dependencies (CRITICAL)
├── vercel.json                  # Frontend deployment (CRITICAL)
├── lambda-env.json              # Environment template (CRITICAL)
└── README.md                    # Main documentation (CRITICAL)
```

#### **Essential Documentation**
```
├── NAVIGATION_ENHANCED_UNIFIED_EXTRACTOR.md  # Latest implementation
├── UNIFIED_EXTRACTOR_MILESTONE.md           # Milestone documentation
└── docs/
    ├── API_REFERENCE.md
    └── DEPLOYMENT_GUIDE.md
```

---

## 🔴 **DELETE - Deprecated/Redundant Components**

### **Old API Versions**
```
DELETE:
api/
├── worker.js                    # Old worker (superseded by worker-enhanced.js)
├── worker-simple.js             # Unused simple version
├── websocket.js                 # WebSocket not in use
└── templates/                   # Template system superseded by unified extractor
    ├── eval.js
    ├── extract.js  
    ├── health.js
    ├── intelligent-extract.js
    ├── recommend.js
    └── stats.js
```

### **Duplicate/Old Package Versions**
```
DELETE:
packages/api/                    # Duplicate API package (use root api/)
packages/worker/                 # Old worker package (use api/worker-enhanced.js)
packages/testing/                # Testing framework not in critical path
packages/test/                   # Old test setup
```

### **Evidence-First Implementation Files (Superseded by Unified Extractor)**
```
DELETE:
packages/core/src/
├── adaptive-display*            # Superseded by unified extractor
├── deterministic-extractor*     # No longer using deterministic approach
├── llm-augmentation*           # Superseded by pure AI approach
├── evidence-first-*            # Old Evidence-First implementation
├── production-gate-*           # Complex system superseded
├── promotion-quorum*           # Complex system superseded  
├── stage-guards*               # Complex system superseded
└── __tests__/                  # Associated tests
```

### **Documentation Redundancy**
```
DELETE: (Keep only the latest, most comprehensive docs)
├── EVIDENCE_FIRST_*.md          # 8+ Evidence-First docs (outdated)
├── DEPLOYMENT_*.md              # 7+ deployment docs (consolidate to 1)
├── ACCURACY_SYSTEM_*.md         # Old accuracy system docs
├── BULLETPROOF_*.md             # Old planning docs
├── EXTRACTION_*.md              # Old extraction docs
├── HYPERBROWSER_*.md            # Old compatibility docs
├── INTELLIGENT_*.md             # Old extractor docs
├── ATLAS_CODEX_PRD.md           # Old product requirements
├── chatwithchat1.md             # Chat log (not needed)
├── CONTRIBUTOR.md               # Standard GitHub template
├── GITHUB_SETUP.md              # One-time setup doc
├── RESEARCH_BRIEF.md            # Old research
├── SPRINT_PLAN.md               # Old planning
├── TUTORIAL.md                  # Outdated tutorial
└── update-api-key.md            # One-time procedure doc
```

### **Build Artifacts & Generated Files**
```
DELETE:
packages/core/dist/              # Generated TypeScript output (rebuild from src)
packages/frontend/dist/          # Generated frontend build (rebuild)
```

### **Test Files & Development Scripts**
```
DELETE:
├── test-*.js                    # 6+ test scripts (consolidate to npm scripts)
├── mock-api-server.js           # Development mock server
├── examples/                    # Generator examples (outdated)
└── test_payloads/              # Test data files
```

### **Configuration Redundancy**
```
DELETE:
├── railway.json                 # Old Railway deployment (using AWS)
├── redis-task-definition.json   # Old Redis config
├── task-definition.json         # Old ECS config  
├── atlas-cors-guaranteed.json   # Redundant CORS config
└── lerna.json                   # Lerna not used for monorepo
```

---

## 🧹 **Cleanup Best Practices & Strategy**

### **Phase 1: Backup & Validation**
1. **Create cleanup branch**: `git checkout -b repo-cleanup`
2. **Validate current functionality**: Test production endpoints
3. **Document critical dependencies**: Map what imports what

### **Phase 2: Safe Deletion Strategy**
1. **Delete in reverse dependency order**: Start with unused files
2. **Test after each major deletion**: Ensure system still works
3. **Use git to track changes**: Easy rollback if needed

### **Phase 3: Consolidation**
1. **Merge duplicate configs**: Single source of truth
2. **Update import paths**: Fix any broken imports
3. **Update documentation**: Single comprehensive docs

### **Phase 4: Final Structure**
```
atlas-codex/
├── api/                         # Production API (4 files)
├── packages/
│   ├── frontend/               # React app (essential files only)
│   └── core/                   # Core library (minimal, focused)
├── docs/                       # Essential documentation (2-3 files)
├── scripts/                    # Build/deploy scripts
├── serverless.yml              # AWS config
├── package.json                # Root dependencies
├── vercel.json                 # Deployment config
├── lambda-env.json             # Environment template
├── README.md                   # Main documentation
├── NAVIGATION_ENHANCED_UNIFIED_EXTRACTOR.md
└── UNIFIED_EXTRACTOR_MILESTONE.md
```

---

## 📊 **Cleanup Impact Analysis**

### **Before Cleanup**
- **Files**: ~400+ files
- **Documentation**: 25+ markdown files (many redundant)
- **API Files**: 15+ worker/API variants
- **Package Complexity**: 5+ package directories
- **Dependencies**: Multiple overlapping concerns

### **After Cleanup**
- **Files**: ~50-75 essential files  
- **Documentation**: 5-7 focused documents
- **API Files**: 4 core production files
- **Package Complexity**: 2 focused packages (frontend + core)
- **Dependencies**: Clean, minimal, focused

### **Benefits**
- ✅ **Faster onboarding**: Clear file structure
- ✅ **Easier maintenance**: Less code to manage  
- ✅ **Reduced complexity**: Single source of truth
- ✅ **Better performance**: Smaller builds, faster deployments
- ✅ **Clear architecture**: Obvious critical path

---

## ⚠️ **Safety Measures**

### **Before Cleanup**
1. **Full system test**: Verify production functionality
2. **Dependency mapping**: `npm list --all` for each package
3. **Import analysis**: Find all `require()` and `import` statements
4. **Backup critical data**: Environment configs, API keys

### **During Cleanup**  
1. **Incremental approach**: Delete in small batches
2. **Continuous testing**: Test after each deletion phase
3. **Git tracking**: Commit each cleanup phase separately
4. **Rollback plan**: Know how to revert if needed

### **After Cleanup**
1. **Full production test**: Verify all endpoints work
2. **Build validation**: Ensure all builds complete
3. **Documentation update**: Update README and guides
4. **Team notification**: Document what was removed and why

---

**Next Steps**: Execute this cleanup plan in phases, starting with the safest deletions first.