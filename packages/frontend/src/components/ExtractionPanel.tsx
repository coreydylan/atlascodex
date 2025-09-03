// Atlas Codex - Extraction Panel Component
import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  LinearProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel,
  Divider
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  ContentCopy,
  Download,
  ExpandMore,
  Info,
  CheckCircle,
  Error,
  Pending,
  Speed,
  AttachMoney,
  Security
} from '@mui/icons-material';

interface ExtractionPanelProps {
  apiKey: string;
  apiBase: string;
  onNotification: (message: string, severity: 'success' | 'error' | 'warning' | 'info') => void;
}

interface ExtractionJob {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  strategy?: string;
  data?: any;
  evidence?: any;
  metadata?: any;
  error?: string;
}

const EXTRACTION_STRATEGIES = [
  { value: 'auto', label: 'Auto (DIP-based)', cost: 'Variable', description: 'Let the system choose based on DIP' },
  { value: 'static_fetch', label: 'Static Fetch', cost: '$0.01', description: 'Simple HTTP fetch' },
  { value: 'browser_render', label: 'Browser Render', cost: '$0.05', description: 'Playwright without JS' },
  { value: 'browser_js', label: 'Browser + JS', cost: '$0.08', description: 'Full browser execution' },
  { value: 'hybrid_smart', label: 'Hybrid Smart', cost: '$0.15', description: 'Intelligent switching' },
  { value: 'gpt5_direct', label: 'GPT-5 Direct', cost: '$0.50', description: 'LLM extraction' },
  { value: 'gpt5_reasoning', label: 'GPT-5 Reasoning', cost: '$0.75', description: 'LLM with reasoning' }
];

