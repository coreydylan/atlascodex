import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  Play,
  Download,
  Copy,
  ChevronRight,
  Database,
  Users,
  Building,
  Package,
  FileJson,
  ListTree,
  Grid3x3,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  Code,
  Table,
  BarChart3,
  Zap,
  Brain,
  Target,
  Search,
  Filter,
  Layout,
  Layers,
  PlusCircle,
  Settings,
  BookOpen,
  FileText,
  Image as ImageIcon,
  Link2,
  Calendar,
  MapPin,
  Phone,
  Mail,
  DollarSign,
  Tag,
  Hash,
  Globe,
  User,
  Briefcase,
  GraduationCap,
  Heart,
  Star,
  TrendingUp,
  Activity,
  Cpu,
  GitBranch,
  Box,
  Folder,
  MessageCircle
} from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'https://gxi4vg8gla.execute-api.us-west-2.amazonaws.com/dev';

// Preset extraction templates
const EXTRACTION_PRESETS = {
  people: {
    name: 'People & Contacts',
    icon: Users,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    instructions: 'Extract information about people including names, titles, roles, contact information, and biographical details',
    schema: {
      type: 'object',
      properties: {
        people: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              title: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              department: { type: 'string' },
              bio: { type: 'string' },
              image_url: { type: 'string' },
              social_links: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        total_count: { type: 'number' },
        departments: { type: 'array', items: { type: 'string' } }
      }
    }
  },
  products: {
    name: 'Products & Services',
    icon: Package,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    instructions: 'Extract product or service information including names, descriptions, prices, features, and availability',
    schema: {
      type: 'object',
      properties: {
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              price: { type: 'string' },
              features: { type: 'array', items: { type: 'string' } },
              category: { type: 'string' },
              availability: { type: 'string' },
              image_url: { type: 'string' },
              rating: { type: 'number' }
            }
          }
        },
        categories: { type: 'array', items: { type: 'string' } },
        price_range: { type: 'object', properties: { min: { type: 'number' }, max: { type: 'number' } } }
      }
    }
  },
  events: {
    name: 'Events & Schedule',
    icon: Calendar,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    instructions: 'Extract event information including dates, times, locations, descriptions, and registration details',
    schema: {
      type: 'object',
      properties: {
        events: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              date: { type: 'string' },
              time: { type: 'string' },
              location: { type: 'string' },
              description: { type: 'string' },
              registration_url: { type: 'string' },
              price: { type: 'string' },
              capacity: { type: 'number' },
              speakers: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        total_events: { type: 'number' },
        date_range: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } } }
      }
    }
  },
  articles: {
    name: 'Articles & Blog Posts',
    icon: FileText,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    instructions: 'Extract article or blog post information including titles, authors, dates, summaries, and content',
    schema: {
      type: 'object',
      properties: {
        articles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              author: { type: 'string' },
              date: { type: 'string' },
              summary: { type: 'string' },
              content: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              url: { type: 'string' },
              image_url: { type: 'string' },
              read_time: { type: 'string' }
            }
          }
        },
        total_articles: { type: 'number' },
        categories: { type: 'array', items: { type: 'string' } },
        authors: { type: 'array', items: { type: 'string' } }
      }
    }
  },
  company: {
    name: 'Company Information',
    icon: Building,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50',
    instructions: 'Extract company information including overview, mission, values, history, and key facts',
    schema: {
      type: 'object',
      properties: {
        company_name: { type: 'string' },
        tagline: { type: 'string' },
        description: { type: 'string' },
        founded: { type: 'string' },
        headquarters: { type: 'string' },
        employees: { type: 'string' },
        industry: { type: 'string' },
        website: { type: 'string' },
        social_media: { type: 'object' },
        key_people: { type: 'array', items: { type: 'object' } },
        products_services: { type: 'array', items: { type: 'string' } },
        mission: { type: 'string' },
        values: { type: 'array', items: { type: 'string' } }
      }
    }
  },
  faq: {
    name: 'FAQ & Q&A',
    icon: MessageCircle,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-50',
    instructions: 'Extract questions and answers, FAQ items, or help content',
    schema: {
      type: 'object',
      properties: {
        faqs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              answer: { type: 'string' },
              category: { type: 'string' },
              related_links: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        categories: { type: 'array', items: { type: 'string' } },
        total_questions: { type: 'number' }
      }
    }
  }
};

