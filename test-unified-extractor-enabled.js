/**
 * Test script for Option C: Unified Extractor (ENABLED)
 * This test shows the unified extractor when enabled
 */

// Enable the unified extractor for this test
process.env.UNIFIED_EXTRACTOR_ENABLED = 'true';

const { processWithUnifiedExtractor, UNIFIED_EXTRACTOR_ENABLED } = require('./api/evidence-first-bridge');

// Test HTML content
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
    </ul>
</body>
</html>
`;

async function testEnabledUnifiedExtractor() {
    console.log('🎯 Testing Option C: Unified Extractor (ENABLED)');
    console.log('Feature flag enabled:', UNIFIED_EXTRACTOR_ENABLED);
    
    // Test department names extraction with unified extractor enabled
    console.log('\n=== Test: Department Names with Unified Extractor ===');
    try {
        const result = await processWithUnifiedExtractor(testHTML, {
            extractionInstructions: 'extract the names of all departments',
            url: 'https://test.edu/departments'
        });
        
        console.log('Success:', result.success);
        console.log('Processing method:', result.metadata?.processingMethod);
        
        if (result.metadata?.unifiedExtractor) {
            console.log('✅ Unified extractor was used!');
            console.log('Schema generated:', JSON.stringify(result.metadata.schema, null, 2));
            console.log('Processing time:', result.metadata.processingTime + 'ms');
            console.log('Validation successful:', result.metadata.validation?.valid);
            console.log('Phantom fields removed:', result.metadata.validation?.phantomFieldsRemoved);
        } else {
            console.log('🔄 Fallback was used');
            console.log('Fallback reason:', result.metadata?.fallbackReason);
        }
        
        console.log('Data:', JSON.stringify(result.data, null, 2));
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

// Run the test
testEnabledUnifiedExtractor()
    .then(() => {
        console.log('\n✅ Unified extractor enabled test completed');
        console.log('\nNote: If OpenAI API key is not configured, the system will gracefully fall back to the plan-based system.');
    })
    .catch(error => {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    });