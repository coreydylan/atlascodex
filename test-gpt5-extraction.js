#!/usr/bin/env node

// Test script for GPT-5 optimized extraction
const https = require('https');

const API_URL = 'https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev';
const API_KEY = 'test-key-123';

// Test 1: Simple extraction with GPT-5-nano
async function testSimpleExtraction() {
    console.log('\n🧪 Test 1: Simple extraction with GPT-5-nano');
    
    const data = JSON.stringify({
        url: 'https://example.com',
        prompt: 'Extract the main heading and any example text',
        model: 'gpt-5-nano'
    });
    
    const result = await makeRequest('/api/extract', data);
    console.log('✅ Job created:', result);
    
    if (result.jobId) {
        // Wait and check job status
        await new Promise(resolve => setTimeout(resolve, 5000));
        const status = await getJobStatus(result.jobId);
        console.log('📊 Job status:', status);
    }
    
    return result;
}

// Test 2: Autonomous extraction with multiple pages
async function testAutonomousExtraction() {
    console.log('\n🧪 Test 2: Autonomous extraction with GPT-5');
    
    const data = JSON.stringify({
        url: 'https://news.ycombinator.com',
        prompt: 'Extract the top 5 news headlines',
        autonomous: true,
        maxPages: 3,
        model: 'gpt-5-mini'
    });
    
    const result = await makeRequest('/api/extract', data);
    console.log('✅ Job created:', result);
    
    if (result.jobId) {
        // Monitor job progress
        let status;
        let attempts = 0;
        do {
            await new Promise(resolve => setTimeout(resolve, 10000));
            status = await getJobStatus(result.jobId);
            console.log(`📊 Attempt ${++attempts} - Status: ${status.status}`);
            
            if (status.partialResults) {
                console.log(`   Partial results: ${status.partialResults} pages processed`);
            }
        } while (status.status === 'processing' && attempts < 30);
        
        console.log('🎯 Final result:', JSON.stringify(status, null, 2));
    }
    
    return result;
}

// Helper function to make API requests
function makeRequest(path, data) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'gxi4vg8gla.execute-api.us-west-2.amazonaws.com',
            port: 443,
            path: '/dev' + path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY,
                'Content-Length': data.length
            }
        };
        
        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    resolve(JSON.parse(responseData));
                } catch (e) {
                    resolve(responseData);
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(data);
        req.end();
    });
}

// Get job status
function getJobStatus(jobId) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'gxi4vg8gla.execute-api.us-west-2.amazonaws.com',
            port: 443,
            path: `/dev/api/extract/${jobId}`,
            method: 'GET'
        };
        
        https.get(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

// Run tests
async function runTests() {
    console.log('🚀 Starting GPT-5 Extraction Tests');
    console.log('================================');
    
    try {
        // Test simple extraction
        await testSimpleExtraction();
        
        // Test autonomous extraction
        await testAutonomousExtraction();
        
        console.log('\n✅ All tests completed!');
        console.log('💰 Note: GPT-5 models are extremely cost-effective:');
        console.log('   - GPT-5-nano: $0.05/1M input tokens');
        console.log('   - GPT-5-mini: $0.25/1M input tokens');
        console.log('   - GPT-5: $1.25/1M input tokens');
        console.log('   - With caching: 90% discount on repeated contexts!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the tests
runTests();