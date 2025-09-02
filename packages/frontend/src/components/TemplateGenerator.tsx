import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Eye,
  Code,
  Save,
  Edit,
  Trash2,
  Plus,
  Move,
  Type,
  Image as ImageIcon,
  Link2,
  Calendar,
  MapPin,
  Phone,
  Mail,
  DollarSign,
  Tag,
  Star,
  Layout,
  Grid3x3,
  List,
  Table,
  BarChart3,
  PieChart,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Info,
  Palette,
  Settings,
  Copy,
  Download,
  Upload,
  Sparkles,
  Brain,
  Wand2
} from 'lucide-react';

interface TemplateField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'email' | 'url' | 'date' | 'image' | 'array' | 'object';
  display: 'text' | 'badge' | 'link' | 'image' | 'date' | 'currency' | 'rating' | 'list' | 'card';
  size: 'small' | 'medium' | 'large';
  position: { x: number; y: number; width: number; height: number };
  style: {
    color?: string;
    backgroundColor?: string;
    fontSize?: string;
    fontWeight?: string;
    textAlign?: 'left' | 'center' | 'right';
    borderRadius?: string;
    padding?: string;
    margin?: string;
  };
  required: boolean;
  defaultValue?: any;
}

interface VisualTemplate {
  id: string;
  name: string;
  description: string;
  layout: 'card' | 'table' | 'list' | 'grid' | 'timeline' | 'kanban' | 'dashboard';
  fields: TemplateField[];
  styles: {
    container: any;
    header: any;
    content: any;
    footer: any;
  };
  responsive: boolean;
  animations: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TemplateGeneratorProps {
  schema: any;
  data?: any;
  onTemplateChange: (template: VisualTemplate) => void;
  onSaveTemplate?: (template: VisualTemplate) => void;
  savedTemplates?: VisualTemplate[];
}

const FIELD_DISPLAY_OPTIONS = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'badge', label: 'Badge', icon: Tag },
  { value: 'link', label: 'Link', icon: Link2 },
  { value: 'image', label: 'Image', icon: ImageIcon },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'currency', label: 'Currency', icon: DollarSign },
  { value: 'rating', label: 'Rating', icon: Star },
  { value: 'list', label: 'List', icon: List },
  { value: 'card', label: 'Card', icon: Layout },
];

const LAYOUT_OPTIONS = [
  { value: 'card', label: 'Card Layout', icon: Layout, description: 'Individual cards for each item' },
  { value: 'table', label: 'Table Layout', icon: Table, description: 'Tabular data display' },
  { value: 'list', label: 'List Layout', icon: List, description: 'Simple list format' },
  { value: 'grid', label: 'Grid Layout', icon: Grid3x3, description: 'Responsive grid system' },
  { value: 'timeline', label: 'Timeline Layout', icon: TrendingUp, description: 'Chronological display' },
  { value: 'dashboard', label: 'Dashboard Layout', icon: BarChart3, description: 'Statistics and charts' },
];

