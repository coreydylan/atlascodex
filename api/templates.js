// Atlas Codex Template System API Endpoints
// Production endpoints for template-driven extraction and display

const { templateService } = require('../packages/core/dist/template-service.js');

module.exports = async (req, res) => {
  const { method, body, query } = req;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const path = req.url.split('?')[0];

    // Template recommendations endpoint
    if (method === 'POST' && path === '/api/templates/recommend') {
      const { url, userQuery } = body;
      
      if (!url || !userQuery) {
        return res.status(400).json({ 
          error: 'Missing required fields: url and userQuery' 
        });
      }

      const recommendations = await templateService.getTemplateRecommendations(url, userQuery);
      
      return res.status(200).json({
        success: true,
        recommendations: recommendations.map(rec => ({
          templateId: rec.template.id,
          confidence: rec.confidence,
          accuracy: rec.template.success_metrics.accuracy,
          matchReasons: rec.match_reasons,
          provenance: rec.template.provenance
        })),
        count: recommendations.length
      });
    }

    // Template-enhanced extraction endpoint
    if (method === 'POST' && path === '/api/templates/extract') {
      const extractionRequest = {
        ...body,
        useTemplates: true,
        displayGeneration: body.generateDisplay || false
      };

      const result = await templateService.extractWithTemplates(extractionRequest);
      
      return res.status(200).json({
        success: result.success,
        data: result.data,
        template: result.template ? {
          id: result.template.id,
          confidence: result.template.confidence,
          matchReasons: result.template.match_reasons
        } : null,
        displaySpec: result.displaySpec,
        metadata: {
          extractionTime: result.metadata.extractionTime,
          cost: result.metadata.cost,
          strategy: result.strategy
        },
        error: result.error
      });
    }

    // Template statistics endpoint
    if (method === 'GET' && path === '/api/templates/stats') {
      const stats = await templateService.getTemplateStats();
      
      return res.status(200).json({
        success: true,
        stats: {
          totalExtractionTemplates: stats.totalExtractionTemplates,
          totalDisplayTemplates: stats.totalDisplayTemplates,
          avgAccuracy: stats.avgAccuracy,
          driftingTemplates: stats.driftingTemplates,
          templateUsage: stats.templateUsage
        }
      });
    }

    // Template evaluation endpoint
    if (method === 'GET' && path === '/api/templates/eval') {
      const { evaluationFramework } = require('../packages/core/dist/evaluation-framework.js');
      
      // Run a mini evaluation (first 3 test cases to avoid timeout)
      const { goldenTestCases } = require('../packages/core/dist/evaluation-framework.js');
      const testCases = goldenTestCases.slice(0, 3);
      
      const results = await Promise.all(
        testCases.map(testCase => evaluationFramework.evaluateTestCase(testCase))
      );

      const passed = results.filter(r => r.success).length;
      const avgAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0) / results.length;
      const totalCost = results.reduce((sum, r) => sum + r.cost, 0);

      return res.status(200).json({
        success: true,
        evaluation: {
          totalTests: results.length,
          passed,
          failed: results.length - passed,
          passRate: (passed / results.length * 100).toFixed(1) + '%',
          avgAccuracy: (avgAccuracy * 100).toFixed(1) + '%',
          totalCost: '$' + totalCost.toFixed(4),
          results: results.map(r => ({
            testName: r.testCase.name,
            success: r.success,
            accuracy: (r.accuracy * 100).toFixed(1) + '%',
            responseTime: r.responseTime.toFixed(2) + 's',
            templateUsed: r.templateUsed,
            error: r.errorMessage
          }))
        }
      });
    }

    // Health check endpoint
    if (method === 'GET' && path === '/api/templates/health') {
      return res.status(200).json({
        success: true,
        status: 'healthy',
        system: 'Atlas Codex Template System',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        features: {
          templateMatching: true,
          displayGeneration: true,
          evaluation: true,
          security: true,
          monitoring: true
        }
      });
    }

    return res.status(404).json({ error: 'Template API endpoint not found' });

  } catch (error) {
    console.error('Template API Error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};