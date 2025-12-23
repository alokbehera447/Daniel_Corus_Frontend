"use client";

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { API_URL } from '@/lib/config';
export const dynamic = 'force-dynamic';

export default function VisualizationContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [fileInfo, setFileInfo] = useState<{name?: string; size?: number; url?: string}>({});
  const [showDropdown, setShowDropdown] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const filename = searchParams.get('file');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!filename) {
      setError('No visualization file specified');
      setLoading(false);
      return;
    }

    // Extract filename for display
    const cleanName = decodeURIComponent(filename).split('/').pop() || filename;
    setFileInfo(prev => ({...prev, name: cleanName}));
    
    loadVisualization(filename);
  }, [filename]);

  const loadVisualization = async (filename: string) => {
    try {
      setLoading(true);
      setError(null);
      setIframeLoaded(false);

      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Please login first');
      }

      // Clean filename
      let cleanFilename = filename;
      if (cleanFilename.startsWith('visualizations/')) {
        cleanFilename = cleanFilename.replace('visualizations/', '');
      }

      console.log(`Loading visualization: ${cleanFilename}`);
      
      const response = await fetch(`${API_URL}/api/visualizations/${cleanFilename}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/html'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please login again.');
        } else if (response.status === 404) {
          throw new Error(`Visualization file not found: ${cleanFilename}`);
        }
        throw new Error(`Failed to load visualization: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      setHtmlContent(html);
      
      // Get content length for info
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const sizeInKB = Math.round(parseInt(contentLength) / 1024);
        setFileInfo(prev => ({...prev, size: sizeInKB}));
      }

      // Create a blob URL for downloading
      const blob = new Blob([html], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      setFileInfo(prev => ({...prev, url: blobUrl}));
      
    } catch (err: any) {
      console.error('Error loading visualization:', err);
      setError(err.message || 'Failed to load visualization. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    if (filename) {
      loadVisualization(filename);
    }
  };

  const handleBackToDashboard = () => {
    router.push('/');
  };

  const handleIframeLoad = () => {
    setIframeLoaded(true);
  };

  const handleDownload = () => {
    if (fileInfo.url && fileInfo.name) {
      const link = document.createElement('a');
      link.href = fileInfo.url;
      link.download = `${fileInfo.name.replace('.html', '')}_visualization.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Show download confirmation
      setShowDropdown(false);
      alert(`Visualization downloaded as ${link.download}`);
    }
  };

  const handlePrint = () => {
    const iframe = document.getElementById('visualization-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.log('Print not available:', e);
        // Fallback: open in new window and print
        const printWindow = window.open('', '_blank');
        if (printWindow && htmlContent) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 500);
        }
      }
    }
    setShowDropdown(false);
  };

  const handleCopyLink = () => {
    const currentUrl = window.location.href;
    navigator.clipboard.writeText(currentUrl)
      .then(() => {
        alert('Link copied to clipboard!');
        setShowDropdown(false);
      })
      .catch(err => {
        console.error('Failed to copy link:', err);
      });
  };

  // Handle iframe resizing based on content
  useEffect(() => {
    if (iframeLoaded && htmlContent) {
      // Set a timeout to ensure iframe is fully loaded
      setTimeout(() => {
        try {
          const iframe = document.getElementById('visualization-iframe') as HTMLIFrameElement;
          if (iframe && iframe.contentWindow) {
            // Try to get the actual content height
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const bodyHeight = iframeDoc.body.scrollHeight;
            const htmlHeight = iframeDoc.documentElement.scrollHeight;
            const height = Math.max(bodyHeight, htmlHeight);
            
            // Set minimum height for better viewing
            if (height > 800) {
              iframe.style.height = `${height}px`;
            } else {
              iframe.style.height = '100%';
            }
          }
        } catch (e) {
          console.log('Could not access iframe content due to cross-origin policy');
        }
      }, 1000);
    }
  }, [iframeLoaded, htmlContent]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (fileInfo.url) {
        URL.revokeObjectURL(fileInfo.url);
      }
    };
  }, [fileInfo.url]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 border-4 border-blue-100 rounded-full"></div>
            <div className="absolute top-0 left-0 w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="w-8 h-8 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Loading Visualization</h2>
          <p className="text-gray-600 mb-4">
            Preparing interactive 3D cutting optimization view...
          </p>
          <div className="space-y-2">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse w-3/4"></div>
            </div>
            <p className="text-sm text-gray-500">
              {filename ? `Loading: ${decodeURIComponent(filename).split('/').pop()}` : 'Fetching visualization data...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-100 to-red-50 rounded-full mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Unable to Load Visualization</h2>
            <p className="text-gray-600">{error}</p>
          </div>
          
          <div className="space-y-4">
            <div className="bg-blue-50/50 border border-blue-200/50 rounded-xl p-4">
              <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Troubleshooting Steps
              </h3>
              <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                <li>Verify you are logged in</li>
                <li>Check your internet connection</li>
                <li>Try reloading the page</li>
                <li>Contact support if issue persists</li>
              </ul>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleBackToDashboard}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 font-semibold rounded-xl hover:from-gray-200 hover:to-gray-300 transition-all duration-300 flex items-center justify-center gap-2 shadow-sm hover:shadow"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
              </button>
              <button
                onClick={handleRetry}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm shadow-lg border-b border-gray-200/50">
        <div className="max-w-8xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <button
                onClick={handleBackToDashboard}
                className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 font-semibold rounded-xl hover:from-gray-100 hover:to-gray-200 transition-all duration-300 hover:shadow-md border border-gray-200/50 group"
              >
                <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-800 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="hidden md:inline">Return to Dashboard</span>
                <span className="md:hidden">Dashboard</span>
              </button>
              
              <div className="hidden md:block h-8 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent"></div>
              
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  3D Cutting Optimization Visualization
                </h1>
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    {fileInfo.name || 'Visualization'}
                  </span>
                  {fileInfo.size && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span>{fileInfo.size} KB</span>
                    </>
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.location.reload()}
                className="p-2.5 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-600 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all duration-300 hover:shadow-md border border-blue-200/50"
                title="Refresh visualization"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="p-2.5 bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 rounded-xl hover:from-gray-100 hover:to-gray-200 transition-all duration-300 hover:shadow-md border border-gray-200/50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
                
                {showDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 z-50 overflow-hidden">
                    <div className="p-2">
                      <button
                        onClick={handleDownload}
                        className="w-full px-4 py-3 text-left text-gray-700 hover:bg-green-50 hover:text-green-600 rounded-lg transition-colors flex items-center gap-3"
                        disabled={!fileInfo.url}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download as HTML
                      </button>
                      <button
                        onClick={handlePrint}
                        className="w-full px-4 py-3 text-left text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Print Visualization
                      </button>
                      <button
                        onClick={handleCopyLink}
                        className="w-full px-4 py-3 text-left text-gray-700 hover:bg-purple-50 hover:text-purple-600 rounded-lg transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Link
                      </button>
                      <button
                        onClick={handleRetry}
                        className="w-full px-4 py-3 text-left text-gray-700 hover:bg-yellow-50 hover:text-yellow-600 rounded-lg transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Reload Visualization
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-8xl mx-auto px-6 py-6">
        {/* Visualization Container */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
          {/* Container Header */}
          <div className="px-6 py-4 border-b border-gray-200/50 bg-gradient-to-r from-blue-50/50 to-purple-50/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Interactive 3D View</h2>
                <p className="text-sm text-gray-600">
                  Rotate, zoom, and pan to explore the cutting optimization layout
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!iframeLoaded && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span>Rendering visualization...</span>
                  </div>
                )}
                {iframeLoaded && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Visualization ready</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Visualization Frame */}
          <div className="relative">
            {!iframeLoaded && htmlContent && (
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">Finalizing 3D rendering...</p>
                </div>
              </div>
            )}
            
            <div className="min-h-[800px] h-auto">
              <iframe
                id="visualization-iframe"
                srcDoc={htmlContent}
                className="w-full min-h-[800px] h-auto border-0"
                title="3D Cutting Optimization Visualization"
                sandbox="allow-scripts allow-same-origin allow-popups"
                onLoad={handleIframeLoad}
                style={{
                  minHeight: '800px',
                  height: 'auto'
                }}
              />
            </div>
          </div>
          
          {/* Help Section */}
          <div className="px-6 py-4 border-t border-gray-200/50 bg-gradient-to-r from-gray-50/50 to-gray-100/50">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Visualization Controls</p>
                  <p className="text-xs text-gray-500">
                    Use mouse/touch to rotate, scroll to zoom, drag to pan
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  disabled={!fileInfo.url}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2 ${
                    fileInfo.url 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
                      : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download
                </button>
                <button
                  onClick={() => {
                    // Scroll to top and refresh
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    setTimeout(handleRetry, 300);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-semibold rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh View
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer Note */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Danieli Corus • Advanced Cutting Optimization System • {new Date().getFullYear()}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            This interactive visualization shows the optimal cutting layout for maximum material efficiency
          </p>
        </div>
      </main>
      
      {/* Loading Overlay (for iframe) */}
      {!iframeLoaded && htmlContent && (
        <div className="fixed inset-0 bg-black/5 backdrop-blur-sm z-40 pointer-events-none"></div>
      )}
    </div>
  );
}