export default function TemplateGenerator({ 
  schema, 
  data, 
  onTemplateChange, 
  onSaveTemplate, 
  savedTemplates = [] 
}: TemplateGeneratorProps) {
  const [currentTemplate, setCurrentTemplate] = useState<VisualTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<'visual' | 'code'>('visual');
  const [selectedField, setSelectedField] = useState<TemplateField | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Initialize template from schema
  useEffect(() => {
    if (schema && !currentTemplate) {
      generateTemplateFromSchema();
    }
  }, [schema]);

  // Generate template automatically from schema using AI
  const generateTemplateFromSchema = async () => {
    setIsGenerating(true);
    
    try {
      // Use AI to analyze schema and generate optimal template
      const response = await fetch('/api/ai/generate-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || 'test-key-123'
        },
        body: JSON.stringify({
          schema,
          sampleData: data,
          prompt: `Generate a visual template configuration for displaying data that matches this schema.
          
          Consider:
          1. The best layout type for this data structure
          2. Appropriate display types for each field
          3. Optimal sizing and positioning
          4. Color scheme and styling
          5. User experience and readability
          
          Return a complete VisualTemplate object with all necessary configurations.`
        })
      });

      if (response.ok) {
        const aiTemplate = await response.json();
        setCurrentTemplate(aiTemplate);
        onTemplateChange(aiTemplate);
      } else {
        // Fallback to local generation
        generateLocalTemplate();
      }
    } catch (error) {
      console.error('AI template generation failed:', error);
      generateLocalTemplate();
    } finally {
      setIsGenerating(false);
    }
  };

  // Local template generation as fallback
  const generateLocalTemplate = () => {
    if (!schema || !schema.properties) return;

    const fields: TemplateField[] = [];
    let yPosition = 0;

    // Analyze schema properties to create template fields
    Object.entries(schema.properties).forEach(([key, prop]: [string, any], index) => {
      const field: TemplateField = {
        id: `field_${key}_${index}`,
        name: key,
        type: getFieldType(prop),
        display: getOptimalDisplay(key, prop),
        size: getFieldSize(prop),
        position: {
          x: (index % 3) * 33.33, // 3 columns
          y: yPosition,
          width: 30,
          height: getFieldHeight(prop)
        },
        style: getFieldStyle(key, prop),
        required: schema.required?.includes(key) || false,
        defaultValue: prop.default
      };

      fields.push(field);
      
      if ((index + 1) % 3 === 0) {
        yPosition += field.position.height + 10;
      }
    });

    const template: VisualTemplate = {
      id: `template_${Date.now()}`,
      name: `Auto-generated Template`,
      description: `Generated from schema for ${Object.keys(schema.properties).length} fields`,
      layout: determineOptimalLayout(fields, data),
      fields,
      styles: {
        container: {
          padding: '1rem',
          backgroundColor: '#ffffff',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        },
        header: {
          fontSize: '1.25rem',
          fontWeight: '600',
          marginBottom: '1rem',
          color: '#1f2937'
        },
        content: {
          display: 'grid',
          gap: '1rem'
        },
        footer: {
          marginTop: '1rem',
          padding: '0.5rem 0',
          borderTop: '1px solid #e5e7eb'
        }
      },
      responsive: true,
      animations: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setCurrentTemplate(template);
    onTemplateChange(template);
  };

  // Helper functions for template generation
  const getFieldType = (prop: any): TemplateField['type'] => {
    if (prop.type === 'string') {
      if (prop.format === 'email') return 'email';
      if (prop.format === 'uri' || prop.format === 'url') return 'url';
      if (prop.format === 'date' || prop.format === 'date-time') return 'date';
      return 'text';
    }
    if (prop.type === 'number' || prop.type === 'integer') return 'number';
    if (prop.type === 'array') return 'array';
    if (prop.type === 'object') return 'object';
    return 'text';
  };

  const getOptimalDisplay = (key: string, prop: any): TemplateField['display'] => {
    const keyLower = key.toLowerCase();
    
    if (keyLower.includes('email')) return 'link';
    if (keyLower.includes('url') || keyLower.includes('link')) return 'link';
    if (keyLower.includes('image') || keyLower.includes('photo')) return 'image';
    if (keyLower.includes('date') || keyLower.includes('time')) return 'date';
    if (keyLower.includes('price') || keyLower.includes('cost') || keyLower.includes('amount')) return 'currency';
    if (keyLower.includes('rating') || keyLower.includes('score')) return 'rating';
    if (keyLower.includes('tag') || keyLower.includes('category') || keyLower.includes('status')) return 'badge';
    if (prop.type === 'array') return 'list';
    if (prop.type === 'object') return 'card';
    
    return 'text';
  };

  const getFieldSize = (prop: any): TemplateField['size'] => {
    if (prop.type === 'object' || prop.type === 'array') return 'large';
    if (prop.maxLength && prop.maxLength > 100) return 'large';
    if (prop.maxLength && prop.maxLength > 50) return 'medium';
    return 'small';
  };

  const getFieldHeight = (prop: any): number => {
    if (prop.type === 'object') return 150;
    if (prop.type === 'array') return 100;
    if (prop.maxLength && prop.maxLength > 100) return 80;
    return 40;
  };

  const getFieldStyle = (key: string, prop: any) => {
    const keyLower = key.toLowerCase();
    
    // Color coding based on field type
    if (keyLower.includes('error') || keyLower.includes('fail')) {
      return { color: '#dc2626', backgroundColor: '#fef2f2' };
    }
    if (keyLower.includes('success') || keyLower.includes('complete')) {
      return { color: '#16a34a', backgroundColor: '#f0fdf4' };
    }
    if (keyLower.includes('warning') || keyLower.includes('caution')) {
      return { color: '#d97706', backgroundColor: '#fffbeb' };
    }
    if (keyLower.includes('info') || keyLower.includes('note')) {
      return { color: '#2563eb', backgroundColor: '#eff6ff' };
    }
    
    return {
      color: '#374151',
      fontSize: '0.875rem',
      padding: '0.25rem 0.5rem'
    };
  };

  const determineOptimalLayout = (fields: TemplateField[], sampleData?: any): VisualTemplate['layout'] => {
    // Analyze data structure to suggest best layout
    if (fields.some(f => f.name.includes('date') || f.name.includes('time'))) {
      return 'timeline';
    }
    if (fields.length > 10) {
      return 'table';
    }
    if (fields.some(f => f.type === 'number' && (f.name.includes('count') || f.name.includes('total')))) {
      return 'dashboard';
    }
    if (fields.length <= 6) {
      return 'card';
    }
    return 'grid';
  };

  // Template editing functions
  const updateField = (fieldId: string, updates: Partial<TemplateField>) => {
    if (!currentTemplate) return;

    const updatedFields = currentTemplate.fields.map(field =>
      field.id === fieldId ? { ...field, ...updates } : field
    );

    const updatedTemplate = {
      ...currentTemplate,
      fields: updatedFields,
      updatedAt: new Date().toISOString()
    };

    setCurrentTemplate(updatedTemplate);
    onTemplateChange(updatedTemplate);
  };

  const addField = () => {
    if (!currentTemplate) return;

    const newField: TemplateField = {
      id: `field_${Date.now()}`,
      name: 'new_field',
      type: 'text',
      display: 'text',
      size: 'medium',
      position: { x: 0, y: 0, width: 30, height: 40 },
      style: { color: '#374151' },
      required: false
    };

    const updatedTemplate = {
      ...currentTemplate,
      fields: [...currentTemplate.fields, newField],
      updatedAt: new Date().toISOString()
    };

    setCurrentTemplate(updatedTemplate);
    onTemplateChange(updatedTemplate);
    setSelectedField(newField);
  };

  const deleteField = (fieldId: string) => {
    if (!currentTemplate) return;

    const updatedTemplate = {
      ...currentTemplate,
      fields: currentTemplate.fields.filter(field => field.id !== fieldId),
      updatedAt: new Date().toISOString()
    };

    setCurrentTemplate(updatedTemplate);
    onTemplateChange(updatedTemplate);
    setSelectedField(null);
  };

  const saveTemplate = () => {
    if (!currentTemplate || !onSaveTemplate) return;
    onSaveTemplate(currentTemplate);
  };

  const loadTemplate = (template: VisualTemplate) => {
    setCurrentTemplate(template);
    onTemplateChange(template);
    setSelectedField(null);
  };

  const exportTemplate = () => {
    if (!currentTemplate) return;
    
    const blob = new Blob([JSON.stringify(currentTemplate, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTemplate.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importTemplate = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const template = JSON.parse(e.target?.result as string);
        setCurrentTemplate(template);
        onTemplateChange(template);
      } catch (error) {
        console.error('Failed to import template:', error);
      }
    };
    reader.readAsText(file);
  };

  if (isGenerating) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Brain className="w-8 h-8 text-purple-500 animate-pulse mx-auto mb-2" />
            <p className="text-sm text-gray-600">AI is generating your visual template...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentTemplate) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Wand2 className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No template available</p>
            <Button onClick={generateTemplateFromSchema} className="mt-2">
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Template
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Template Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Visual Template Editor
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
                  variant={viewMode === 'code' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('code')}
                >
                  <Code className="w-4 h-4" />
                </Button>
              </div>
              <Button size="sm" variant="outline" onClick={exportTemplate}>
                <Download className="w-4 h-4" />
              </Button>
              <input
                type="file"
                accept=".json"
                onChange={importTemplate}
                style={{ display: 'none' }}
                id="import-template"
              />
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => document.getElementById('import-template')?.click()}
              >
                <Upload className="w-4 h-4" />
              </Button>
              {onSaveTemplate && (
                <Button size="sm" onClick={saveTemplate}>
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={currentTemplate.name}
                onChange={(e) => {
                  const updated = { ...currentTemplate, name: e.target.value };
                  setCurrentTemplate(updated);
                  onTemplateChange(updated);
                }}
              />
            </div>
            <div>
              <Label htmlFor="template-layout">Layout</Label>
              <Select
                value={currentTemplate.layout}
                onValueChange={(value) => {
                  const updated = { ...currentTemplate, layout: value as any };
                  setCurrentTemplate(updated);
                  onTemplateChange(updated);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LAYOUT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="w-4 h-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={addField} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add Field
              </Button>
              <Button onClick={generateTemplateFromSchema} size="sm" variant="outline">
                <Brain className="w-4 h-4 mr-1" />
                Regenerate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Fields List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Template Fields</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {currentTemplate.fields.map((field) => (
                  <div
                    key={field.id}
                    className={`p-2 rounded border cursor-pointer transition-all ${
                      selectedField?.id === field.id
                        ? 'bg-blue-50 border-blue-200'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedField(field)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{field.name}</span>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">
                          {field.display}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteField(field.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {field.type} • {field.size}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Field Editor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Field Properties</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedField ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="field-name">Field Name</Label>
                  <Input
                    id="field-name"
                    value={selectedField.name}
                    onChange={(e) => updateField(selectedField.id, { name: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="field-display">Display Type</Label>
                  <Select
                    value={selectedField.display}
                    onValueChange={(value) => updateField(selectedField.id, { display: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_DISPLAY_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <option.icon className="w-4 h-4" />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="field-size">Size</Label>
                  <Select
                    value={selectedField.size}
                    onValueChange={(value) => updateField(selectedField.id, { size: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="field-color">Text Color</Label>
                    <Input
                      id="field-color"
                      type="color"
                      value={selectedField.style.color || '#000000'}
                      onChange={(e) => updateField(selectedField.id, {
                        style: { ...selectedField.style, color: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="field-bg">Background</Label>
                    <Input
                      id="field-bg"
                      type="color"
                      value={selectedField.style.backgroundColor || '#ffffff'}
                      onChange={(e) => updateField(selectedField.id, {
                        style: { ...selectedField.style, backgroundColor: e.target.value }
                      })}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Select a field to edit its properties</p>
            )}
          </CardContent>
        </Card>

        {/* Template Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {viewMode === 'visual' ? (
              <div className="border rounded p-4 bg-gray-50 min-h-48">
                <div style={currentTemplate.styles.header}>
                  {currentTemplate.name}
                </div>
                <div className={`grid gap-2 ${
                  currentTemplate.layout === 'grid' ? 'grid-cols-2' : 'grid-cols-1'
                }`}>
                  {currentTemplate.fields.slice(0, 4).map(field => (
                    <div
                      key={field.id}
                      className="p-2 bg-white rounded border text-xs"
                      style={field.style}
                    >
                      <div className="font-medium">{field.name}</div>
                      <div className="text-gray-500">Sample {field.display}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <ScrollArea className="h-48">
                <pre className="text-xs">
                  {JSON.stringify(currentTemplate, null, 2)}
                </pre>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Saved Templates */}
      {savedTemplates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Saved Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {savedTemplates.map(template => (
                <div
                  key={template.id}
                  className="p-3 border rounded cursor-pointer hover:bg-gray-50"
                  onClick={() => loadTemplate(template)}
                >
                  <div className="font-medium text-sm">{template.name}</div>
                  <div className="text-xs text-gray-500">{template.description}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <Badge variant="outline" className="text-xs">{template.layout}</Badge>
                    <span className="text-xs text-gray-400">
                      {template.fields.length} fields
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}