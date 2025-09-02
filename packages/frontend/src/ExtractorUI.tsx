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
  MessageCircle,
  Edit,
  Palette,
  Wand2,
  Save,
  Upload,
  Monitor,
  Smartphone,
  Tablet,
  X
} from 'lucide-react';
import TemplateGenerator from './components/TemplateGenerator';
import TemplateRenderer from './components/TemplateRenderer';
import SimpleDataDisplay from './components/SimpleDataDisplay';

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

// Enhanced dynamic data visualizer with AI optimization
const EnhancedDataVisualizer = ({ data, optimization, onFeedback }: { data: any; optimization?: any; onFeedback?: () => void }) => {
  if (!data) return null;
  
  // Apply display optimization if available
  const displayType = optimization?.displayType || 'auto';
  const primaryField = optimization?.primaryField;
  const secondaryFields = optimization?.secondaryFields || [];
  
  // Render based on optimized display type
  if (displayType === 'cards' || displayType === 'auto') {
    return <DataVisualizer data={data} schema={null} />;
  }
  
  if (displayType === 'table' && Array.isArray(data)) {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {Object.keys(data[0] || {}).map(key => (
                <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {key.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, idx) => (
              <tr key={idx}>
                {Object.values(item).map((value: any, vIdx) => (
                  <td key={vIdx} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  
  if (displayType === 'timeline' && Array.isArray(data)) {
    return (
      <div className="space-y-4">
        {data.map((item, idx) => (
          <div key={idx} className="flex gap-4">
            <div className="flex-none">
              <div className="w-3 h-3 bg-orange-500 rounded-full mt-1.5"></div>
              {idx < data.length - 1 && (
                <div className="w-0.5 h-16 bg-gray-300 ml-1.5 mt-1"></div>
              )}
            </div>
            <div className="flex-1 pb-8">
              <div className="bg-white p-4 rounded-lg border">
                {Object.entries(item).map(([k, v]) => (
                  <div key={k} className="mb-2">
                    <span className="text-xs text-gray-500">{k}:</span>
                    <span className="ml-2 text-sm">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  if (displayType === 'stats' && typeof data === 'object') {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="bg-white p-4 rounded-lg border">
            <div className="text-xs text-gray-500 uppercase">{key.replace(/_/g, ' ')}</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">
              {typeof value === 'number' ? value.toLocaleString() : String(value)}
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  // Fallback to original visualizer
  return <DataVisualizer data={data} schema={null} />;
};

// Original dynamic data visualizer component
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
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [generatedInstructions, setGeneratedInstructions] = useState('');
  const [generatedSchema, setGeneratedSchema] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'list' | 'json'>('cards');
  const [currentTemplate, setCurrentTemplate] = useState(null);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [templateGenerated, setTemplateGenerated] = useState(false);
  const [jobId, setJobId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'presets' | 'custom' | 'generate'>('presets');
  const [displayOptimization, setDisplayOptimization] = useState<any>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [previousConfig, setPreviousConfig] = useState<any>(null);
  const [agentProposals, setAgentProposals] = useState<any[]>([]);
  const [showAgentDetails, setShowAgentDetails] = useState(false);
  const [schemaFeedback, setSchemaFeedback] = useState('');

  // Get current instructions and schema based on active tab
  const getCurrentConfig = () => {
    if (activeTab === 'presets' && selectedPreset && EXTRACTION_PRESETS[selectedPreset]) {
      return {
        instructions: EXTRACTION_PRESETS[selectedPreset].instructions,
        schema: EXTRACTION_PRESETS[selectedPreset].schema
      };
    } else if (activeTab === 'generate') {
      return {
        instructions: generatedInstructions,
        schema: generatedSchema ? JSON.parse(generatedSchema) : null
      };
    }
    return {
      instructions: customInstructions,
      schema: customSchema ? JSON.parse(customSchema) : null
    };
  };

  // Multi-agent schema generation system
  const generateSchemaWithAgents = async (userRequest: string) => {
    // Define nano-agents with different perspectives
    const nanoAgents = [
      {
        name: 'DataStructureAgent',
        role: 'Focuses on optimal data organization and relationships',
        prompt: `Given the user wants to extract: "${userRequest}"
        
        Design a JSON schema focusing on:
        1. Hierarchical data relationships
        2. Proper nesting and grouping
        3. Array vs object decisions
        4. Data normalization
        
        Think about how the data relates to each other and what structure would be most useful.`
      },
      {
        name: 'FieldDiscoveryAgent', 
        role: 'Discovers all possible relevant fields',
        prompt: `Given the user wants to extract: "${userRequest}"
        
        Identify ALL possible fields that might be relevant, including:
        1. Explicitly mentioned fields
        2. Commonly associated fields (e.g., if they want names, they might also want titles)
        3. Metadata fields (dates, IDs, sources)
        4. Relationship fields (parent/child, categories)
        5. Computed fields (counts, summaries)
        
        Be creative and think about what additional data would be valuable.`
      },
      {
        name: 'ContextAnalyzerAgent',
        role: 'Understands domain context and industry standards',
        prompt: `Given the user wants to extract: "${userRequest}"
        
        Analyze the context and domain to suggest:
        1. Industry-standard field names
        2. Common patterns for this type of data
        3. Expected data types and formats
        4. Validation rules and constraints
        5. Missing context that should be captured
        
        Consider what professional systems would capture for this data.`
      },
      {
        name: 'UserIntentAgent',
        role: 'Interprets what the user really needs',
        prompt: `Given the user wants to extract: "${userRequest}"
        
        Interpret the user's true intent:
        1. What problem are they trying to solve?
        2. How will they likely use this data?
        3. What format would be most convenient?
        4. What aggregations or summaries would help?
        5. What filtering or sorting might they need?
        
        Think beyond the literal request to what would be most helpful.`
      },
      {
        name: 'EdgeCaseAgent',
        role: 'Handles special cases and variations',
        prompt: `Given the user wants to extract: "${userRequest}"
        
        Consider edge cases and variations:
        1. Optional vs required fields
        2. Fields that might have multiple values
        3. Alternative data representations
        4. Handling missing or null data
        5. Accommodating different formats of the same data
        
        Make the schema flexible enough to handle real-world messiness.`
      }
    ];

    // Collect proposals from all nano-agents
    const proposals = [];
    
    // Run agents in parallel for speed
    const agentPromises = nanoAgents.map(async (agent) => {
      try {
        const response = await fetch(`${API_BASE}/api/ai/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.REACT_APP_API_KEY || 'test-key-123'
          },
          body: JSON.stringify({
            prompt: agent.prompt + '\n\nReturn a JSON schema proposal.',
            autoExecute: false
          })
        });

        if (response.ok) {
          const result = await response.json();
          return {
            agent: agent.name,
            role: agent.role,
            schema: result.params?.outputSchema || result.params?.schema || null
          };
        }
      } catch (err) {
        console.log(`Agent ${agent.name} failed, using fallback`);
      }
      return null;
    });

    const agentResults = await Promise.all(agentPromises);
    const validProposals = agentResults.filter(p => p && p.schema);
    
    // Save proposals for UI display
    setAgentProposals(validProposals);

    // If we have proposals, synthesize them
    if (validProposals.length > 0) {
      // Judge agent synthesizes all proposals
      const judgePrompt = `You are a Judge Agent that must synthesize multiple schema proposals into one optimal schema.

User Request: "${userRequest}"

Agent Proposals:
${validProposals.map(p => `${p.agent} (${p.role}):\n${JSON.stringify(p.schema, null, 2)}`).join('\n\n')}

Synthesize these proposals into a single, optimal JSON schema that:
1. Incorporates the best ideas from each agent
2. Resolves any conflicts intelligently
3. Maintains consistency and usability
4. Is comprehensive but not overly complex
5. Includes helpful metadata and structure

Return the final JSON schema.`;

      try {
        const judgeResponse = await fetch(`${API_BASE}/api/ai/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.REACT_APP_API_KEY || 'test-key-123'
          },
          body: JSON.stringify({
            prompt: judgePrompt,
            autoExecute: false
          })
        });

        if (judgeResponse.ok) {
          const judgeResult = await judgeResponse.json();
          return judgeResult.params?.outputSchema || judgeResult.params?.schema || generateLocalSchema(userRequest);
        }
      } catch (err) {
        console.error('Judge agent failed:', err);
      }
    }

    // Fallback to intelligent local generation if agents fail
    return generateLocalSchema(userRequest);
  };

  // Local schema generation as fallback
  const generateLocalSchema = (userRequest: string) => {
    const lowerInput = userRequest.toLowerCase();
      let instructions = '';
      let schema = {};
      
      // Simple, clear instructions
      instructions = `Extract exactly: ${naturalLanguageInput}. Return ONLY the requested fields, nothing else.`;

      // Analyze the input to build a smart schema
      const words = lowerInput.split(/\s+/);
      const fields = [];
      
      // Common field patterns to detect
      const fieldPatterns = {
        'name': ['name', 'names', 'title', 'titles', 'called', 'named'],
        'email': ['email', 'emails', 'e-mail', 'mail', 'contact'],
        'phone': ['phone', 'phones', 'number', 'mobile', 'cell', 'telephone'],
        'address': ['address', 'addresses', 'location', 'locations', 'place'],
        'role': ['role', 'roles', 'position', 'positions', 'title', 'job', 'designation'],
        'department': ['department', 'departments', 'team', 'teams', 'division', 'group'],
        'bio': ['bio', 'biography', 'about', 'description', 'profile', 'background', 'story'],
        'date': ['date', 'dates', 'time', 'when', 'schedule', 'deadline', 'due'],
        'price': ['price', 'prices', 'cost', 'costs', 'fee', 'amount', 'pricing', 'rate'],
        'description': ['description', 'describe', 'details', 'summary', 'overview', 'info'],
        'url': ['url', 'link', 'links', 'website', 'site', 'webpage'],
        'image': ['image', 'images', 'photo', 'photos', 'picture', 'pictures', 'pic'],
        'category': ['category', 'categories', 'type', 'types', 'kind', 'class', 'group'],
        'status': ['status', 'state', 'condition', 'availability', 'active'],
        'id': ['id', 'identifier', 'code', 'reference', 'number'],
        'rating': ['rating', 'ratings', 'score', 'scores', 'review', 'rank'],
        'tags': ['tag', 'tags', 'label', 'labels', 'keyword', 'keywords'],
        'count': ['count', 'total', 'number', 'quantity', 'amount'],
        'features': ['feature', 'features', 'capability', 'capabilities', 'specification'],
        'author': ['author', 'authors', 'writer', 'created by', 'by', 'publisher']
      };

      // Detect which fields are mentioned
      const detectedFields = {};
      for (const [field, patterns] of Object.entries(fieldPatterns)) {
        if (patterns.some(pattern => lowerInput.includes(pattern))) {
          detectedFields[field] = { type: 'string' };
          if (field === 'rating' || field === 'count') {
            detectedFields[field] = { type: 'number' };
          }
          if (field === 'tags' || field === 'features') {
            detectedFields[field] = { type: 'array', items: { type: 'string' } };
          }
        }
      }

      // Determine the main entity type
      let entityName = 'items';
      let entitySingular = 'item';
      
      if (lowerInput.includes('people') || lowerInput.includes('person') || lowerInput.includes('staff') || lowerInput.includes('team') || lowerInput.includes('member')) {
        entityName = 'people';
        entitySingular = 'person';
        // Add common people fields
        if (!detectedFields.name) detectedFields.name = { type: 'string' };
        if (!detectedFields.role && !detectedFields.title) detectedFields.role = { type: 'string' };
      } else if (lowerInput.includes('product') || lowerInput.includes('item') || lowerInput.includes('service')) {
        entityName = 'products';
        entitySingular = 'product';
        if (!detectedFields.name) detectedFields.name = { type: 'string' };
        if (!detectedFields.price) detectedFields.price = { type: 'string' };
        if (!detectedFields.description) detectedFields.description = { type: 'string' };
      } else if (lowerInput.includes('article') || lowerInput.includes('post') || lowerInput.includes('blog') || lowerInput.includes('news')) {
        entityName = 'articles';
        entitySingular = 'article';
        if (!detectedFields.title) detectedFields.title = { type: 'string' };
        if (!detectedFields.author) detectedFields.author = { type: 'string' };
        if (!detectedFields.date) detectedFields.date = { type: 'string' };
        if (!detectedFields.content) detectedFields.content = { type: 'string' };
      } else if (lowerInput.includes('event') || lowerInput.includes('meeting') || lowerInput.includes('conference')) {
        entityName = 'events';
        entitySingular = 'event';
        if (!detectedFields.name) detectedFields.name = { type: 'string' };
        if (!detectedFields.date) detectedFields.date = { type: 'string' };
        if (!detectedFields.location) detectedFields.location = { type: 'string' };
      } else if (lowerInput.includes('compan') || lowerInput.includes('organization') || lowerInput.includes('business')) {
        entityName = 'companies';
        entitySingular = 'company';
        if (!detectedFields.name) detectedFields.name = { type: 'string' };
        if (!detectedFields.industry) detectedFields.industry = { type: 'string' };
        if (!detectedFields.website) detectedFields.website = { type: 'string' };
      }

      // If no specific fields detected, add generic ones
      if (Object.keys(detectedFields).length === 0) {
        detectedFields.name = { type: 'string' };
        detectedFields.description = { type: 'string' };
        detectedFields.details = { type: 'object' };
      }

      // Build the schema
      schema = {
        type: 'object',
        properties: {
          [entityName]: {
            type: 'array',
            items: {
              type: 'object',
              properties: detectedFields
            }
          },
          total_count: { type: 'number' },
          extraction_metadata: {
            type: 'object',
            properties: {
              extracted_at: { type: 'string' },
              source_url: { type: 'string' }
            }
          }
        }
      };

      // Check if we should just get a summary instead of list
      if (lowerInput.includes('summary') || lowerInput.includes('overview') || lowerInput.includes('statistics')) {
        schema = {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            key_points: { type: 'array', items: { type: 'string' } },
            statistics: { type: 'object' },
            ...detectedFields
          }
        };
      }

      return schema;
  };

  // Generate extraction config from natural language
  const handleGenerate = async () => {
    if (!naturalLanguageInput) {
      setError('Please describe what you want to extract');
      return;
    }

    setIsGenerating(true);
    setError('');
    
    try {
      // Generate comprehensive instructions
      const instructions = `Extract the following information as requested: ${naturalLanguageInput}. 
      Be comprehensive and include all relevant details, relationships, and metadata.
      Ensure the extraction is complete and well-structured.`;
      
      // Use multi-agent system to generate schema
      const schema = await generateSchemaWithAgents(naturalLanguageInput);
      
      setGeneratedInstructions(instructions);
      setGeneratedSchema(JSON.stringify(schema, null, 2));
      
      // Also generate an initial template for this schema
      generateTemplateForSchema(schema);
      
      setIsGenerating(false);
      
    } catch (err) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to generate configuration');
      setIsGenerating(false);
    }
  };

  // Generate template from schema
  const generateTemplateForSchema = (schema: any) => {
    if (!schema || !schema.properties) return;

    const fields = Object.entries(schema.properties).map(([key, prop]: [string, any], index) => {
      const fieldType = prop.type || 'text';
      const isArray = fieldType === 'array';
      const isObject = fieldType === 'object';
      
      // Determine optimal display type based on field name and type
      let display = 'text';
      const keyLower = key.toLowerCase();
      
      if (keyLower.includes('email')) display = 'link';
      else if (keyLower.includes('url') || keyLower.includes('link')) display = 'link';
      else if (keyLower.includes('image') || keyLower.includes('photo')) display = 'image';
      else if (keyLower.includes('date') || keyLower.includes('time')) display = 'date';
      else if (keyLower.includes('price') || keyLower.includes('cost')) display = 'currency';
      else if (keyLower.includes('rating') || keyLower.includes('score')) display = 'rating';
      else if (keyLower.includes('tag') || keyLower.includes('category')) display = 'badge';
      else if (isArray) display = 'list';
      else if (isObject) display = 'card';
      
      return {
        id: `field_${key}_${index}`,
        name: key,
        type: fieldType,
        display,
        size: isObject || isArray ? 'large' : 'medium',
        position: {
          x: (index % 3) * 33.33,
          y: Math.floor(index / 3) * 60,
          width: 30,
          height: isObject ? 100 : 50
        },
        style: {
          color: '#374151',
          fontSize: '0.875rem',
          padding: '0.5rem'
        },
        required: schema.required?.includes(key) || false
      };
    });

    const template = {
      id: `template_${Date.now()}`,
      name: `Template for ${naturalLanguageInput.slice(0, 50)}...`,
      description: 'Auto-generated from schema',
      layout: fields.length > 10 ? 'table' : fields.some(f => f.type === 'object') ? 'card' : 'grid',
      fields,
      styles: {
        container: {
          padding: '1.5rem',
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        },
        header: {
          fontSize: '1.5rem',
          fontWeight: '700',
          marginBottom: '1.5rem',
          color: '#1f2937',
          textAlign: 'center'
        },
        content: {
          display: 'grid',
          gap: '1.5rem'
        },
        footer: {
          marginTop: '2rem',
          padding: '1rem 0',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center',
          fontSize: '0.875rem',
          color: '#6b7280'
        }
      },
      responsive: true,
      animations: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setCurrentTemplate(template);
    setTemplateGenerated(true);
  };

  // Revise schema based on user feedback
  const handleReviseSchema = async () => {
    if (!schemaFeedback || !generatedSchema) {
      setError('Please provide feedback for schema revision');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const revisionPrompt = `Current schema:
${generatedSchema}

User feedback: "${schemaFeedback}"

Please revise the schema based on this feedback. Make the requested changes while maintaining schema validity and consistency.

Return the revised JSON schema.`;

      const response = await fetch(`${API_BASE}/api/ai/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || 'test-key-123'
        },
        body: JSON.stringify({
          prompt: revisionPrompt,
          autoExecute: false
        })
      });

      if (response.ok) {
        const result = await response.json();
        const revisedSchema = result.params?.outputSchema || result.params?.schema || JSON.parse(generatedSchema);
        setGeneratedSchema(JSON.stringify(revisedSchema, null, 2));
        setSchemaFeedback('');
        setError('');
      }
    } catch (err) {
      console.error('Schema revision error:', err);
      setError('Failed to revise schema');
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate template for extracted data
  const generateTemplateForData = async (data: any) => {
    const config = getCurrentConfig();
    if (!config.schema) return;

    try {
      // For now, generate a simple local template as AI endpoint might not exist
      const template = {
        id: `template_${Date.now()}`,
        name: 'Auto-generated Template',
        description: 'Generated from extracted data',
        layout: 'card',
        fields: Object.keys(config.schema.properties || {}).map((key, index) => ({
          id: `field_${key}_${index}`,
          name: key,
          type: 'text',
          display: 'text',
          size: 'medium',
          position: { x: 0, y: index * 50, width: 100, height: 40 },
          style: { color: '#374151', fontSize: '0.875rem' },
          required: config.schema.required?.includes(key) || false
        })),
        styles: {
          container: { padding: '1rem', backgroundColor: '#ffffff' },
          header: { fontSize: '1.25rem', fontWeight: '600' },
          content: { display: 'grid', gap: '1rem' },
          footer: { marginTop: '1rem' }
        },
        responsive: true,
        animations: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setCurrentTemplate(template);
      setTemplateGenerated(true);
    } catch (err) {
      console.error('Template generation failed:', err);
    }
  };

  // Optimize display of results using AI
  const optimizeDisplay = async (data: any) => {
    setIsOptimizing(true);
    
    try {
      const prompt = `Analyze this data and suggest the best way to display it visually:
      ${JSON.stringify(data, null, 2).slice(0, 1000)}
      
      Return a display configuration with:
      1. displayType: "cards" | "table" | "timeline" | "stats" | "list" | "grid"
      2. primaryField: the main field to highlight
      3. secondaryFields: supporting fields to show
      4. groupBy: field to group by (if applicable)
      5. sortBy: field to sort by
      6. visualElements: icons, colors, badges to use
      7. summary: key statistics to highlight`;

      const response = await fetch(`${API_BASE}/api/ai/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || 'test-key-123'
        },
        body: JSON.stringify({
          prompt,
          autoExecute: false
        })
      });

      if (response.ok) {
        const optimization = await response.json();
        setDisplayOptimization(optimization);
      }
    } catch (err) {
      console.error('Display optimization failed:', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  // Handle template changes
  const handleTemplateChange = (template: any) => {
    setCurrentTemplate(template);
  };

  // Save template
  const handleSaveTemplate = (template: any) => {
    const updatedTemplates = [...savedTemplates, template];
    setSavedTemplates(updatedTemplates);
    // Save to localStorage
    localStorage.setItem('extractorTemplates', JSON.stringify(updatedTemplates));
  };

  // Load saved templates on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('extractorTemplates');
      if (saved) {
        setSavedTemplates(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load saved templates:', error);
    }
  }, []);

  // Re-extract with feedback
  const handleReExtractWithFeedback = async () => {
    if (!feedbackText || !previousConfig) {
      setError('Please provide feedback for improvement');
      return;
    }

    setShowFeedback(false);
    setIsExtracting(true);
    setError('');
    setResult(null);
    setExtractionProgress({ status: 'starting', message: 'Re-extracting with your feedback...' });

    try {
      // Enhance instructions with feedback
      const enhancedInstructions = `${previousConfig.instructions}

      IMPORTANT USER FEEDBACK: ${feedbackText}
      
      Please adjust the extraction based on this feedback and ensure the output matches what the user expects.
      
      CRITICAL: The output MUST follow the provided JSON schema exactly. Do not return raw text or unstructured data.
      Format all extracted data according to the schema structure.`;

      const response = await fetch(`${API_BASE}/api/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || 'test-key-123'
        },
        body: JSON.stringify({
          url: previousConfig.url,
          extractionType: 'structured',
          instructions: enhancedInstructions,
          outputSchema: previousConfig.schema,
          schema: previousConfig.schema,
          formats: ['structured'],
          enforceSchema: true,
          validateOutput: true,
          previousAttempt: result,
          userFeedback: feedbackText
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to start re-extraction: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.jobId) {
        setJobId(data.jobId);
        setExtractionProgress({ 
          status: 'queued', 
          message: 'Re-extraction job queued with feedback...',
          jobId: data.jobId 
        });
        pollJobStatus(data.jobId);
      }
    } catch (err) {
      console.error('Re-extraction error:', err);
      setError(err.message || 'Failed to re-extract with feedback');
      setIsExtracting(false);
    }
    
    setFeedbackText('');
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
          const extractedData = data.result?.data || data.result;
          setResult(extractedData);
          setIsExtracting(false);
          setExtractionProgress({
            status: 'completed',
            message: 'Extraction completed successfully!'
          });
          
          // Save config for potential re-extraction
          setPreviousConfig({
            url,
            ...getCurrentConfig()
          });
          
          // Automatically optimize display
          if (extractedData) {
            optimizeDisplay(extractedData);
          }
          
          // Generate template if not already generated
          if (extractedData && !templateGenerated) {
            generateTemplateForData(extractedData);
          }
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
          outputSchema: config.schema, // Use outputSchema instead of schema
          schema: config.schema, // Keep both for compatibility
          formats: ['structured'],
          enforceSchema: true, // Ensure backend follows the schema strictly
          validateOutput: true // Validate output against schema
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
                <Tabs 
                  value={activeTab} 
                  onValueChange={(value) => setActiveTab(value as 'presets' | 'custom' | 'generate')}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="presets">Presets</TabsTrigger>
                    <TabsTrigger value="custom">Custom</TabsTrigger>
                    <TabsTrigger value="generate">Generate</TabsTrigger>
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
                  
                  <TabsContent value="generate" className="space-y-4">
                    <div>
                      <Label className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-orange-500" />
                        Describe what you want to extract
                      </Label>
                      <textarea
                        className="w-full p-3 border rounded-lg text-sm"
                        rows={3}
                        placeholder="Example: Get all team members with their names, roles, contact info, and bios..."
                        value={naturalLanguageInput}
                        onChange={(e) => setNaturalLanguageInput(e.target.value)}
                      />
                      
                      <Button
                        onClick={handleGenerate}
                        disabled={isGenerating || !naturalLanguageInput}
                        className="mt-3 w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating Configuration...
                          </>
                        ) : (
                          <>
                            <Brain className="w-4 h-4 mr-2" />
                            Generate Extraction Config
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {generatedInstructions && (
                      <div className="space-y-3">
                        <Alert className="bg-green-50 border-green-200">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <AlertDescription className="text-green-800">
                            Configuration generated successfully! Review below before extracting.
                          </AlertDescription>
                        </Alert>
                        
                        <div>
                          <Label className="text-xs text-gray-500">Generated Instructions</Label>
                          <div className="mt-1 p-3 bg-gray-50 border rounded-lg text-sm">
                            {generatedInstructions}
                          </div>
                        </div>
                        
                        {currentTemplate && (
                          <div>
                            <Label className="text-xs text-gray-500">Generated Visual Template</Label>
                            <div className="mt-1 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-purple-900">{currentTemplate.name}</span>
                                <Badge variant="outline" className="text-purple-700 border-purple-300">
                                  {currentTemplate.layout} • {currentTemplate.fields.length} fields
                                </Badge>
                              </div>
                              <p className="text-xs text-purple-600 mb-2">{currentTemplate.description}</p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowTemplateEditor(true)}
                                className="text-purple-700 border-purple-300 hover:bg-purple-100"
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                Customize Template
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <Label className="text-xs text-gray-500">Generated Schema</Label>
                            {agentProposals.length > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setShowAgentDetails(!showAgentDetails)}
                                className="text-xs text-purple-600 hover:text-purple-700"
                              >
                                <Users className="w-3 h-3 mr-1" />
                                {showAgentDetails ? 'Hide' : 'Show'} Agent Proposals ({agentProposals.length})
                              </Button>
                            )}
                          </div>
                          
                          {/* Show agent proposals if requested */}
                          {showAgentDetails && agentProposals.length > 0 && (
                            <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                              <Label className="text-xs text-purple-700 mb-2 block">AI Agent Proposals:</Label>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {agentProposals.map((proposal, idx) => (
                                  <div key={idx} className="p-2 bg-white rounded border border-purple-100">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Brain className="w-3 h-3 text-purple-600" />
                                      <span className="text-xs font-medium text-purple-900">{proposal.agent}</span>
                                    </div>
                                    <p className="text-xs text-gray-600">{proposal.role}</p>
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs text-purple-600 mt-2">
                                ✨ These proposals were synthesized by the Judge Agent into the final schema below
                              </p>
                            </div>
                          )}
                          
                          <pre className="mt-1 p-3 bg-gray-50 border rounded-lg text-xs font-mono overflow-x-auto">
                            {generatedSchema}
                          </pre>
                          
                          {/* Schema revision feedback */}
                          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <Label className="text-xs text-blue-700 mb-2 block">Want to refine the schema?</Label>
                            <div className="flex gap-2">
                              <Input
                                placeholder="E.g., 'Add a field for social media links' or 'Make email optional'"
                                value={schemaFeedback}
                                onChange={(e) => setSchemaFeedback(e.target.value)}
                                className="flex-1 text-sm"
                              />
                              <Button
                                size="sm"
                                onClick={handleReviseSchema}
                                disabled={!schemaFeedback || isGenerating}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                <Target className="w-3 h-3 mr-1" />
                                Revise
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCustomInstructions(generatedInstructions);
                              setCustomSchema(generatedSchema);
                              setActiveTab('custom');
                            }}
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Edit in Custom
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(generatedSchema);
                            }}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy Schema
                          </Button>
                        </div>
                      </div>
                    )}
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
                      {Array.isArray(result) && (
                        <Badge variant="secondary">{result.length} items</Badge>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {/* Simple view switcher */}
                      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                        <Button
                          size="sm"
                          variant={viewMode === 'cards' ? 'default' : 'ghost'}
                          onClick={() => setViewMode('cards')}
                          title="Card View"
                        >
                          <Grid3x3 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={viewMode === 'table' ? 'default' : 'ghost'}
                          onClick={() => setViewMode('table')}
                          title="Table View"
                        >
                          <Table className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={viewMode === 'list' ? 'default' : 'ghost'}
                          onClick={() => setViewMode('list')}
                          title="List View"
                        >
                          <List className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={viewMode === 'json' ? 'default' : 'ghost'}
                          onClick={() => setViewMode('json')}
                          title="Raw JSON"
                        >
                          <Code className="w-4 h-4" />
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExport('json')}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                  {/* Feedback Panel */}
                  {showFeedback && (
                    <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <Label className="flex items-center gap-2 mb-2">
                        <MessageCircle className="w-4 h-4 text-purple-600" />
                        Not what you expected? Provide feedback for better results
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="E.g., 'Include phone numbers' or 'Group by department' or 'Extract only managers'..."
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleReExtractWithFeedback}
                          disabled={!feedbackText || isExtracting}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          <Target className="w-4 h-4 mr-1" />
                          Re-Extract
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Display Optimization Status */}
                  {isOptimizing && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      <span className="text-sm text-blue-700">Optimizing display format...</span>
                    </div>
                  )}
                  
                  <ScrollArea className="h-full">
                    {viewMode === 'json' ? (
                      <pre className="text-xs font-mono bg-gray-50 p-4 rounded-lg overflow-x-auto">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    ) : (
                      <SimpleDataDisplay 
                        data={result} 
                        viewMode={viewMode as 'cards' | 'table' | 'list'}
                      />
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      
      {/* Template Editor Modal */}
      {showTemplateEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Visual Template Editor
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTemplateEditor(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4 h-full overflow-auto">
              <TemplateGenerator
                schema={getCurrentConfig().schema}
                data={result}
                onTemplateChange={handleTemplateChange}
                onSaveTemplate={handleSaveTemplate}
                savedTemplates={savedTemplates}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}