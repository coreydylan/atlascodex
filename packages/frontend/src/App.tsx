import React, { useState, useEffect, useRef } from 'react';

/* Tailwind Classes Used:
bg-orange-500 text-white bg-gray-100 text-gray-700 hover:bg-gray-200
bg-orange-100 text-orange-600 border-orange-300 bg-gray-50 border-gray-200
hover:bg-gray-100 bg-orange-50 border-orange-200 hover:bg-gray-50
bg-white text-gray-900 text-gray-600 min-h-screen border-b
text-2xl font-semibold text-sm font-medium
*/
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronDown,
  Code,
  Copy,
  Download,
  FileText,
  Globe,
  Grid3x3,
  Loader2,
  Map,
  Search,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  FileJson,
  Image,
  Link2,
  ListTree,
  Sparkles,
  FileCode,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || process.env.REACT_APP_API_URL || 'https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev';

type Mode = 'scrape' | 'search' | 'map' | 'crawl';
type Format = 'markdown' | 'html' | 'json' | 'links' | 'screenshot' | 'summary';

interface Job {
  id: string;
  url: string;
  mode: Mode;
  format: Format;
  status: 'running' | 'success' | 'error';
  startedAt: string;
  completedAt?: string;
  result?: any;
  error?: string;
  options?: any;
}

// Natural language parser
function parseNaturalLanguage(input: string): { url?: string; mode?: Mode; format?: Format; params?: any } {
  const result: any = { params: {} };
  
  // Common patterns
  const patterns = {
    // Commands: "scrape example.com as markdown"
    scrapeCommand: /(?:scrape|extract|get|fetch)\s+(?:from\s+)?([^\s]+)(?:\s+as\s+(\w+))?/i,
    // Search: "search for X on example.com"
    searchCommand: /search\s+(?:for\s+)?["']?([^"']+)["']?\s+(?:on|in|from)\s+([^\s]+)/i,
    // Crawl: "crawl example.com with 5 pages"
    crawlCommand: /crawl\s+([^\s]+)(?:\s+(?:with|up\s+to)\s+(\d+)\s+pages?)?/i,
    // Map: "map example.com"
    mapCommand: /map\s+(?:out\s+)?([^\s]+)/i,
    // Format hints
    formatHint: /\b(markdown|html|json|links|screenshot|summary)\b/i,
    // URL extraction
    urlPattern: /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:\/[^\s]*)?)/
  };
  
  // Try search pattern first
  const searchMatch = input.match(patterns.searchCommand);
  if (searchMatch) {
    result.mode = 'search';
    result.url = searchMatch[2];
    result.params.searchQuery = searchMatch[1];
    return result;
  }
  
  // Try crawl pattern
  const crawlMatch = input.match(patterns.crawlCommand);
  if (crawlMatch) {
    result.mode = 'crawl';
    result.url = crawlMatch[1];
    if (crawlMatch[2]) {
      result.params.maxPages = parseInt(crawlMatch[2]);
    }
    return result;
  }
  
  // Try map pattern
  const mapMatch = input.match(patterns.mapCommand);
  if (mapMatch) {
    result.mode = 'map';
    result.url = mapMatch[1];
    return result;
  }
  
  // Try scrape/extract pattern
  const scrapeMatch = input.match(patterns.scrapeCommand);
  if (scrapeMatch) {
    result.mode = 'scrape';
    result.url = scrapeMatch[1];
    if (scrapeMatch[2]) {
      result.format = scrapeMatch[2].toLowerCase() as Format;
    }
    return result;
  }
  
  // Check for format hints
  const formatMatch = input.match(patterns.formatHint);
  if (formatMatch) {
    result.format = formatMatch[1].toLowerCase() as Format;
  }
  
  // Extract URL from anywhere in the text
  const urlMatch = input.match(patterns.urlPattern);
  if (urlMatch) {
    result.url = urlMatch[0];
    
    // Guess mode based on keywords
    if (input.includes('search')) result.mode = 'search';
    else if (input.includes('crawl')) result.mode = 'crawl';
    else if (input.includes('map')) result.mode = 'map';
    else result.mode = 'scrape';
  }
  
  // Handle simple URL input
  if (!result.url && input.includes('.')) {
    result.url = input.trim();
    result.mode = 'scrape';
  }
  
  return result;
}