// Icon component for dynamic field types
const FieldIcon = ({ fieldName, value }: { fieldName: string; value: any }) => {
  const name = fieldName.toLowerCase();
  
  if (name.includes('email')) return <Mail className="w-4 h-4" />;
  if (name.includes('phone')) return <Phone className="w-4 h-4" />;
  if (name.includes('price') || name.includes('cost')) return <DollarSign className="w-4 h-4" />;
  if (name.includes('date')) return <Calendar className="w-4 h-4" />;
  if (name.includes('location') || name.includes('address')) return <MapPin className="w-4 h-4" />;
  if (name.includes('url') || name.includes('link')) return <Link2 className="w-4 h-4" />;
  if (name.includes('image') || name.includes('photo')) return <ImageIcon className="w-4 h-4" />;
  if (name.includes('tag') || name.includes('category')) return <Tag className="w-4 h-4" />;
  if (name.includes('user') || name.includes('person')) return <User className="w-4 h-4" />;
  if (name.includes('company') || name.includes('organization')) return <Building className="w-4 h-4" />;
  if (name.includes('title') || name.includes('role')) return <Briefcase className="w-4 h-4" />;
  if (name.includes('description') || name.includes('bio')) return <FileText className="w-4 h-4" />;
  if (name.includes('rating') || name.includes('score')) return <Star className="w-4 h-4" />;
  if (typeof value === 'number') return <Hash className="w-4 h-4" />;
  if (Array.isArray(value)) return <ListTree className="w-4 h-4" />;
  if (typeof value === 'object') return <Box className="w-4 h-4" />;
  
  return <FileJson className="w-4 h-4" />;
};

