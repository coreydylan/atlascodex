import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Calendar,
  MapPin,
  Phone,
  Mail,
  DollarSign,
  ExternalLink,
  Star,
  Clock,
  User,
  Building,
  Tag,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  CheckCircle,
  AlertTriangle,
  Info,
  Zap,
  Target,
  Globe,
  Hash,
  FileText,
  Image as ImageIcon,
  Link2,
  List
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

interface TemplateRendererProps {
  template: VisualTemplate;
  data: any;
  className?: string;
  interactive?: boolean;
  onItemClick?: (item: any, index: number) => void;
  showStats?: boolean;
}

export default function TemplateRenderer({
  template,
  data,
  className = '',
  interactive = false,
  onItemClick,
  showStats = false
}: TemplateRendererProps) {
  // Helper function to get field value from data
  const getFieldValue = (item: any, fieldName: string, defaultValue?: any) => {
    if (!item) return defaultValue || null;
    
    // Handle nested field names with dot notation
    if (fieldName.includes('.')) {
      const parts = fieldName.split('.');
      let value = item;
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) break;
      }
      return value ?? defaultValue;
    }
    
    return item[fieldName] ?? defaultValue;
  };

  // Format value based on field display type
  const formatValue = (value: any, field: TemplateField) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">—</span>;
    }

    switch (field.display) {
      case 'currency':
        const numValue = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(numValue) ? value : `$${numValue.toLocaleString()}`;

      case 'date':
        try {
          const date = new Date(value);
          return date.toLocaleDateString();
        } catch {
          return value;
        }

      case 'rating':
        const rating = typeof value === 'number' ? value : parseFloat(value);
        if (isNaN(rating)) return value;
        return (
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-3 h-3 ${
                  i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                }`}
              />
            ))}
            <span className="text-sm text-gray-600 ml-1">{rating}</span>
          </div>
        );

      case 'badge':
        return (
          <Badge variant="secondary" style={{ 
            backgroundColor: field.style.backgroundColor,
            color: field.style.color 
          }}>
            {value}
          </Badge>
        );

      case 'link':
        const url = value.startsWith('http') ? value : `https://${value}`;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            {value}
            <ExternalLink className="w-3 h-3" />
          </a>
        );

      case 'image':
        return (
          <div className="flex items-center gap-2">
            {value ? (
              <img
                src={value}
                alt={field.name}
                className="w-8 h-8 rounded object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">
                <ImageIcon className="w-4 h-4 text-gray-400" />
              </div>
            )}
          </div>
        );

      case 'list':
        if (!Array.isArray(value)) return value;
        return (
          <div className="space-y-1">
            {value.slice(0, 3).map((item, idx) => (
              <Badge key={idx} variant="outline" className="mr-1 mb-1 text-xs">
                {typeof item === 'object' ? JSON.stringify(item) : item}
              </Badge>
            ))}
            {value.length > 3 && (
              <span className="text-xs text-gray-500">+{value.length - 3} more</span>
            )}
          </div>
        );

      case 'card':
        if (typeof value !== 'object') return value;
        return (
          <div className="p-2 bg-gray-50 rounded text-xs">
            {Object.entries(value).slice(0, 3).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="font-medium">{k}:</span>
                <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
              </div>
            ))}
          </div>
        );

      default:
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
  };

  // Get field icon
  const getFieldIcon = (field: TemplateField) => {
    const iconClass = "w-4 h-4 text-gray-500";
    
    switch (field.display) {
      case 'currency': return <DollarSign className={iconClass} />;
      case 'date': return <Calendar className={iconClass} />;
      case 'rating': return <Star className={iconClass} />;
      case 'link': return <Link2 className={iconClass} />;
      case 'image': return <ImageIcon className={iconClass} />;
      case 'list': return <List className={iconClass} />;
      case 'badge': return <Tag className={iconClass} />;
      default: return <FileText className={iconClass} />;
    }
  };

  // Render different layouts
  const renderLayout = () => {
    if (!data) return null;

    // Extract items from data
    let items = [];
    if (Array.isArray(data)) {
      items = data;
    } else if (typeof data === 'object') {
      // Find the main array of items in the data structure
      const arrayFields = Object.entries(data).find(([key, value]) => Array.isArray(value));
      if (arrayFields) {
        items = arrayFields[1];
      } else {
        // If no array found, treat the data object as a single item
        items = [data];
      }
    }

    if (items.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>No data to display</p>
        </div>
      );
    }

    switch (template.layout) {
      case 'table':
        return renderTableLayout(items);
      case 'grid':
        return renderGridLayout(items);
      case 'list':
        return renderListLayout(items);
      case 'timeline':
        return renderTimelineLayout(items);
      case 'dashboard':
        return renderDashboardLayout(items);
      case 'card':
      default:
        return renderCardLayout(items);
    }
  };

  const renderCardLayout = (items: any[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item, index) => (
        <Card
          key={index}
          className={`transition-all ${
            interactive ? 'hover:shadow-md cursor-pointer' : ''
          } ${template.animations ? 'hover:scale-105' : ''}`}
          onClick={() => interactive && onItemClick?.(item, index)}
        >
          <CardContent className="p-4">
            <div className="space-y-2">
              {template.fields.map(field => {
                const value = getFieldValue(item, field.name, field.defaultValue);
                return (
                  <div key={field.id} className="flex items-start gap-2">
                    {getFieldIcon(field)}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {field.name.replace(/_/g, ' ')}
                      </div>
                      <div className="mt-1" style={field.style}>
                        {formatValue(value, field)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderTableLayout = (items: any[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          {template.fields.map(field => (
            <TableHead key={field.id}>
              <div className="flex items-center gap-2">
                {getFieldIcon(field)}
                {field.name.replace(/_/g, ' ')}
              </div>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) => (
          <TableRow
            key={index}
            className={interactive ? 'cursor-pointer hover:bg-gray-50' : ''}
            onClick={() => interactive && onItemClick?.(item, index)}
          >
            {template.fields.map(field => {
              const value = getFieldValue(item, field.name, field.defaultValue);
              return (
                <TableCell key={field.id} style={field.style}>
                  {formatValue(value, field)}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const renderGridLayout = (items: any[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {items.map((item, index) => (
        <div
          key={index}
          className={`p-3 border rounded-lg bg-white ${
            interactive ? 'hover:shadow-md cursor-pointer' : ''
          } ${template.animations ? 'transition-all hover:scale-105' : ''}`}
          onClick={() => interactive && onItemClick?.(item, index)}
        >
          {template.fields.slice(0, 4).map(field => {
            const value = getFieldValue(item, field.name, field.defaultValue);
            return (
              <div key={field.id} className="mb-2 last:mb-0">
                <div className="text-xs text-gray-500 uppercase tracking-wide">
                  {field.name.replace(/_/g, ' ')}
                </div>
                <div className="mt-1 text-sm" style={field.style}>
                  {formatValue(value, field)}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  const renderListLayout = (items: any[]) => (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={index}
          className={`flex items-center gap-4 p-3 border rounded-lg bg-white ${
            interactive ? 'hover:bg-gray-50 cursor-pointer' : ''
          }`}
          onClick={() => interactive && onItemClick?.(item, index)}
        >
          <div className="flex-none w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium">
            {index + 1}
          </div>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
            {template.fields.slice(0, 3).map(field => {
              const value = getFieldValue(item, field.name, field.defaultValue);
              return (
                <div key={field.id}>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    {field.name.replace(/_/g, ' ')}
                  </div>
                  <div className="mt-1 text-sm" style={field.style}>
                    {formatValue(value, field)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const renderTimelineLayout = (items: any[]) => {
    // Find date field for sorting
    const dateField = template.fields.find(f => f.type === 'date' || f.name.includes('date'));
    const sortedItems = dateField 
      ? [...items].sort((a, b) => {
          const dateA = new Date(getFieldValue(a, dateField.name));
          const dateB = new Date(getFieldValue(b, dateField.name));
          return dateB.getTime() - dateA.getTime();
        })
      : items;

    return (
      <div className="space-y-4">
        {sortedItems.map((item, index) => (
          <div key={index} className="flex gap-4">
            <div className="flex-none">
              <div className="w-3 h-3 bg-blue-500 rounded-full mt-1.5"></div>
              {index < sortedItems.length - 1 && (
                <div className="w-0.5 h-16 bg-gray-300 ml-1.5 mt-1"></div>
              )}
            </div>
            <div
              className={`flex-1 pb-8 ${
                interactive ? 'cursor-pointer' : ''
              }`}
              onClick={() => interactive && onItemClick?.(item, index)}
            >
              <Card className="bg-white">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {template.fields.map(field => {
                      const value = getFieldValue(item, field.name, field.defaultValue);
                      return (
                        <div key={field.id} className="flex items-start gap-2">
                          {getFieldIcon(field)}
                          <div className="flex-1">
                            <div className="text-xs text-gray-500 uppercase tracking-wide">
                              {field.name.replace(/_/g, ' ')}
                            </div>
                            <div className="mt-1 text-sm" style={field.style}>
                              {formatValue(value, field)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderDashboardLayout = (items: any[]) => {
    // Extract statistics from data
    const stats = {
      total: items.length,
      numberFields: template.fields.filter(f => f.type === 'number'),
      categories: {}
    };

    // Calculate category distributions
    template.fields.forEach(field => {
      if (field.display === 'badge' || field.name.includes('category') || field.name.includes('status')) {
        const values = items.map(item => getFieldValue(item, field.name)).filter(Boolean);
        const counts = values.reduce((acc, val) => {
          acc[val] = (acc[val] || 0) + 1;
          return acc;
        }, {});
        stats.categories[field.name] = counts;
      }
    });

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                <div>
                  <div className="text-xs text-gray-500">Total Items</div>
                  <div className="text-xl font-bold">{stats.total}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {stats.numberFields.slice(0, 3).map(field => {
            const values = items.map(item => getFieldValue(item, field.name)).filter(v => !isNaN(Number(v)));
            const sum = values.reduce((acc, val) => acc + Number(val), 0);
            const avg = values.length > 0 ? sum / values.length : 0;

            return (
              <Card key={field.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    <div>
                      <div className="text-xs text-gray-500">{field.name.replace(/_/g, ' ')}</div>
                      <div className="text-xl font-bold">
                        {field.display === 'currency' ? `$${avg.toFixed(0)}` : avg.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Category Breakdowns */}
        {Object.entries(stats.categories).map(([fieldName, counts]) => (
          <Card key={fieldName}>
            <CardHeader>
              <CardTitle className="text-sm">{fieldName.replace(/_/g, ' ')} Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(counts).map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between">
                    <Badge variant="outline">{category}</Badge>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${(count / stats.total) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Data Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Detailed Data</CardTitle>
          </CardHeader>
          <CardContent>
            {renderGridLayout(items)}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className={`template-renderer ${className}`} style={template.styles.container}>
      {template.styles.header && (
        <div style={template.styles.header} className="mb-4">
          {template.name}
        </div>
      )}
      
      <div style={template.styles.content}>
        {renderLayout()}
      </div>

      {showStats && data && (
        <div style={template.styles.footer} className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Template: {template.name}</span>
            <span>
              {Array.isArray(data) ? data.length : 
               typeof data === 'object' ? Object.keys(data).length : 1} items displayed
            </span>
          </div>
        </div>
      )}
    </div>
  );
}