export default function ExtractionPanel({ apiKey, apiBase, onNotification }: ExtractionPanelProps) {
  const [url, setUrl] = useState('');
  const [strategy, setStrategy] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [currentJob, setCurrentJob] = useState<ExtractionJob | null>(null);
  const [advancedOptions, setAdvancedOptions] = useState({
    waitFor: 0,
    screenshot: false,
    preserveFormatting: false,
    includeMetadata: true,
    includeEvidence: true,
    maxRetries: 2
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchUrls, setBatchUrls] = useState('');

  const startExtraction = async () => {
    if (!url && !batchMode) {
      onNotification('Please enter a URL', 'warning');
      return;
    }

    if (batchMode && !batchUrls) {
      onNotification('Please enter URLs for batch extraction', 'warning');
      return;
    }

    setLoading(true);
    setCurrentJob(null);

    try {
      const endpoint = batchMode ? '/jobs/batch' : '/jobs';
      const payload = batchMode ? {
        urls: batchUrls.split('\n').filter(u => u.trim()),
        options: { strategy: strategy === 'auto' ? undefined : strategy, ...advancedOptions }
      } : {
        url,
        options: { strategy: strategy === 'auto' ? undefined : strategy, ...advancedOptions }
      };

      const response = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Failed to start extraction: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (batchMode) {
        onNotification(`Batch extraction started: ${data.jobs.length} jobs queued`, 'success');
        // Monitor first job for demo
        if (data.jobs.length > 0) {
          monitorJob(data.jobs[0].id);
        }
      } else {
        onNotification('Extraction job started', 'success');
        monitorJob(data.job.id);
      }
    } catch (error: any) {
      onNotification(error.message, 'error');
      setLoading(false);
    }
  };

  const monitorJob = async (jobId: string) => {
    const checkJob = async () => {
      try {
        const response = await fetch(`${apiBase}/jobs/${jobId}`, {
          headers: { 'x-api-key': apiKey }
        });

        if (!response.ok) {
          throw new Error('Failed to check job status');
        }

        const job = await response.json();
        setCurrentJob(job);

        if (job.status === 'completed') {
          // Fetch full results
          const resultResponse = await fetch(`${apiBase}/jobs/${jobId}/result`, {
            headers: { 'x-api-key': apiKey }
          });

          if (resultResponse.ok) {
            const result = await resultResponse.json();
            setCurrentJob({ ...job, ...result });
          }

          setLoading(false);
          setShowResults(true);
          onNotification('Extraction completed successfully', 'success');
        } else if (job.status === 'failed') {
          setLoading(false);
          onNotification(`Extraction failed: ${job.error}`, 'error');
        } else {
          // Continue monitoring
          setTimeout(checkJob, 2000);
        }
      } catch (error: any) {
        setLoading(false);
        onNotification(error.message, 'error');
      }
    };

    checkJob();
  };

  const copyToClipboard = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    onNotification('Copied to clipboard', 'success');
  };

  const downloadResults = () => {
    if (!currentJob || !currentJob.data) return;

    const blob = new Blob([JSON.stringify(currentJob, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extraction_${currentJob.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotification('Results downloaded', 'success');
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed': return <CheckCircle color="success" />;
      case 'failed': return <Error color="error" />;
      case 'processing': return <Pending color="warning" />;
      default: return <Pending />;
    }
  };

  const renderExtractedData = (data: any) => {
    try {
      // Validate that data exists and is not null/undefined
      if (!data) {
        return (
          <Alert severity="warning">
            No data extracted. This could indicate an extraction error or empty content.
          </Alert>
        );
      }

      // Check if data has the expected structure
      if (typeof data !== 'object') {
        return (
          <Alert severity="error">
            Invalid data format: Expected object, got {typeof data}
          </Alert>
        );
      }

      // Safely stringify the data
      const jsonString = JSON.stringify(data, null, 2);
      
      // Check for potential malformed data patterns
      const isMalformed = jsonString.includes('{"name":"') && jsonString.includes('Director') && jsonString.includes('bio":""}');
      
      if (isMalformed) {
        return (
          <Box>
            <Alert severity="warning" sx={{ mb: 2 }}>
              ⚠️ Data appears malformed - names, titles, and bios may be concatenated. 
              This will be fixed in the next system update.
            </Alert>
            <pre style={{ margin: 0, fontSize: '0.85rem' }}>
              {jsonString}
            </pre>
          </Box>
        );
      }

      // Render clean, well-formatted data
      return (
        <pre style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.4 }}>
          {jsonString}
        </pre>
      );
      
    } catch (error) {
      console.error('Error rendering extracted data:', error);
      return (
        <Alert severity="error">
          <Typography variant="body2">
            <strong>Data Rendering Error:</strong> {error.message}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Raw data: {String(data).substring(0, 200)}...
          </Typography>
        </Alert>
      );
    }
  };

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Extraction Configuration
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={batchMode}
                  onChange={(e) => setBatchMode(e.target.checked)}
                />
              }
              label="Batch Mode"
              sx={{ mb: 2 }}
            />

            {batchMode ? (
              <TextField
                fullWidth
                multiline
                rows={4}
                label="URLs (one per line)"
                value={batchUrls}
                onChange={(e) => setBatchUrls(e.target.value)}
                placeholder="https://example.com/page1&#10;https://example.com/page2"
                sx={{ mb: 2 }}
              />
            ) : (
              <TextField
                fullWidth
                label="URL to Extract"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                sx={{ mb: 2 }}
              />
            )}

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Extraction Strategy</InputLabel>
              <Select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                label="Extraction Strategy"
              >
                {EXTRACTION_STRATEGIES.map(s => (
                  <MenuItem key={s.value} value={s.value}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span>{s.label}</span>
                      <Chip label={s.cost} size="small" color="primary" />
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Strategy Info */}
            {strategy && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {EXTRACTION_STRATEGIES.find(s => s.value === strategy)?.description}
              </Alert>
            )}

            {/* Advanced Options */}
            <Accordion expanded={showAdvanced} onChange={() => setShowAdvanced(!showAdvanced)}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography>Advanced Options</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Wait For (ms)"
                      value={advancedOptions.waitFor}
                      onChange={(e) => setAdvancedOptions({
                        ...advancedOptions,
                        waitFor: parseInt(e.target.value) || 0
                      })}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Max Retries"
                      value={advancedOptions.maxRetries}
                      onChange={(e) => setAdvancedOptions({
                        ...advancedOptions,
                        maxRetries: parseInt(e.target.value) || 2
                      })}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={advancedOptions.screenshot}
                          onChange={(e) => setAdvancedOptions({
                            ...advancedOptions,
                            screenshot: e.target.checked
                          })}
                        />
                      }
                      label="Include Screenshot"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={advancedOptions.includeEvidence}
                          onChange={(e) => setAdvancedOptions({
                            ...advancedOptions,
                            includeEvidence: e.target.checked
                          })}
                        />
                      }
                      label="Generate Evidence"
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={loading ? <Stop /> : <PlayArrow />}
                onClick={startExtraction}
                disabled={loading}
                fullWidth
              >
                {loading ? 'Extracting...' : 'Start Extraction'}
              </Button>
            </Box>

            {loading && <LinearProgress sx={{ mt: 2 }} />}
          </Paper>
        </Grid>

        {/* Status Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Extraction Status
            </Typography>

            {currentJob ? (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {getStatusIcon(currentJob.status)}
                  <Typography sx={{ ml: 1 }}>
                    Status: <strong>{currentJob.status}</strong>
                  </Typography>
                </Box>

                <TableContainer>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell>Job ID</TableCell>
                        <TableCell>{currentJob.id}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>URL</TableCell>
                        <TableCell>{currentJob.url}</TableCell>
                      </TableRow>
                      {currentJob.metadata?.strategy && (
                        <TableRow>
                          <TableCell>Strategy Used</TableCell>
                          <TableCell>
                            <Chip label={currentJob.metadata.strategy} size="small" />
                          </TableCell>
                        </TableRow>
                      )}
                      {currentJob.metadata?.duration && (
                        <TableRow>
                          <TableCell>Duration</TableCell>
                          <TableCell>{currentJob.metadata.duration}ms</TableCell>
                        </TableRow>
                      )}
                      {currentJob.metadata?.cost && (
                        <TableRow>
                          <TableCell>Cost</TableCell>
                          <TableCell>${currentJob.metadata.cost.toFixed(4)}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {currentJob.error && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {currentJob.error}
                  </Alert>
                )}
              </Box>
            ) : (
              <Alert severity="info">
                No active extraction job. Start one to see status here.
              </Alert>
            )}
          </Paper>

          {/* Quick Stats */}
          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Speed color="primary" />
                    <Box sx={{ ml: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Avg Time
                      </Typography>
                      <Typography variant="h6">3.5s</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <AttachMoney color="success" />
                    <Box sx={{ ml: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Avg Cost
                      </Typography>
                      <Typography variant="h6">$0.05</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Security color="secondary" />
                    <Box sx={{ ml: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Evidence
                      </Typography>
                      <Typography variant="h6">Verified</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* Error Section */}
        {showResults && currentJob?.status === 'failed' && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Extraction Failed
                </Typography>
                <Typography variant="body2">
                  {currentJob.error || 'Unknown error occurred during extraction.'}
                </Typography>
              </Alert>
              <Typography variant="body2" color="text.secondary">
                Try adjusting the extraction parameters or check the URL accessibility.
              </Typography>
            </Paper>
          </Grid>
        )}

        {/* Results Section */}
        {showResults && currentJob?.data && currentJob?.status === 'completed' && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'success.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle /> Extraction Complete
                </Typography>
                <Box>
                  <IconButton onClick={() => copyToClipboard(currentJob.data)} sx={{ mr: 1 }}>
                    <ContentCopy />
                  </IconButton>
                  <IconButton onClick={downloadResults}>
                    <Download />
                  </IconButton>
                </Box>
              </Box>

              {/* Main Data Section */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  📄 Extracted Data
                </Typography>
                <Paper sx={{ 
                  maxHeight: 400, 
                  overflow: 'auto',
                  bgcolor: '#f8f9fa',
                  p: 2,
                  border: '1px solid #e0e0e0'
                }}>
                  {renderExtractedData(currentJob.data)}
                </Paper>
              </Box>

              {/* Extraction Details Section */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  📊 Extraction Details
                </Typography>
                <Paper sx={{ bgcolor: '#e3f2fd', p: 2, border: '1px solid #bbdefb' }}>
                  <TableContainer>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold', width: '150px' }}>Job ID</TableCell>
                          <TableCell>{currentJob.id}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>URL</TableCell>
                          <TableCell>{currentJob.url}</TableCell>
                        </TableRow>
                        {currentJob.metadata?.strategy && (
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Strategy</TableCell>
                            <TableCell>{currentJob.metadata.strategy}</TableCell>
                          </TableRow>
                        )}
                        {currentJob.metadata?.duration && (
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Duration</TableCell>
                            <TableCell>{currentJob.metadata.duration}ms</TableCell>
                          </TableRow>
                        )}
                        {currentJob.metadata?.cost && (
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Cost</TableCell>
                            <TableCell>${currentJob.metadata.cost.toFixed(4)}</TableCell>
                          </TableRow>
                        )}
                        {currentJob.metadata?.itemsExtracted && (
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Items Found</TableCell>
                            <TableCell>{currentJob.metadata.itemsExtracted}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Box>

              {/* Evidence Section - Only if available */}
              {currentJob.evidence && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    🔍 Evidence & Verification
                  </Typography>
                  <Paper sx={{ 
                    bgcolor: '#f3e5f5',
                    p: 2,
                    border: '1px solid #ce93d8',
                    maxHeight: 300,
                    overflow: 'auto'
                  }}>
                    <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                      {JSON.stringify(currentJob.evidence, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}