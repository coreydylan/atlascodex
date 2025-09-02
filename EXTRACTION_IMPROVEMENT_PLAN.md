# Atlas Codex Plan-Based Extraction System Improvement Plan

Based on the feedback analysis, here's a comprehensive plan to fix the current issues and create a robust, generalizable extraction system without hardcoded rules.

## 🎯 Core Problem Analysis
- **Current Issue**: Converting HTML to text too early loses structural information
- **Result**: Names/titles/bios get mashed together, navigation becomes people data
- **Root Cause**: Pattern-based extraction on flattened text instead of DOM-aware processing

---

## 📋 Implementation Plan

### **Phase 1: DOM-First Architecture (Priority Fixes)**

#### ✅ 1.1 Replace Text-Based Processing with DOM Processing
- [ ] Install and integrate Cheerio for server-side DOM manipulation
- [ ] Modify `PreserveStructure` skill to work with DOM instead of plain text
- [ ] Update `DiscoverBlocks` to extract semantic blocks with full context:
  - CSS selector paths
  - Heading text from h1-h4 or role=heading
  - Role hints (aria, landmark proximity)
  - Text density, link density metrics
  - Sibling relationships

```javascript
// Target structure for each block
{
  root_selector: "section.staff-member:nth-child(3)",
  heading: "Katrina Bruins", 
  role_hints: ["Executive", "Director"],
  text_density: 0.85,
  link_density: 0.02,
  neighbors: {...}
}
```

#### ✅ 1.2 Implement Block Classifier
- [ ] Create lightweight block classifier (not site-specific rules)
- [ ] Add classification signals:
  - `has_heading && heading_looks_like_name`
  - `role_word_density` in siblings
  - `link_density` (high = navigation)
  - `text_density` (paragraphs vs menus)
  - `list_shape` (short lines = boards/rosters)
- [ ] Block types: `profile_card`, `nav`, `footer`, `gallery`, `board_list`, `other`
- [ ] Filter blocks before MapFields to prevent contamination

#### ✅ 1.3 Schema-Guided Field Mapping
- [ ] Flip MapFields from pattern-led to schema-guided approach
- [ ] Implement ordered source priority per field:
  1. JSON-LD structured data
  2. Visible headings (h1-h4)  
  3. Next sibling with role words (titles)
  4. Paragraphs until next profile boundary (bio)
- [ ] Remove hardcoded regex patterns

#### ✅ 1.4 Per-Field Confidence System
- [ ] Replace block-level confidence with per-field confidence
- [ ] Implement source-weighted confidence:
  - `name`: JSON-LD(0.6), heading(0.3), regex(0.1)
  - `title`: JSON-LD(0.5), role-words(0.3), class-hint(0.2)  
  - `bio`: JSON-LD(0.5), paragraphs(0.4), summary(0.1)
- [ ] Overall confidence = weighted mean with penalty for missing required fields
- [ ] Add monthly calibration system

#### ✅ 1.5 Domain-Agnostic Validators  
- [ ] `looks_like_name`: ≥2 tokens, Title Case, no digits/punctuation
- [ ] `looks_like_role`: contains role words, <120 chars, not sentence
- [ ] `bio_ok`: ≥2 sentences OR ≥120 chars, doesn't end mid-token
- [ ] Failed validation triggers repair branch

#### ✅ 1.6 Unified Threshold Management
- [ ] Create single source of truth in planner constraints:
```javascript
"constraints": {
  "mapfields_conf_min": 0.35,
  "final_quality_min": 0.45, 
  "max_results": 50
}
```
- [ ] Remove scattered default thresholds throughout codebase
- [ ] PlanExecutor distributes constraints to all skills

#### ✅ 1.7 Selector-Based Citations
- [ ] Replace substring citations with DOM selectors
- [ ] Format: `{selector, startOffset?, endOffset?, content_hash}`
- [ ] Enable fast QA and detect when selectors drift

---

### **Phase 2: Intelligent Orchestration**

#### ✅ 2.1 Weak Supervision with Labeling Functions
- [ ] Implement Snorkel-style labeling functions:
  - `LF1`: heading_looks_like_name → vote profile_card
  - `LF2`: sibling_has_role_words → vote profile_card  
  - `LF3`: high_link_density → vote nav
  - `LF4`: short_comma_lines → vote board_list
- [ ] Combine with label model for soft-labeling without gold datasets
- [ ] Feed block classifier without manual labeling

