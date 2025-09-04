/**
 * Test script for Option C: Unified Extractor
 * Tests the clean, simple unified extractor implementation
 */

const { processWithUnifiedExtractor, UNIFIED_EXTRACTOR_ENABLED } = require('./api/evidence-first-bridge');

// Test HTML content with department names
const testHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>University Departments</title>
</head>
<body>
    <h1>Academic Departments</h1>
    <ul>
        <li>Computer Science</li>
        <li>Biology</li>
        <li>Physics</li>
        <li>Mathematics</li>
        <li>Chemistry</li>
        <li>English Literature</li>
    </ul>
    
    <div class="staff-directory">
        <div class="person">
            <h3>Dr. John Smith</h3>
            <p>Professor of Computer Science</p>
            <a href="mailto:john.smith@university.edu">john.smith@university.edu</a>
        </div>
        <div class="person">
            <h3>Dr. Jane Doe</h3>
            <p>Associate Professor of Biology</p>
            <a href="mailto:jane.doe@university.edu">jane.doe@university.edu</a>
        </div>
    </div>
</body>
</html>
`;

async function testUnifiedExtractor() {
    console.log('🧪 Testing Option C: Unified Extractor');
    console.log('Feature flag enabled:', UNIFIED_EXTRACTOR_ENABLED);
    
    // Test 1: Simple department names extraction
    console.log('\n=== Test 1: Department Names ===');
    try {
        const result1 = await processWithUnifiedExtractor(testHTML, {
            extractionInstructions: 'extract the names of all departments',
            url: 'https://test.edu/departments'
        });
        
        console.log('Success:', result1.success);
        console.log('Processing method:', result1.metadata?.processingMethod);
        console.log('Data:', JSON.stringify(result1.data, null, 2));
        console.log('Unified extractor used:', result1.metadata?.unifiedExtractor);
        console.log('Fallback used:', result1.metadata?.fallbackUsed);
    } catch (error) {
        console.error('Test 1 failed:', error.message);
    }
    
    // Test 2: Staff information extraction
    console.log('\n=== Test 2: Staff Information ===');
    try {
        const result2 = await processWithUnifiedExtractor(testHTML, {
            extractionInstructions: 'extract staff names, titles, and email addresses',
            url: 'https://test.edu/staff'
        });
        
        console.log('Success:', result2.success);
        console.log('Processing method:', result2.metadata?.processingMethod);
        console.log('Data:', JSON.stringify(result2.data, null, 2));
        console.log('Schema used:', JSON.stringify(result2.metadata?.schema, null, 2));
        if (result2.metadata?.validation) {
            console.log('Phantom fields removed:', result2.metadata.validation.phantomFieldsRemoved);
        }
    } catch (error) {
        console.error('Test 2 failed:', error.message);
    }
    
    // Test 3: Test with feature flag disabled (should use plan-based fallback)
    console.log('\n=== Test 3: Feature Flag Disabled (if applicable) ===');
    if (!UNIFIED_EXTRACTOR_ENABLED) {
        console.log('Feature flag is already disabled - this test shows the fallback behavior');
        try {
            const result3 = await processWithUnifiedExtractor(testHTML, {
                extractionInstructions: 'extract department names',
                url: 'https://test.edu/departments'
            });
            
            console.log('Success:', result3.success);
            console.log('Processing method:', result3.metadata?.processingMethod);
            console.log('Unified extractor used:', result3.metadata?.unifiedExtractor);
            console.log('Fallback used:', result3.metadata?.fallbackUsed);
        } catch (error) {
            console.error('Test 3 failed:', error.message);
        }
    } else {
        console.log('Feature flag is enabled - to test fallback behavior, set UNIFIED_EXTRACTOR_ENABLED=false');
    }
}

// Run the tests
testUnifiedExtractor()
    .then(() => {
        console.log('\n✅ Unified extractor tests completed');
        console.log('\nTo enable the unified extractor in production:');
        console.log('Set environment variable: UNIFIED_EXTRACTOR_ENABLED=true');
        console.log('\nBy default, the system uses the existing plan-based system (HARD_DEFAULT = false)');
    })
    .catch(error => {
        console.error('\n❌ Test suite failed:', error.message);
        process.exit(1);
    });