// Dynamic data visualizer component
const DataVisualizer = ({ data, schema }: { data: any; schema?: any }) => {
  if (!data) return null;

  // Auto-detect visualization type based on data structure
  const renderValue = (value: any, key: string = '', depth: number = 0) => {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">empty</span>;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-gray-400 italic">no items</span>;
      }

      // Check if it's an array of objects (table-like data)
      if (value.every(item => typeof item === 'object' && !Array.isArray(item))) {
        return (
          <div className="mt-2">
            <div className="grid gap-3">
              {value.map((item, idx) => (
                <Card key={idx} className="bg-gray-50 border-gray-200">
                  <CardContent className="pt-4">
                    <div className="grid gap-2">
                      {Object.entries(item).map(([k, v]) => (
                        <div key={k} className="flex items-start gap-2">
                          <FieldIcon fieldName={k} value={v} />
                          <div className="flex-1">
                            <Label className="text-xs text-gray-500">{k.replace(/_/g, ' ')}</Label>
                            <div className="text-sm">{renderValue(v, k, depth + 1)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      }

      // Simple array
      return (
        <div className="flex flex-wrap gap-1 mt-1">
          {value.map((item, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {renderValue(item, '', depth + 1)}
            </Badge>
          ))}
        </div>
      );
    }

    // Handle objects
    if (typeof value === 'object') {
      return (
        <div className="ml-4 mt-2 space-y-2 border-l-2 border-gray-200 pl-4">
          {Object.entries(value).map(([k, v]) => (
            <div key={k}>
              <div className="flex items-start gap-2">
                <FieldIcon fieldName={k} value={v} />
                <div className="flex-1">
                  <Label className="text-xs text-gray-500">{k.replace(/_/g, ' ')}</Label>
                  <div className="text-sm">{renderValue(v, k, depth + 1)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Handle primitive values with special formatting
    if (typeof value === 'string') {
      // URLs
      if (value.startsWith('http')) {
        return (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
            {value} <Link2 className="w-3 h-3" />
          </a>
        );
      }
      // Emails
      if (value.includes('@')) {
        return (
          <a href={`mailto:${value}`} className="text-blue-500 hover:underline">
            {value}
          </a>
        );
      }
      // Long text
      if (value.length > 200) {
        return (
          <div className="text-sm text-gray-700 mt-1 p-2 bg-gray-50 rounded">
            {value}
          </div>
        );
      }
    }

    // Default rendering
    return <span className="text-gray-900">{String(value)}</span>;
  };

  return (
    <div className="space-y-4">
      {renderValue(data)}
    </div>
  );
};

// Main Extractor UI Component
export default function ExtractorUI() {
  const [url, setUrl] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [customSchema, setCustomSchema] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [viewMode, setViewMode] = useState<'visual' | 'json' | 'table'>('visual');
  const [jobId, setJobId] = useState<string>('');

  // Get current instructions and schema
  const getCurrentConfig = () => {
    if (selectedPreset && EXTRACTION_PRESETS[selectedPreset]) {
      return {
        instructions: EXTRACTION_PRESETS[selectedPreset].instructions,
        schema: EXTRACTION_PRESETS[selectedPreset].schema
      };
    }
    return {
      instructions: customInstructions,
      schema: customSchema ? JSON.parse(customSchema) : null
    };
  };

  // Poll job status
  const pollJobStatus = async (jobId: string) => {
    const maxAttempts = 60;
    let attempts = 0;
    
    const poll = async () => {
      if (attempts >= maxAttempts) {
        setError('Extraction timeout - please try again');
        setIsExtracting(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/extract/${jobId}`, {
          headers: {
            'x-api-key': process.env.REACT_APP_API_KEY || 'test-key-123'
          }
        });

        if (!response.ok) throw new Error('Failed to check job status');

        const data = await response.json();
        
        if (data.status === 'completed') {
          setResult(data.result?.data || data.result);
          setIsExtracting(false);
          setExtractionProgress({
            status: 'completed',
            message: 'Extraction completed successfully!'
          });
        } else if (data.status === 'failed') {
          setError(data.error || 'Extraction failed');
          setIsExtracting(false);
        } else {
          // Update progress
          setExtractionProgress({
            status: data.status,
            message: `Processing... (${attempts + 1}/${maxAttempts})`,
            logs: data.logs
          });
          attempts++;
          setTimeout(poll, 2000);
        }
      } catch (err) {
        console.error('Polling error:', err);
        attempts++;
        setTimeout(poll, 2000);
      }
    };

    poll();
  };

  // Start extraction
  const handleExtract = async () => {
    if (!url) {
      setError('Please enter a URL');
      return;
    }

    const config = getCurrentConfig();
    if (!config.instructions || !config.schema) {
      setError('Please select a preset or provide custom instructions and schema');
      return;
    }

    setIsExtracting(true);
    setError('');
    setResult(null);
    setExtractionProgress({ status: 'starting', message: 'Initializing extraction...' });

    try {
      const response = await fetch(`${API_BASE}/api/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || 'test-key-123'
        },
        body: JSON.stringify({
          url,
          extractionType: 'structured',
          instructions: config.instructions,
          schema: config.schema,
          formats: ['structured']
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to start extraction: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.jobId) {
        setJobId(data.jobId);
        setExtractionProgress({ 
          status: 'queued', 
          message: 'Job queued, starting extraction...',
          jobId: data.jobId 
        });
        pollJobStatus(data.jobId);
      } else {
        throw new Error('No job ID received');
      }
    } catch (err) {
      console.error('Extraction error:', err);
      setError(err.message || 'Failed to start extraction');
      setIsExtracting(false);
    }
  };

  // Export results
  const handleExport = (format: 'json' | 'csv') => {
    if (!result) return;

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `extraction-${Date.now()}.json`;
      a.click();
    }
    // CSV export would need more complex logic based on data structure
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl text-white">
              <Brain className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Intelligent Data Extractor</h1>
              <p className="text-gray-600">Plan-based extraction with semantic understanding</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="space-y-4">
            {/* URL Input */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Target URL
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="https://example.com/page-to-extract"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="font-mono"
                />
              </CardContent>
            </Card>

            {/* Extraction Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Extraction Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="presets" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="presets">Presets</TabsTrigger>
                    <TabsTrigger value="custom">Custom</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="presets" className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(EXTRACTION_PRESETS).map(([key, preset]) => {
                        const Icon = preset.icon;
                        return (
                          <button
                            key={key}
                            onClick={() => setSelectedPreset(key)}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              selectedPreset === key
                                ? 'border-orange-500 bg-orange-50'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <Icon className={`w-6 h-6 ${preset.color} mb-2`} />
                            <div className="text-sm font-medium text-gray-900">{preset.name}</div>
                          </button>
                        );
                      })}
                    </div>
                    
                    {selectedPreset && (
                      <Alert className="bg-blue-50 border-blue-200">
                        <AlertDescription>
                          <strong>Instructions:</strong> {EXTRACTION_PRESETS[selectedPreset].instructions}
                        </AlertDescription>
                      </Alert>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="custom" className="space-y-4">
                    <div>
                      <Label>Extraction Instructions</Label>
                      <textarea
                        className="w-full mt-1 p-3 border rounded-lg text-sm font-mono"
                        rows={3}
                        placeholder="Describe what data you want to extract..."
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label>Output Schema (JSON)</Label>
                      <textarea
                        className="w-full mt-1 p-3 border rounded-lg text-sm font-mono"
                        rows={8}
                        placeholder='{"type": "object", "properties": {...}}'
                        value={customSchema}
                        onChange={(e) => setCustomSchema(e.target.value)}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Action Button */}
            <Button
              onClick={handleExtract}
              disabled={isExtracting || !url}
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2" />
                  Start Extraction
                </>
              )}
            </Button>

            {/* Error Display */}
            {error && (
              <Alert className="bg-red-50 border-red-200">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Results Panel */}
          <div className="space-y-4">
            {/* Progress Indicator */}
            {extractionProgress && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    {extractionProgress.status === 'completed' ? (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    ) : (
                      <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{extractionProgress.message}</div>
                      {extractionProgress.jobId && (
                        <div className="text-sm text-gray-600">Job ID: {extractionProgress.jobId}</div>
                      )}
                    </div>
                  </div>
                  
                  {/* Two-pass visualization */}
                  {extractionProgress.status === 'processing' && (
                    <div className="mt-4 flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-700">Pass A: Discover</Badge>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                      <Badge className="bg-blue-100 text-blue-700">Pass B: Extract</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Results Display */}
            {result && (
              <Card className="h-[600px] flex flex-col">
                <CardHeader className="flex-none">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5" />
                      Extracted Data
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                        <Button
                          size="sm"
                          variant={viewMode === 'visual' ? 'default' : 'ghost'}
                          onClick={() => setViewMode('visual')}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={viewMode === 'json' ? 'default' : 'ghost'}
                          onClick={() => setViewMode('json')}
                        >
                          <Code className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={viewMode === 'table' ? 'default' : 'ghost'}
                          onClick={() => setViewMode('table')}
                        >
                          <Table className="w-4 h-4" />
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExport('json')}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Export
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    {viewMode === 'visual' && (
                      <DataVisualizer 
                        data={result} 
                        schema={getCurrentConfig().schema}
                      />
                    )}
                    
                    {viewMode === 'json' && (
                      <pre className="text-xs font-mono bg-gray-50 p-4 rounded-lg overflow-x-auto">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    )}
                    
                    {viewMode === 'table' && (
                      <div className="text-sm text-gray-600">
                        Table view available for array data
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}