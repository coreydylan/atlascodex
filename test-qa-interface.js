/**
 * Test script for Q&A Interface functionality
 * Tests the Q&A service with sample extraction data
 */

const extractionQA = require('./api/services/extraction-qa');

// Sample extraction data for testing
const sampleProductData = [
  {
    name: "iPhone 15 Pro",
    price: 999,
    category: "Smartphones",
    rating: 4.8,
    inStock: true,
    description: "Latest iPhone with A17 Pro chip"
  },
  {
    name: "Samsung Galaxy S24",
    price: 899,
    category: "Smartphones", 
    rating: 4.7,
    inStock: true,
    description: "Premium Android smartphone with AI features"
  },
  {
    name: "MacBook Pro M3",
    price: 1999,
    category: "Laptops",
    rating: 4.9,
    inStock: false,
    description: "Professional laptop with M3 chip"
  },
  {
    name: "iPad Air",
    price: 599,
    category: "Tablets",
    rating: 4.6,
    inStock: true,
    description: "Versatile tablet for work and play"
  },
  {
    name: "AirPods Pro",
    price: 249,
    category: "Audio",
    rating: 4.5,
    inStock: true,
    description: "Premium wireless earbuds with noise cancellation"
  }
];

const sampleSalesData = [
  {
    month: "January",
    revenue: 50000,
    orders: 125,
    customers: 98
  },
  {
    month: "February", 
    revenue: 62000,
    orders: 145,
    customers: 112
  },
  {
    month: "March",
    revenue: 45000,
    orders: 98,
    customers: 87
  },
  {
    month: "April",
    revenue: 71000,
    orders: 168,
    customers: 134
  }
];

async function testQAInterface() {
  console.log('🧪 Testing Q&A Interface\n');
  
  try {
    // Test 1: Basic question about product data
    console.log('📱 Test 1: Product Data Q&A');
    console.log('Question: "What is the most expensive product?"');
    
    const result1 = await extractionQA.ask(sampleProductData, "What is the most expensive product?");
    console.log('Answer:', result1.answer);
    console.log('Confidence:', result1.confidence);
    console.log('Model used:', result1.model_used);
    console.log();

    // Test 2: Calculation question
    console.log('💰 Test 2: Calculation Query');
    console.log('Question: "Calculate the average price of all products"');
    
    const result2 = await extractionQA.ask(sampleProductData, "Calculate the average price of all products");
    console.log('Answer:', result2.answer);
    console.log('Details:', result2.details);
    console.log();

    // Test 3: Pattern analysis
    console.log('🔍 Test 3: Pattern Analysis');
    console.log('Question: "Find patterns in the product categories"');
    
    const result3 = await extractionQA.ask(sampleProductData, "Find patterns in the product categories and identify which category has the highest average rating");
    console.log('Answer:', result3.answer);
    console.log('Insights:', result3.insights);
    console.log();

    // Test 4: Sales data insights
    console.log('📊 Test 4: Sales Data Analysis');
    console.log('Analyzing sales data for insights...');
    
    const insights = await extractionQA.generateInsights(sampleSalesData);
    if (insights.success) {
      console.log('Key findings:', insights.insights.key_findings);
      console.log('Trends:', insights.insights.trends);
      console.log('Statistics:', insights.insights.statistics);
    } else {
      console.log('Insights generation failed:', insights.error);
    }
    console.log();

    // Test 5: Q&A Interface creation
    console.log('🎛️ Test 5: Q&A Interface Creation');
    const qaInterface = extractionQA.createQAInterface(sampleProductData);
    
    console.log('Interface methods available:');
    console.log('- ask(): Function available -', typeof qaInterface.ask === 'function');
    console.log('- insights(): Function available -', typeof qaInterface.insights === 'function');
    console.log('- analyze(): Function available -', typeof qaInterface.analyze === 'function');
    console.log('- count():', qaInterface.count());
    console.log('- fields():', qaInterface.fields());
    
    // Test the interface methods
    console.log('\nTesting interface methods:');
    const interfaceResult = await qaInterface.ask("Which products are out of stock?");
    console.log('Interface Q&A result:', interfaceResult.answer);
    console.log();

    // Test 6: Pattern analysis
    console.log('📈 Test 6: Pattern Analysis');
    const patternAnalysis = await extractionQA.analyzePatterns(sampleSalesData, 'temporal');
    if (patternAnalysis.success) {
      console.log('Pattern analysis completed');
      console.log('Temporal patterns:', patternAnalysis.analysis.patterns?.temporal);
      console.log('Anomalies found:', patternAnalysis.analysis.anomalies?.length || 0);
    } else {
      console.log('Pattern analysis failed:', patternAnalysis.error);
    }
    
    console.log('\n✅ Q&A Interface testing completed successfully!');

  } catch (error) {
    console.error('❌ Testing failed:', error);
    console.error('Error details:', error.message);
  }
}

// Test different data types
async function testDataTypes() {
  console.log('\n🔬 Testing Different Data Types\n');
  
  // Test with object (not array)
  const singleProduct = {
    name: "Test Product",
    price: 100,
    features: ["feature1", "feature2"],
    specs: {
      weight: "1kg",
      dimensions: "10x10x5cm"
    }
  };
  
  console.log('Testing with object data...');
  const objectResult = await extractionQA.ask(singleProduct, "What are the main features of this product?");
  console.log('Object Q&A result:', objectResult.answer);
  
  // Test with empty data
  console.log('\nTesting with empty data...');
  const emptyResult = await extractionQA.ask([], "What data is available?");
  console.log('Empty data result:', emptyResult.answer);
  
  console.log('\n✅ Data type testing completed!');
}

// Main test execution
async function runAllTests() {
  console.log('🚀 Starting Q&A Interface Comprehensive Testing\n');
  
  await testQAInterface();
  await testDataTypes();
  
  console.log('\n🎉 All tests completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testQAInterface,
  testDataTypes,
  runAllTests,
  sampleProductData,
  sampleSalesData
};