import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { User, Briefcase, FileText, Mail, Phone, Globe, MapPin } from 'lucide-react';

interface SimpleDataDisplayProps {
  data: any;
  viewMode: 'cards' | 'table' | 'list';
}

export default function SimpleDataDisplay({ data, viewMode }: SimpleDataDisplayProps) {
  // Ensure data is an array
  const items = Array.isArray(data) ? data : [data];
  
  // If no data, show empty state
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No data to display
      </div>
    );
  }

  // Get all unique keys from the data
  const allKeys = Array.from(new Set(items.flatMap(item => Object.keys(item))));
  
  // Helper to get icon for field
  const getFieldIcon = (key: string) => {
    const keyLower = key.toLowerCase();
    if (keyLower.includes('name')) return User;
    if (keyLower.includes('title') || keyLower.includes('role')) return Briefcase;
    if (keyLower.includes('bio') || keyLower.includes('description')) return FileText;
    if (keyLower.includes('email')) return Mail;
    if (keyLower.includes('phone')) return Phone;
    if (keyLower.includes('url') || keyLower.includes('website')) return Globe;
    if (keyLower.includes('location') || keyLower.includes('address')) return MapPin;
    return null;
  };

  // Helper to format value
  const formatValue = (value: any, key: string) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    
    // Truncate long text for bio/description fields
    if ((key.toLowerCase().includes('bio') || key.toLowerCase().includes('description')) && 
        typeof value === 'string' && value.length > 150) {
      return value.substring(0, 150) + '...';
    }
    
    return String(value);
  };

  // CARDS VIEW
  if (viewMode === 'cards') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              {allKeys.map(key => {
                const Icon = getFieldIcon(key);
                const value = formatValue(item[key], key);
                
                return (
                  <div key={key} className="mb-4 last:mb-0">
                    <div className="flex items-start gap-2">
                      {Icon && <Icon className="w-4 h-4 text-gray-500 mt-0.5" />}
                      <div className="flex-1">
                        <div className="text-xs font-medium text-gray-500 uppercase mb-1">
                          {key.replace(/_/g, ' ')}
                        </div>
                        <div className="text-sm text-gray-900">
                          {value}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // TABLE VIEW
  if (viewMode === 'table') {
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {allKeys.map(key => (
                <TableHead key={key} className="font-medium">
                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={index}>
                {allKeys.map(key => (
                  <TableCell key={key} className="text-sm">
                    {formatValue(item[key], key)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // LIST VIEW (default)
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={index} className="p-4 bg-white rounded-lg border hover:shadow-md transition-shadow">
          {allKeys.map(key => {
            const Icon = getFieldIcon(key);
            const value = formatValue(item[key], key);
            
            return (
              <div key={key} className="flex items-start gap-3 mb-3 last:mb-0">
                {Icon && (
                  <div className="mt-0.5">
                    <Icon className="w-4 h-4 text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <span className="text-xs font-medium text-gray-500 uppercase">
                    {key.replace(/_/g, ' ')}:
                  </span>
                  <span className="ml-2 text-sm text-gray-900">
                    {value}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}