function App() {
  const [mode, setMode] = useState<Mode>('scrape');
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<Format>('markdown');
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [useUnifiedExtractor, setUseUnifiedExtractor] = useState(false);
  
  // Options state - always visible
  const [includeHtml, setIncludeHtml] = useState(true);
  const [onlyMainContent, setOnlyMainContent] = useState(true);
  const [includeLinks, setIncludeLinks] = useState(false);
  const [waitForSelector, setWaitForSelector] = useState('');
  const [includeSubdomains, setIncludeSubdomains] = useState(false);
  const [maxCrawlDepth, setMaxCrawlDepth] = useState(3);
  const [limit, setLimit] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  
  const formatOptions: { value: Format; label: string; icon: React.ReactNode }[] = [
    { value: 'markdown', label: 'Markdown', icon: <FileText className="w-4 h-4" /> },
    { value: 'html', label: 'HTML', icon: <FileCode className="w-4 h-4" /> },
    { value: 'json', label: 'JSON', icon: <FileJson className="w-4 h-4" /> },
    { value: 'links', label: 'Links', icon: <Link2 className="w-4 h-4" /> },
    { value: 'screenshot', label: 'Screenshot', icon: <Image className="w-4 h-4" /> },
    { value: 'summary', label: 'Summary', icon: <Sparkles className="w-4 h-4" /> },
  ];

  const getModeConfig = (mode: Mode) => {
    switch (mode) {
      case 'scrape':
        return {
          icon: <Grid3x3 className="w-4 h-4" />,
          label: 'Scrape',
          action: 'Start scraping',
          description: 'Extract content from a single page',
        };
      case 'search':
        return {
          icon: <Search className="w-4 h-4" />,
          label: 'Search',
          action: 'Start searching',
          description: 'Search for specific content',
        };
      case 'map':
        return {
          icon: <Map className="w-4 h-4" />,
          label: 'Map',
          action: 'Start mapping',
          description: 'Generate a sitemap of all URLs',
        };
      case 'crawl':
        return {
          icon: <ListTree className="w-4 h-4" />,
          label: 'Crawl',
          action: 'Start crawling',
          description: 'Crawl entire website',
        };
    }
  };

  const handleStart = async () => {
    if (!url) return;
    
    setLoading(true);
    
    // If AI mode is enabled, process with AI first
    if (aiMode) {
      setAiProcessing(true);
      try {
        const aiResponse = await fetch(`${API_BASE}/api/ai/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': import.meta.env.VITE_API_KEY || process.env.REACT_APP_API_KEY || 'test-key-123',
          },
          body: JSON.stringify({
            prompt: url,
            autoExecute: true,
            UNIFIED_EXTRACTOR_ENABLED: useUnifiedExtractor
          })
        });
        
        if (aiResponse.ok) {
          const aiResult = await aiResponse.json();
          console.log('AI Processing Result:', aiResult);
          
          if (aiResult.jobId) {
            const newJob: Job = {
              id: aiResult.jobId,
              url: aiResult.aiProcessing?.url || aiResult.url || url,
              mode: aiResult.aiProcessing?.type as Mode || 'scrape',
              format: aiResult.aiProcessing?.formats?.[0] as Format || 'structured',
              status: aiResult.status === 'completed' ? 'success' : 'running',
              startedAt: new Date().toISOString(),
              options: aiResult.aiProcessing?.params,
              result: aiResult.status === 'completed' ? aiResult.result : undefined
            };
            
            setJobs([newJob, ...jobs]);
            setActiveJob(newJob);
            
            // Only poll if the job is not already completed
            if (aiResult.status !== 'completed') {
              pollJobStatus(aiResult.jobId, newJob.id);
            }
            setShowResult(true);
            setAiProcessing(false);
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.error('AI processing failed:', error);
      }
      setAiProcessing(false);
    }
    
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    
    const newJob: Job = {
      id: `job_${Date.now()}`,
      url: fullUrl,
      mode,
      format,
      status: 'running',
      startedAt: new Date().toISOString(),
      options: {
        includeHtml,
        onlyMainContent,
        includeLinks,
        waitForSelector,
        includeSubdomains,
        maxCrawlDepth,
        limit,
        searchQuery,
      },
    };
    
    setJobs([newJob, ...jobs]);
    setActiveJob(newJob);
    
    try {
      // Parse natural language input if it looks like a command
      let processedUrl = fullUrl;
      let extractedParams: any = {};
      
      // Check if we're in AI mode or input is natural language
      if (isAiMode || (!fullUrl.startsWith('http') && (fullUrl.includes(' ') || fullUrl.includes('scrape') || fullUrl.includes('extract')))) {
        // Call the AI processor endpoint for natural language processing
        try {
          const aiResponse = await fetch(`${API_BASE}/api/ai/process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': import.meta.env.VITE_API_KEY || process.env.REACT_APP_API_KEY || 'test-key-123',
            },
            body: JSON.stringify({
              prompt: fullUrl,
              autoExecute: false, // Get the structured params but don't auto-execute
              UNIFIED_EXTRACTOR_ENABLED: useUnifiedExtractor
            }),
          });
          
          if (aiResponse.ok) {
            const aiResult = await aiResponse.json();
            console.log('AI processing result:', aiResult);
            
            if (aiResult.url) {
              processedUrl = aiResult.url;
              extractedParams = aiResult.params || {};
              
              // Add formats from AI result
              if (aiResult.formats) {
                extractedParams.formats = aiResult.formats;
              }
              
              // Update UI state based on AI result
              if (aiResult.type) setMode(aiResult.type);
              if (aiResult.formats && aiResult.formats.length > 0) {
                // Map AI formats to UI format
                const primaryFormat = aiResult.formats[0];
                if (primaryFormat === 'structured') setFormat('json');
                else setFormat(primaryFormat);
              }
            }
          } else {
            // Fall back to local parsing if AI fails
            const nlpResult = parseNaturalLanguage(fullUrl);
            if (nlpResult.url) {
              processedUrl = nlpResult.url.startsWith('http') ? nlpResult.url : `https://${nlpResult.url}`;
              extractedParams = nlpResult.params;
              
              // Update UI state based on parsed params
              if (nlpResult.mode) setMode(nlpResult.mode);
              if (nlpResult.format) setFormat(nlpResult.format);
            }
          }
        } catch (aiError) {
          console.error('AI processing failed, falling back to local parsing:', aiError);
          // Fall back to local parsing
          const nlpResult = parseNaturalLanguage(fullUrl);
          if (nlpResult.url) {
            processedUrl = nlpResult.url.startsWith('http') ? nlpResult.url : `https://${nlpResult.url}`;
            extractedParams = nlpResult.params;
            
            // Update UI state based on parsed params
            if (nlpResult.mode) setMode(nlpResult.mode);
            if (nlpResult.format) setFormat(nlpResult.format);
          }
        }
      }
      
      // Evidence-First Processing: Let the backend intelligent system handle all template matching
      // No primitive keyword matching - all requests go through the evidence-first API
      console.log('🧠 Using evidence-first processing - backend will intelligently determine optimal extraction approach');

      // Use extract endpoint for all modes
      const endpoint = '/api/extract';
      
      const requestBody: any = {
        url: processedUrl,
        strategy: 'auto', // Let Evidence-First system choose the best strategy
        type: mode,
        useEvidenceFirst: true, // Enable evidence-first processing
        UNIFIED_EXTRACTOR_ENABLED: useUnifiedExtractor, // Add unified extractor flag
        ...extractedParams // This now includes extractionInstructions, outputSchema, postProcessing from AI
      };
      
      // Add format-specific options (only if not already set by AI)
      if (!requestBody.formats || requestBody.formats.length === 0) {
        const formats = [];
        if (format === 'markdown' || format === 'summary') {
          formats.push('markdown');
          requestBody.includeMarkdown = true;
        }
        if (format === 'html') {
          formats.push('html');
          requestBody.includeHtml = true;
        }
        if (format === 'links') {
          formats.push('links');
          requestBody.includeLinks = true;
        }
        if (format === 'screenshot') {
          formats.push('screenshot');
          requestBody.includeScreenshot = true;
        }
        if (format === 'json') {
          formats.push('json');
          requestBody.includeStructured = true;
        }
        if (format === 'summary') {
          formats.push('summary');
        }
        
        requestBody.formats = formats.length > 0 ? formats : ['markdown'];
      }
      
      // Add mode-specific options
      if (mode === 'crawl') {
        requestBody.type = 'crawl';
        requestBody.maxPages = limit || 10;
        requestBody.includeSubdomains = includeSubdomains;
        requestBody.maxDepth = maxCrawlDepth;
      } else if (mode === 'search') {
        requestBody.type = 'search';
        requestBody.searchQuery = searchQuery || extractedParams.searchQuery;
      } else if (mode === 'map') {
        requestBody.type = 'map';
        requestBody.includeSubdomains = includeSubdomains;
      }
      
      console.log('Sending extraction request:', requestBody);
      
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || 'atlas-prod-key-2024',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      
      // Check if it's an async job or direct result
      if (data.jobId) {
        // Async job - poll for status using the jobId
        console.log('Starting to poll job:', data.jobId);
        pollJobStatus(data.jobId, newJob.id);
        
        // Show the job is processing
        updateJob(newJob.id, {
          result: { status: 'Processing...', jobId: data.jobId },
        });
        setShowResult(true);
      } else if (data.job && data.job.id) {
        // Alternative async job format
        console.log('Starting to poll job (alt format):', data.job.id);
        pollJobStatus(data.job.id, newJob.id);
        
        updateJob(newJob.id, {
          result: { status: 'Processing...', jobId: data.job.id },
        });
        setShowResult(true);
      } else if (data.success === false) {
        throw new Error(data.error || 'Extraction failed');
      } else {
        // Direct result
        updateJob(newJob.id, {
          status: 'success',
          completedAt: new Date().toISOString(),
          result: data.data || data,
        });
        setShowResult(true);
      }
    } catch (error: any) {
      updateJob(newJob.id, {
        status: 'error',
        completedAt: new Date().toISOString(),
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const pollJobStatus = async (jobId: string, localJobId: string) => {
    let pollCount = 0;
    const maxPolls = 60; // Poll for up to 2 minutes
    
    const interval = setInterval(async () => {
      pollCount++;
      
      try {
        console.log(`Polling job ${jobId} (attempt ${pollCount}/${maxPolls})`);
        
        // Use the correct /api/extract/{jobId} endpoint
        let response = await fetch(`${API_BASE}/api/extract/${jobId}`, {
          headers: {
            'x-api-key': import.meta.env.VITE_API_KEY || process.env.REACT_APP_API_KEY || 'test-key-123',
          },
        });
        
        if (!response.ok) {
          console.error('Failed to poll job status:', response.status);
          
          // If we get a 404, the job might not exist yet, keep polling for a bit
          if (response.status === 404 && pollCount < 5) {
            updateJob(localJobId, {
              result: { 
                status: `Waiting for job... (${pollCount}/${maxPolls})`,
                jobId,
                message: 'Job is being created...'
              },
            });
            return;
          }
          
          // For other errors or persistent 404s, fail immediately
          if (response.status !== 404 || pollCount >= 5) {
            clearInterval(interval);
            const errorText = await response.text().catch(() => 'Unknown error');
            updateJob(localJobId, {
              status: 'error',
              completedAt: new Date().toISOString(),
              error: `API Error (${response.status}): ${errorText}`,
            });
            return;
          }
          
          if (pollCount >= maxPolls) {
            clearInterval(interval);
            updateJob(localJobId, {
              status: 'error',
              completedAt: new Date().toISOString(),
              error: 'Job polling timeout - extraction took too long',
            });
          }
          return;
        }
        
        const data = await response.json();
        console.log('Job poll response:', data);
        
        // Check various status fields
        const status = data.status || data.jobStatus;
        
        if (status === 'completed' || status === 'complete' || status === 'success') {
          clearInterval(interval);
          const result = data.result || data.data || data.extraction || data;
          console.log('Job completed with result:', result);
          
          updateJob(localJobId, {
            status: 'success',
            completedAt: new Date().toISOString(),
            result: result,
          });
          setShowResult(true);
        } else if (status === 'failed' || status === 'error') {
          clearInterval(interval);
          updateJob(localJobId, {
            status: 'error',
            completedAt: new Date().toISOString(),
            error: data.error || data.message || 'Job failed',
          });
        } else if (data.data || data.result || data.extraction) {
          // Sometimes the result is returned directly without a status
          clearInterval(interval);
          const result = data.data || data.result || data.extraction;
          console.log('Got direct result:', result);
          
          updateJob(localJobId, {
            status: 'success',
            completedAt: new Date().toISOString(),
            result: result,
          });
          setShowResult(true);
        } else {
          // Still processing
          updateJob(localJobId, {
            result: { 
              status: status || 'processing',
              jobId,
              message: `Processing... (${pollCount}/${maxPolls})`,
              details: data
            },
          });
        }
      } catch (error) {
        console.error('Poll error:', error);
        updateJob(localJobId, {
          result: { 
            status: 'polling',
            jobId,
            message: `Polling... (${pollCount}/${maxPolls})`,
            error: error.message
          },
        });
      }
    }, 2000);
    
    // Clean up after 5 minutes
    setTimeout(() => clearInterval(interval), 300000);
  };

  const updateJob = (jobId: string, updates: Partial<Job>) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === jobId ? { ...job, ...updates } : job))
    );
    if (activeJob?.id === jobId) {
      setActiveJob((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  const config = getModeConfig(mode);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Atlas Codex</h1>
            <Badge variant="outline">API Connected</Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Mode Selector - Hidden in AI Mode */}
          {!aiMode && (
            <div className="flex gap-2 mb-6">
              {(['scrape', 'search', 'map', 'crawl'] as Mode[]).map((m) => {
                const mConfig = getModeConfig(m);
                return (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={
                      mode === m
                        ? 'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all bg-orange-500 text-white'
                        : 'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  >
                    {mConfig.icon}
                    {mConfig.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* AI Mode Banner */}
          {aiMode && (
            <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-purple-900">AI-Powered Mode</h3>
              </div>
              <p className="text-sm text-purple-700 mb-3">
                Describe what you want in natural language, and AI will handle the rest.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-white rounded border border-purple-100">
                  <strong>Example:</strong> "Get all product prices from amazon bestsellers"
                </div>
                <div className="p-2 bg-white rounded border border-purple-100">
                  <strong>Example:</strong> "Find AI news on techcrunch and summarize"
                </div>
                <div className="p-2 bg-white rounded border border-purple-100">
                  <strong>Example:</strong> "Map out the React documentation site"
                </div>
                <div className="p-2 bg-white rounded border border-purple-100">
                  <strong>Example:</strong> "Extract all blog titles from medium.com"
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Input Panel */}
            <div className="lg:col-span-2 space-y-6">
              {/* URL Input */}
              <Card className={aiMode ? 'border-purple-200 shadow-lg' : ''}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-center mb-3">
                    <Label htmlFor="url" className={`text-sm font-medium ${aiMode ? 'text-purple-900' : ''}`}>
                      {aiMode ? '🤖 Describe what you want to extract' : `URL to ${mode}`}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="ai-mode" className="text-xs text-gray-500">
                        {aiMode ? '✨ AI Mode Active' : 'Enable AI Mode'}
                      </Label>
                      <Switch
                        id="ai-mode"
                        checked={aiMode}
                        onCheckedChange={setAiMode}
                        className={aiMode ? 'data-[state=checked]:bg-purple-600' : ''}
                      />
                    </div>
                  </div>
                  {aiMode ? (
                    <>
                      <div className="space-y-3">
                        <textarea
                          id="url"
                          placeholder="Describe what you want to extract in plain English...

Examples:
• Get all product prices and reviews from amazon.com/bestsellers
• Find recent articles about artificial intelligence on techcrunch
• Extract all documentation pages from react.dev
• Search for climate change news on nytimes and summarize each article
• Crawl the first 10 pages of reddit.com/r/technology and get post titles"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          className="w-full min-h-[120px] p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey && !loading) {
                              handleStart();
                            }
                          }}
                        />
                        <Button
                          onClick={handleStart}
                          disabled={loading || !url}
                          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {aiProcessing ? '🤖 AI is analyzing your request...' : 'Processing...'}
                            </>
                          ) : (
                            <>
                              <Sparkles className="mr-2 h-4 w-4" />
                              Generate & Execute with AI
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-gray-500">Press Ctrl+Enter to submit</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <Input
                          id="url"
                          placeholder="Enter URL (e.g., example.com)"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !loading) {
                              handleStart();
                            }
                          }}
                        />
                        <Button
                          onClick={handleStart}
                          disabled={loading || !url}
                          className="bg-orange-500 hover:bg-orange-600 text-white min-w-[140px]"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Processing
                            </>
                          ) : (
                            config.action
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">{config.description}</p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Format Selector - Hidden in AI Mode */}
              {!aiMode && (
                <Card>
                  <CardContent className="p-6">
                    <Label className="text-sm font-medium mb-3 block">Output Format</Label>
                    <div className="grid grid-cols-3 gap-2">
                    {formatOptions.map((fmt) => (
                      <button
                        key={fmt.value}
                        onClick={() => setFormat(fmt.value)}
                        className={
                          format === fmt.value
                            ? 'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all bg-orange-100 text-orange-600 border border-orange-300'
                            : 'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                        }
                      >
                        {fmt.icon}
                        {fmt.label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

              {/* Clear Result Display */}
              {activeJob && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>
                        {activeJob.status === 'running' && '⏳ Processing...'}
                        {activeJob.status === 'success' && '✅ Extraction Complete'}
                        {activeJob.status === 'error' && '❌ Extraction Failed'}
                      </span>
                      {activeJob.status === 'success' && activeJob.result && (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(JSON.stringify(activeJob.result, null, 2))}>
                            <Copy className="w-4 h-4 mr-1" />
                            Copy
                          </Button>
                          <Button variant="outline" size="sm">
                            <Download className="w-4 h-4 mr-1" />
                            Export
                          </Button>
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activeJob.status === 'error' && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="text-red-800 font-medium mb-2">Error Details:</div>
                        <div className="text-red-700 text-sm">{activeJob.error || 'Unknown error occurred'}</div>
                      </div>
                    )}
                    
                    {activeJob.status === 'running' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-blue-800">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="font-medium">Extraction in progress...</span>
                        </div>
                        {activeJob.result?.message && (
                          <div className="text-blue-700 text-sm mt-2">{activeJob.result.message}</div>
                        )}
                      </div>
                    )}
                    
                    {activeJob.status === 'success' && activeJob.result && (
                      <div className="space-y-4">
                        {/* Show extracted data clearly */}
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">📄 Extracted Data</h4>
                          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-auto border">
                            {(() => {
                              // Extract the actual data from the result structure
                              let displayData = activeJob.result;
                              
                              // If result has a data property, use that (from API response)
                              if (displayData?.data) {
                                displayData = displayData.data;
                              }
                              
                              // Check for malformed data and show warning
                              const jsonString = JSON.stringify(displayData, null, 2);
                              const isMalformed = jsonString.includes('{"name":"') && jsonString.includes('Director') && jsonString.includes('bio":""}');
                              
                              if (isMalformed) {
                                return (
                                  <div className="space-y-3">
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                      <div className="text-amber-800 text-sm">
                                        ⚠️ <strong>Data Quality Issue:</strong> Names, titles, and bios appear to be concatenated into single strings instead of separate person objects. This will be fixed in the next system update.
                                      </div>
                                    </div>
                                    <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800">
                                      {jsonString}
                                    </pre>
                                  </div>
                                );
                              }
                              
                              // Check if this looks like team member data for card view
                              const isTeamMemberData = Array.isArray(displayData) && displayData.length > 0 && 
                                displayData.some(item => 
                                  item.heading && 
                                  item.block_text && 
                                  (item.role_hints || item.predicted_type === 'profile_card')
                                );
                              
                              if (isTeamMemberData) {
                                return (
                                  <div className="space-y-4">
                                    <div className="text-sm text-gray-600 mb-4">
                                      Found {displayData.length} team member{displayData.length !== 1 ? 's' : ''}
                                    </div>
                                    <div className="grid gap-4">
                                      {displayData.map((person, index) => {
                                        // Extract name and title from block_text
                                        const name = person.heading || 'Unknown';
                                        const blockText = person.block_text || '';
                                        
                                        // Try to extract title from the beginning of block_text
                                        const titleMatch = blockText.match(new RegExp(`${name}([^\\n]*?)(?:\\n|$)`));
                                        const title = titleMatch ? titleMatch[1].trim() : 
                                          (person.role_hints && person.role_hints.length > 0 ? 
                                            person.role_hints[0].charAt(0).toUpperCase() + person.role_hints[0].slice(1) : 
                                            'Team Member');
                                        
                                        // Extract bio (everything after name+title)
                                        const bioStart = blockText.indexOf(title) + title.length;
                                        const bio = bioStart > title.length ? blockText.substring(bioStart).trim() : blockText;
                                        
                                        return (
                                          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-start justify-between mb-3">
                                              <div>
                                                <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
                                                <p className="text-sm font-medium text-blue-600">{title}</p>
                                              </div>
                                              {person.type_confidence && (
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                                  {(person.type_confidence * 100).toFixed(0)}% confident
                                                </span>
                                              )}
                                            </div>
                                            {bio && bio !== name && (
                                              <p className="text-sm text-gray-700 leading-relaxed">{bio}</p>
                                            )}
                                            {person.role_hints && person.role_hints.length > 0 && (
                                              <div className="mt-3 flex flex-wrap gap-1">
                                                {person.role_hints.slice(0, 3).map((role, roleIndex) => (
                                                  <span key={roleIndex} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                                    {role}
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              }
                              
                              // Display clean, well-formatted data for non-team-member results
                              return (
                                <pre className="text-sm font-mono whitespace-pre-wrap text-gray-800 leading-relaxed">
                                  {jsonString}
                                </pre>
                              );
                            })()}
                          </div>
                        </div>
                        
                        {/* Processing Method Badge */}
                        {activeJob.result?.metadata?.processingMethod && (
                          <div className="mb-3">
                            {activeJob.result.metadata.processingMethod === 'unified_extractor_option_c' ? (
                              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                  <span className="text-sm font-semibold text-green-900">Unified Extractor (Option C)</span>
                                </div>
                                <p className="text-xs text-green-700">
                                  Used AI-powered unified extraction with strict AJV validation
                                  {activeJob.result.metadata.validation?.phantomFieldsRemoved > 0 && (
                                    <span> • Removed {activeJob.result.metadata.validation.phantomFieldsRemoved} phantom fields</span>
                                  )}
                                </p>
                              </div>
                            ) : activeJob.result.metadata.processingMethod.includes('plan_based') ? (
                              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <Sparkles className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm font-semibold text-blue-900">Plan-Based Extraction</span>
                                  {activeJob.result.metadata.fallbackUsed && (
                                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full ml-2">Fallback</span>
                                  )}
                                </div>
                                <p className="text-xs text-blue-700">
                                  Used traditional plan-based extraction system
                                  {activeJob.result.metadata.fallbackReason && (
                                    <span> • Fallback reason: {activeJob.result.metadata.fallbackReason}</span>
                                  )}
                                </p>
                              </div>
                            ) : activeJob.result?.templateEnhanced ? (
                              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <Sparkles className="w-4 h-4 text-purple-600" />
                                  <span className="text-sm font-semibold text-purple-900">Template-Enhanced Extraction</span>
                                </div>
                                <p className="text-xs text-purple-700">
                                  Used intelligent template matching for {activeJob.result.metadata?.templateId || 'optimized'} extraction pattern
                                </p>
                              </div>
                            ) : null}
                          </div>
                        )}
                        
                        {/* Show metadata if available */}
                        {activeJob.result?.metadata && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">📊 Extraction Info</h4>
                            <div className="bg-blue-50 rounded-lg p-3 text-sm">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {activeJob.result.metadata.processingTime && (
                                  <div><span className="text-gray-600">Duration:</span> {activeJob.result.metadata.processingTime}ms</div>
                                )}
                                {activeJob.result.metadata.duration && (
                                  <div><span className="text-gray-600">Duration:</span> {activeJob.result.metadata.duration}ms</div>
                                )}
                                {activeJob.result.metadata.processingMethod && (
                                  <div><span className="text-gray-600">Method:</span> {activeJob.result.metadata.processingMethod.replace(/unified_extractor_option_c/, 'Unified Extractor').replace(/plan_based/, 'Plan-Based')}</div>
                                )}
                                {activeJob.result.metadata.unifiedExtractor !== undefined && (
                                  <div><span className="text-gray-600">Unified:</span> {activeJob.result.metadata.unifiedExtractor ? 'Yes' : 'No'}</div>
                                )}
                                {activeJob.result.metadata.cost && (
                                  <div><span className="text-gray-600">Cost:</span> ${activeJob.result.metadata.cost.toFixed(4)}</div>
                                )}
                                {activeJob.result.metadata.strategy && (
                                  <div><span className="text-gray-600">Strategy:</span> {activeJob.result.metadata.strategy}</div>
                                )}
                                {activeJob.result.metadata.itemsExtracted && (
                                  <div><span className="text-gray-600">Items Found:</span> {activeJob.result.metadata.itemsExtracted}</div>
                                )}
                                {activeJob.result.metadata.validation?.originalDataLength && (
                                  <div><span className="text-gray-600">Items Found:</span> {activeJob.result.metadata.validation.originalDataLength}</div>
                                )}
                                {activeJob.result.metadata.source && (
                                  <div><span className="text-gray-600">Source:</span> {activeJob.result.metadata.source}</div>
                                )}
                                {activeJob.result.metadata.templateId && (
                                  <div><span className="text-gray-600">Template:</span> {activeJob.result.metadata.templateId}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Options Panel - Always Visible */}
            <div className="space-y-6">
              {/* Extraction Options */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Unified Extractor Option - Available in all modes */}
                  <div className="flex items-center justify-between">
                    <Label htmlFor="unified-extractor" className="text-sm font-medium">
                      {aiMode ? 'AI-Powered Unified Extraction' : 'Use Unified Extractor (Option C)'}
                    </Label>
                    <Switch
                      id="unified-extractor"
                      checked={useUnifiedExtractor}
                      onCheckedChange={setUseUnifiedExtractor}
                    />
                  </div>
                  {useUnifiedExtractor && (
                    <div className={aiMode ? 
                      "bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-3" :
                      "bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3"
                    }>
                      <div className="flex items-center gap-2 mb-1">
                        {aiMode ? <Sparkles className="w-4 h-4 text-purple-600" /> : <CheckCircle className="w-4 h-4 text-green-600" />}
                        <span className={aiMode ? "text-xs font-semibold text-purple-900" : "text-xs font-semibold text-green-900"}>
                          {aiMode ? 'AI-Powered Unified Extraction' : 'Unified Extractor Enabled'}
                        </span>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">Experimental</span>
                      </div>
                      <p className={aiMode ? "text-xs text-purple-700" : "text-xs text-green-700"}>
                        {aiMode ? 
                          'AI will intelligently analyze your request and use unified extraction for optimal results.' :
                          'AI-powered unified extraction with strict AJV validation. Clean fallback to plan-based system if needed.'
                        }
                      </p>
                    </div>
                  )}
                  <div className="border-t pt-4" />
                  {mode === 'scrape' && (
                    <>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="include-html" className="text-sm">
                          Include HTML
                        </Label>
                        <Switch
                          id="include-html"
                          checked={includeHtml}
                          onCheckedChange={setIncludeHtml}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="main-content" className="text-sm">
                          Only Main Content
                        </Label>
                        <Switch
                          id="main-content"
                          checked={onlyMainContent}
                          onCheckedChange={setOnlyMainContent}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="include-links" className="text-sm">
                          Include Links
                        </Label>
                        <Switch
                          id="include-links"
                          checked={includeLinks}
                          onCheckedChange={setIncludeLinks}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="wait-selector" className="text-sm">
                          Wait for Selector
                        </Label>
                        <Input
                          id="wait-selector"
                          placeholder=".content, #main"
                          value={waitForSelector}
                          onChange={(e) => setWaitForSelector(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </>
                  )}
                  
                  {mode === 'crawl' && (
                    <>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="subdomains" className="text-sm">
                          Include Subdomains
                        </Label>
                        <Switch
                          id="subdomains"
                          checked={includeSubdomains}
                          onCheckedChange={setIncludeSubdomains}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="max-depth" className="text-sm">
                          Max Crawl Depth: {maxCrawlDepth}
                        </Label>
                        <input
                          type="range"
                          id="max-depth"
                          min="1"
                          max="10"
                          value={maxCrawlDepth}
                          onChange={(e) => setMaxCrawlDepth(Number(e.target.value))}
                          className="w-full"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="limit" className="text-sm">
                          Page Limit: {limit}
                        </Label>
                        <input
                          type="range"
                          id="limit"
                          min="1"
                          max="100"
                          value={limit}
                          onChange={(e) => setLimit(Number(e.target.value))}
                          className="w-full"
                        />
                      </div>
                    </>
                  )}
                  
                  {mode === 'search' && (
                    <div className="space-y-2">
                      <Label htmlFor="search-query" className="text-sm">
                        Search Query
                      </Label>
                      <Input
                        id="search-query"
                        placeholder="Enter search terms..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  )}
                  
                  {mode === 'map' && (
                    <div className="flex items-center justify-between">
                      <Label htmlFor="map-subdomains" className="text-sm">
                        Include Subdomains
                      </Label>
                      <Switch
                        id="map-subdomains"
                        checked={includeSubdomains}
                        onCheckedChange={setIncludeSubdomains}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Jobs */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Jobs</CardTitle>
                </CardHeader>
                <CardContent>
                  {jobs.length === 0 ? (
                    <p className="text-sm text-gray-500">No jobs yet</p>
                  ) : (
                    <div className="space-y-2">
                      {jobs.slice(0, 5).map((job) => (
                        <button
                          key={job.id}
                          onClick={() => {
                            setActiveJob(job);
                            setShowResult(true);
                          }}
                          className={
                            activeJob?.id === job.id
                              ? 'w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all bg-orange-50 border border-orange-200'
                              : 'w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all hover:bg-gray-50'
                          }
                        >
                          {job.status === 'running' && (
                            <Loader2 className="w-4 h-4 text-orange-500 animate-spin flex-shrink-0" />
                          )}
                          {job.status === 'success' && (
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          )}
                          {job.status === 'error' && (
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {job.url ? job.url.replace(/^https?:\/\//, '') : 'AI Generated'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {job.mode} • {new Date(job.startedAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* API Code */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    API Code
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs font-mono">
                    <div className="text-green-400"># {aiMode && useUnifiedExtractor ? 'AI-Powered Unified Extraction API' : config.label + ' API' + (useUnifiedExtractor ? ' (Unified Extractor)' : '')}</div>
                    <div className="text-blue-400">curl</div> -X POST \<br />
                    &nbsp;&nbsp;{API_BASE}/api/extract \<br />
                    &nbsp;&nbsp;-H <span className="text-yellow-300">"x-api-key: YOUR_KEY"</span> \<br />
                    &nbsp;&nbsp;-d '{JSON.stringify({ 
                      url: url || 'example.com', 
                      type: mode, 
                      format,
                      ...(useUnifiedExtractor && { UNIFIED_EXTRACTOR_ENABLED: true })
                    }, null, 2)}'
                  </div>
                  <Button variant="outline" size="sm" className="mt-3 w-full">
                    <Copy className="w-4 h-4 mr-1" />
                    Copy Code
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;