#### ✅ 2.2 Two-Pass Plan Architecture
- [ ] **Pass A (Skim)**: DOM-only, classify blocks, select top-K profile candidates
- [ ] **Pass B (Enrich)**: Only for K blocks, run MapFields + repairs
- [ ] Hard cap on requests/tokens for cost control
- [ ] Prevents overfetching and improves speed

#### ✅ 2.3 Self-Play Plan Optimization
- [ ] Generate 2-3 plan variants per page:
  - JSON-LD-first vs DOM-first
  - Strict vs relaxed validators
- [ ] Pick winner by evaluator score per unit cost
- [ ] Use losers as negative traces for planner fine-tuning

#### ✅ 2.4 Active Learning Queue
- [ ] Queue only disagreement cases:
  - Block classifier says profile_card but validators fail
  - Extracted title lacks role words  
  - Per-field confidence < threshold on staff pages
- [ ] One-click fixes update traces for continuous learning

---

### **Phase 3: Testing & Validation**

#### ✅ 3.1 Generic Pattern Tests (VMOTA-agnostic)
- [ ] **Navigation Purge Test**: link_density > 0.15 + no role words ≠ profile_card
- [ ] **Board vs Staff Test**: Many short names under "Board" → board_list not profile_card  
- [ ] **Boundary Test**: h3 name + role word + paragraphs → clean name/title/bio
- [ ] **Minimum Results Test**: ≥N profile_cards should yield ≥N results unless budget hit

#### ✅ 3.2 Comprehensive Logging System
- [ ] Top 5 block candidates with full metrics
- [ ] Per-item field mapping: source, confidence, validator result, selector
- [ ] Filter audit trail: before/after counts for each filter
- [ ] Budget ledger: requests, bytes, tokens used
- [ ] "Why keep/drop this block?" must be answerable from logs

#### ✅ 3.3 VMOTA Success Criteria
- [ ] Extract all 6 staff members correctly:
  - Katrina Bruins, Executive Director
  - Lauryn Dove, Administrative Assistant
  - Joel Ellazar, Marketing Specialist  
  - Armando Garcia, Curatorial and Education Manager
  - Jane La Motte, Website Manager
  - Nilufer Leuthold, Director of Development
- [ ] Clean bio text without "Staff" contamination
- [ ] Exclude Board of Directors from staff results
- [ ] Achieve >0.8 evaluation score

---

### **Phase 4: Advanced Intelligence (Future)**

#### ✅ 4.1 LLM-Guided Skills (Optional Enhancement)
- [ ] Replace hardcoded patterns with LLM calls for complex cases
- [ ] Implement cost-aware LLM usage with caching
- [ ] A/B test against improved DOM-based approach

#### ✅ 4.2 Multi-Strategy Ensemble
- [ ] Confidence-weighted combination of multiple extraction approaches
- [ ] Pattern-based + LLM-based + structure-based results
- [ ] Dynamic strategy selection based on page characteristics

---

## 🚀 Implementation Priority

**Week 1**: Phase 1 (items 1.1-1.7) - Core DOM architecture  
**Week 2**: Phase 2 (items 2.1-2.4) - Intelligent orchestration  
**Week 3**: Phase 3 (items 3.1-3.3) - Testing and VMOTA validation  
**Week 4**: Phase 4 (items 4.1-4.2) - Advanced enhancements

## Success Metrics
- [ ] VMOTA staff extraction: 6/6 correct with clean data
- [ ] Evaluation score: >0.8 (vs current 0.78)  
- [ ] Zero navigation/board contamination
- [ ] Generalizable to other staff pages without code changes
- [ ] Detailed audit trail for all decisions

## Technical Implementation Notes

### Key Dependencies
- [ ] Add `cheerio` for server-side DOM manipulation
- [ ] Consider `css-select` for advanced selector queries
- [ ] Implement simple logistic regression for block classification

### Architecture Changes
- [ ] Move from text-first to DOM-first processing
- [ ] Centralize threshold management in plan constraints
- [ ] Replace substring citations with selector-based evidence
- [ ] Add per-field confidence scoring

### Fast Wins (Immediate Impact)
1. DOM-first block discovery → names/titles stop merging
2. Block classifier + role words → "Board of Directors" no longer pollutes staff
3. Schema-guided MapFields → fewer null titles, cleaner bios  
4. Unified thresholds + per-field confidence → items stop disappearing between steps
5. Selector-based citations → quicker QA and better training signals

**Ready to proceed?** This plan addresses the core architectural issues while maintaining the learning-based approach without hardcoded site rules.