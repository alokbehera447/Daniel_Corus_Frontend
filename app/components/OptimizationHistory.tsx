"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_URL } from "@/lib/config";


// const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface HistoryItem {
  id: number;
  job_name: string;
  efficiency: number;
  blocks_created: number;
  parts_packed: string;
  created_at: string;
  file_name: string;
  is_successful: boolean;
  has_error: boolean;
}

interface OptimizationDetails {
  id: number;
  job_name: string;
  created_at: string;
  efficiency: number;
  uploaded_file_name: string;
  uploaded_file_data: any[];
  selected_blocks: string[];
  selected_parents: string[];
  parameters: any;
  optimization_results: any;
  summary: {
    total_blocks_created: number;
    total_parts_packed: number;
    total_parts_requested: number;
    is_successful: boolean;
  };
}

interface OptimizationResult {
  success: boolean;
  efficiency: number;
  total_blocks_created: number;
  total_parts_packed: number;
  total_parts_requested: number;
  packing_percentage: number;
  total_stock_volume: number;
  total_prism_volume: number;
  waste_percentage: number;
  blocks: any[];
  scraps: any[];
  parent_labels: string[];
  prism_summary: any[];
  message: string;
  timestamp: string;
  user: string;
}

export default function OptimizationHistory() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OptimizationDetails | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'blocks' | 'scraps'>('summary');
  const [selectedBlockDetail, setSelectedBlockDetail] = useState<any>(null);
  const [showVisualization, setShowVisualization] = useState(false);
  const [visualizationUrl, setVisualizationUrl] = useState<string>('');
  const [visualizationType, setVisualizationType] = useState<'block' | 'scrap'>('block');
  const [isGeneratingVisualization, setIsGeneratingVisualization] = useState(false);
  const [visualizationRequestLock, setVisualizationRequestLock] = useState(false);
  const [results, setResults] = useState<OptimizationResult | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [username, setUsername] = useState<string>('');

  // Initialize from localStorage
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  // Get access token
  const getAccessToken = async () => {
    try {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('accessToken');
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const expiryTime = payload.exp * 1000;
          
          if (Date.now() > expiryTime - 5 * 60 * 1000) {
            if (refreshToken) {
              const response = await fetch(`${API_URL}/auth/refresh/`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refresh: refreshToken }),
              });
              
              if (response.ok) {
                const data = await response.json();
                localStorage.setItem('accessToken', data.access);
                return data.access;
              }
            }
          }
          return token;
        } catch (parseError) {
          return token;
        }
      }
    } catch (error) {
      console.error('Error in getAccessToken:', error);
      return null;
    }
  };

  const clearTokens = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    localStorage.removeItem('userInitial');
    localStorage.removeItem('isLoggedIn');
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Fetch history
  const fetchHistory = async (pageNum: number = 1) => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        showNotification('Session expired. Please login again.', 'error');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
        return;
      }

      const response = await fetch(`${API_URL}/api/optimization-history/?page=${pageNum}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.status === 401) {
        showNotification('Session expired. Please login again.', 'error');
        clearTokens();
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setHistory(data.data || []);
          setTotalPages(data.pagination?.total_pages || 1);
          setPage(pageNum);
        } else {
          showNotification(data.error || 'Failed to load history', 'error');
        }
      } else {
        showNotification('Failed to load history', 'error');
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      showNotification('Failed to load history', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch detailed view and load into results
  const fetchDetails = async (id: number) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        showNotification('Session expired. Please login again.', 'error');
        return;
      }

      const response = await fetch(`${API_URL}/api/optimization-history/${id}/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSelectedItem(data.data);
          
          // Transform the data to match main page results format
          const optimizationResults = data.data.optimization_results;
          const formattedResults: OptimizationResult = {
            success: true,
            efficiency: data.data.efficiency,
            total_blocks_created: optimizationResults.summary?.total_blocks_created || 0,
            total_parts_packed: optimizationResults.summary?.total_parts_packed || 0,
            total_parts_requested: optimizationResults.summary?.total_parts_requested || 0,
            packing_percentage: optimizationResults.summary?.total_parts_packed / optimizationResults.summary?.total_parts_requested * 100 || 0,
            total_stock_volume: optimizationResults.summary?.total_stock_volume || 0,
            total_prism_volume: optimizationResults.summary?.total_prism_volume || 0,
            waste_percentage: 100 - data.data.efficiency,
            blocks: optimizationResults.blocks || [],
            scraps: optimizationResults.scraps || [],
            parent_labels: data.data.selected_parents || [],
            prism_summary: data.data.prism_summary || [],
            message: `Loaded from history: ${data.data.job_name}`,
            timestamp: data.data.created_at,
            user: username
          };
          
          setResults(formattedResults);
          setActiveTab('summary');
          setSelectedBlockDetail(null);
          setShowVisualization(false);
          
          // Scroll to results
          setTimeout(() => {
            document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        } else {
          showNotification(data.error || 'Failed to load details', 'error');
        }
      } else {
        showNotification('Failed to load details', 'error');
      }
    } catch (error) {
      console.error('Error fetching details:', error);
      showNotification('Failed to load details', 'error');
    }
  };

  // Delete optimization
  const deleteOptimization = async (id: number) => {
    setDeleting(id);
    try {
      const token = await getAccessToken();
      if (!token) {
        showNotification('Session expired. Please login again.', 'error');
        return;
      }

      const response = await fetch(`${API_URL}/api/optimization-history/delete/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: [id] }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          showNotification('Optimization deleted successfully!');
          fetchHistory(page);
          if (selectedItem?.id === id) {
            setSelectedItem(null);
            setResults(null);
          }
        } else {
          showNotification(data.error || 'Failed to delete', 'error');
        }
      } else {
        showNotification('Failed to delete', 'error');
      }
    } catch (error) {
      console.error('Error deleting:', error);
      showNotification('Failed to delete', 'error');
    } finally {
      setDeleting(null);
    }
  };

  // Delete selected items
  const deleteSelected = async () => {
    if (!selectedIds.length) return;
    
    setDeleting(-1);
    
    try {
      const token = await getAccessToken();
      if (!token) {
        showNotification('Session expired. Please login again.', 'error');
        return;
      }

      const response = await fetch(`${API_URL}/api/optimization-history/delete/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedIds }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          showNotification(`Deleted ${data.deleted_count} record(s) successfully!`);
          setSelectedIds([]);
          fetchHistory(page);
          if (selectedItem && selectedIds.includes(selectedItem.id)) {
            setSelectedItem(null);
            setResults(null);
          }
        } else {
          showNotification(data.error || 'Failed to delete', 'error');
        }
      } else {
        showNotification('Failed to delete', 'error');
      }
    } catch (error) {
      console.error('Error deleting:', error);
      showNotification('Failed to delete', 'error');
    } finally {
      setDeleting(null);
    }
  };

  // Delete all history
  const deleteAll = async () => {
    if (!history.length) return;
    
    if (!window.confirm(`Are you sure you want to delete all ${history.length} optimization records? This action cannot be undone.`)) {
      return;
    }
    
    setDeleting(-2);
    
    try {
      const token = await getAccessToken();
      if (!token) {
        showNotification('Session expired. Please login again.', 'error');
        return;
      }

      const response = await fetch(`${API_URL}/api/optimization-history/delete/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ delete_all: true }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          showNotification(`Deleted all ${data.deleted_count} records!`);
          setHistory([]);
          setSelectedIds([]);
          setSelectedItem(null);
          setResults(null);
        } else {
          showNotification(data.error || 'Failed to delete all', 'error');
        }
      } else {
        showNotification('Failed to delete all', 'error');
      }
    } catch (error) {
      console.error('Error deleting all:', error);
      showNotification('Failed to delete all', 'error');
    } finally {
      setDeleting(null);
    }
  };

  // Rename optimization
  const renameOptimization = async () => {
    if (!selectedItem || !newName.trim()) return;
    
    try {
      const token = await getAccessToken();
      if (!token) {
        showNotification('Session expired. Please login again.', 'error');
        return;
      }

      const response = await fetch(`${API_URL}/api/optimization-history/${selectedItem.id}/rename/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ new_name: newName }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setEditingName(false);
          fetchHistory(page);
          if (selectedItem) {
            setSelectedItem({ ...selectedItem, job_name: newName });
          }
          showNotification('Renamed successfully!');
        } else {
          showNotification(data.error || 'Failed to rename', 'error');
        }
      } else {
        showNotification('Failed to rename', 'error');
      }
    } catch (error) {
      console.error('Error renaming:', error);
      showNotification('Failed to rename', 'error');
    }
  };

  // Visualization functions
  const generateBlockVisualization = async (blockCode: string) => {
    if (visualizationRequestLock) return;

    setVisualizationRequestLock(true);
    setIsGeneratingVisualization(true);
    setVisualizationType('block');

    try {
      const token = await getAccessToken();
      if (!token) {
        showNotification('Session expired. Please login again.', 'error');
        return;
      }

      const response = await fetch(`${API_URL}/api/visualization/block/${blockCode}/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Visualization generation failed');
      }

      const result = await response.json();

      if (result.success && result.visualization_url) {
        setTimeout(() => {
          setVisualizationUrl(`${API_URL}${result.visualization_url}`);
          setShowVisualization(true);
        }, 500);
      } else {
        throw new Error(result.error || 'Visualization failed');
      }
    } catch (err: any) {
      console.error(err);
      showNotification('Visualization is being prepared. Please try once.', 'error');
    } finally {
      setIsGeneratingVisualization(false);
      setVisualizationRequestLock(false);
    }
  };

  const generateScrapVisualization = async (scrapCode: string) => {
    if (visualizationRequestLock) return;

    setVisualizationRequestLock(true);
    setIsGeneratingVisualization(true);
    setVisualizationType('scrap');

    try {
      const token = await getAccessToken();
      if (!token) {
        showNotification('Session expired. Please login again.', 'error');
        return;
      }

      const response = await fetch(`${API_URL}/api/visualization/scrap/${scrapCode}/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Visualization generation failed');
      }

      const result = await response.json();

      if (result.success && result.visualization_url) {
        setTimeout(() => {
          setVisualizationUrl(`${API_URL}${result.visualization_url}`);
          setShowVisualization(true);
        }, 1500);
      } else {
        throw new Error(result.error || 'Visualization failed');
      }
    } catch (err: any) {
      console.error(err);
      showNotification('Visualization is being prepared. Please wait.', 'error');
    } finally {
      setIsGeneratingVisualization(false);
      setVisualizationRequestLock(false);
    }
  };

  // Helper function to render prism details
  const renderPrismsDetails = (prisms: any[]) => {
    return (
      <div className="space-y-1">
        {prisms.map((prism, idx) => (
          <div key={idx} className="flex justify-between text-sm">
            <span className="font-medium">{prism.code}</span>
            <span className="text-gray-600">
              {prism.number || prism.count} units
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Visualization Modal
  const renderVisualizationModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-2xl font-bold text-gray-800">
            {visualizationType === "block" ? "Block" : "Scrap"} 3D Visualization
          </h3>
          <button
            onClick={() => setShowVisualization(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg
              className="w-6 h-6 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {isGeneratingVisualization ? (
            <div className="flex flex-col items-center justify-center h-96">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Generating 3D visualization...</p>
            </div>
          ) : (
            <div className="h-[600px]">
              <iframe
                src={visualizationUrl}
                className="w-full h-full border-0 rounded-lg"
                title="3D Visualization"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Load history on component mount
  useEffect(() => {
    fetchHistory(1);
  }, []);

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  };

  const handleLogout = () => {
    clearTokens();
    router.push('/login');
  };

  // Notification Component
  const Notification = () => {
    if (!notification) return null;
    
    return (
      <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-down ${notification.type === 'success' ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-red-600'} text-white flex items-center gap-3`}>
        <svg className={`w-5 h-5 ${notification.type === 'success' ? 'text-green-100' : 'text-red-100'}`} fill="currentColor" viewBox="0 0 20 20">
          {notification.type === 'success' ? (
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          ) : (
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          )}
        </svg>
        <span className="font-medium">{notification.message}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Notification />
      
      {/* Header */}
      <header className="bg-white shadow-lg border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <img
                src="/danieli_logo.svg"
                alt="Danieli Corus Logo"
                className="h-10 w-auto"
              />
              <h1 className="text-3xl font-bold text-black tracking-tight">
                DANIELI <span className="font-light">CORUS</span>
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Back to Optimizer</span>
              </Link>

              <Link
                href="/"
                className="md:hidden flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full shadow-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300"
                title="Back to Main"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </Link>

              <div className="relative group">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg cursor-pointer shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  {username?.charAt(0).toUpperCase() || 'U'}
                </div>
                
                <div className="absolute right-0 top-full mt-2 w-56 bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                  <div className="p-4 border-b border-gray-100/50">
                    <p className="text-sm text-gray-600 font-medium">Signed in as</p>
                    <p className="font-semibold text-gray-800 truncate text-lg">{username}</p>
                  </div>
                  
                  <Link
                    href="/"
                    className="block w-full px-4 py-3.5 text-left text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors font-medium flex items-center gap-3 border-b border-gray-100/50"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span>Optimization Dashboard</span>
                  </Link>
                  
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3.5 text-left text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors font-medium flex items-center gap-3"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Toolbar */}
          <div className="p-6 border-b bg-gradient-to-r from-gray-50 to-white">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Optimization History</h2>
                <p className="text-gray-600 mt-1">View and manage previous optimization runs</p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                {selectedIds.length > 0 && (
                  <button
                    onClick={deleteSelected}
                    disabled={deleting === -1}
                    className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300 shadow-md hover:shadow-lg flex items-center gap-2 font-medium disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {deleting === -1 ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Delete Selected ({selectedIds.length})
                      </>
                    )}
                  </button>
                )}
                
                <button
                  onClick={deleteAll}
                  disabled={deleting === -2 || history.length === 0}
                  className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-300 shadow-md hover:shadow-lg flex items-center gap-2 font-medium disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {deleting === -2 ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Clearing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Clear All History
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => fetchHistory(1)}
                  disabled={loading}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-md hover:shadow-lg flex items-center gap-2 font-medium"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                      </svg>
                      Refresh
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Simplified Statistics */}
            <div className="mt-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 inline-block">
                <p className="text-sm font-medium text-blue-700 mb-1">Total Runs</p>
                <p className="text-2xl font-bold text-blue-800">{history.length}</p>
              </div>
            </div>
          </div>
          
          {/* History List */}
          <div className="p-6">
            {loading && history.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-lg font-medium text-gray-700">Loading optimization history...</p>
                <p className="text-gray-500 mt-2">Please wait while we fetch your data</p>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Optimization History</h3>
                <p className="text-gray-500 mb-6">Run an optimization to see it appear here.</p>
                <Link
                  href="/"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-md hover:shadow-lg font-medium"
                >
                  Go to Main Optimizer
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div key={item.id} className={`p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all duration-300 ${selectedIds.includes(item.id) ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-300 shadow-md' : 'bg-white'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds([...selectedIds, item.id]);
                              } else {
                                setSelectedIds(selectedIds.filter(id => id !== item.id));
                              }
                            }}
                            className="h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 focus:ring-2"
                          />
                          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${item.is_successful ? 'bg-green-500' : 'bg-red-500'} border-2 border-white`}></div>
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h4 className="font-bold text-gray-800 text-lg">{item.job_name}</h4>
                            {/* <span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.is_successful ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {item.is_successful ? '✓ Success' : '✗ Failed'}
                            </span> */}
                          </div>
                          <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                              </svg>
                              {formatDate(item.created_at)}
                            </span>
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                              </svg>
                              {item.file_name}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${item.efficiency > 70 ? 'bg-gradient-to-r from-green-100 to-green-50 text-green-800' : item.efficiency > 50 ? 'bg-gradient-to-r from-yellow-100 to-yellow-50 text-yellow-800' : 'bg-gradient-to-r from-red-100 to-red-50 text-red-800'}`}>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                            </svg>
                            <span className="font-bold">{item.efficiency}%</span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => fetchDetails(item.id)}
                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-sm hover:shadow-md"
                          >
                            View Results
                          </button>
                          <button
                            onClick={() => deleteOptimization(item.id)}
                            disabled={deleting === item.id}
                            className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300 shadow-sm hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                          >
                            {deleting === item.id ? (
                              <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Deleting...
                              </span>
                            ) : (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Results Section - Same as main page */}
        {results && (
          <div id="results-section" className="mt-8">
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-white/20 mb-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-2 h-8 bg-linear-to-b from-green-500 to-teal-600 rounded-full"></div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Optimization Results
                  {selectedItem && (
                    <span className="text-lg font-normal text-gray-600 ml-3">
                      • {selectedItem.job_name}
                    </span>
                  )}
                </h2>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-linear-to-br from-blue-500 to-blue-600 p-6 rounded-2xl text-white shadow-lg">
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2">
                      {results.efficiency}%
                    </div>
                    <div className="text-blue-100 text-lg">
                      Overall Efficiency
                    </div>
                  </div>
                </div>
                <div className="bg-linear-to-br from-green-500 to-green-600 p-6 rounded-2xl text-white shadow-lg">
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2">
                      {results.total_blocks_created}
                    </div>
                    <div className="text-green-100 text-lg">Blocks Created</div>
                  </div>
                </div>
                <div className="bg-linear-to-br from-purple-500 to-purple-600 p-6 rounded-2xl text-white shadow-lg">
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2">
                      {results.total_parts_packed}/{results.total_parts_requested}
                    </div>
                    <div className="text-purple-100 text-lg">Parts Packed</div>
                  </div>
                </div>
                <div className="bg-linear-to-br from-amber-500 to-amber-600 p-6 rounded-2xl text-white shadow-lg">
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2">
                      {results.scraps?.length || 0}
                    </div>
                    <div className="text-amber-100 text-lg">Scraps Generated</div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="mb-6">
                <div className="flex border-b border-gray-200">
                  <button
                    className={`py-3 px-6 font-medium text-lg transition-colors ${
                      activeTab === "summary"
                        ? "text-blue-600 border-b-2 border-blue-500"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                    onClick={() => setActiveTab("summary")}
                  >
                    Summary
                  </button>
                  <button
                    className={`py-3 px-6 font-medium text-lg transition-colors ${
                      activeTab === "blocks"
                        ? "text-blue-600 border-b-2 border-blue-500"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                    onClick={() => setActiveTab("blocks")}
                  >
                    Blocks ({results.total_blocks_created})
                  </button>
                  <button
                    className={`py-3 px-6 font-medium text-lg transition-colors ${
                      activeTab === "scraps"
                        ? "text-blue-600 border-b-2 border-blue-500"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                    onClick={() => setActiveTab("scraps")}
                  >
                    Scraps ({results.scraps?.length || 0})
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              <div className="min-h-[400px]">
                {activeTab === "summary" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gray-50 p-6 rounded-xl">
                        <h3 className="font-bold text-lg mb-4 text-gray-800">
                          Optimization Details
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Stock Volume:</span>
                            <span className="font-semibold text-gray-500">
                              {results.total_stock_volume?.toLocaleString() ||
                                "N/A"}{" "}
                              mm³
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Prism Volume:</span>
                            <span className="font-semibold text-gray-500">
                              {results.total_prism_volume?.toLocaleString() ||
                                "N/A"}{" "}
                              mm³
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              Waste Percentage:
                            </span>
                            <span className="font-semibold text-red-600">
                              {results.waste_percentage || "N/A"}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              Packing Percentage:
                            </span>
                            <span className="font-semibold text-green-600">
                              {results.packing_percentage || "N/A"}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gray-50 p-6 rounded-xl">
                        <h3 className="font-bold text-lg mb-4 text-gray-800">
                          Selected Stock Types
                        </h3>
                        <div className="space-y-2 text-gray-500">
                          {results.parent_labels.map((parent, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                              <span className="font-medium">{parent}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-6 rounded-xl">
                      <h3 className="font-bold text-lg mb-4 text-gray-800">
                        Message
                      </h3>
                      <p className="text-gray-700">{results.message}</p>
                    </div>
                  </div>
                )}

                {activeTab === "blocks" && (
                  <div className="space-y-6">
                    {/* BLOCK DETAILS */}
                    {selectedBlockDetail && (
                      <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl mb-6">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="font-bold text-lg text-gray-800">
                            Block Details: {selectedBlockDetail.code}
                          </h3>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                generateBlockVisualization(
                                  selectedBlockDetail.code
                                )
                              }
                              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium flex items-center gap-2"
                              disabled={
                                isGeneratingVisualization ||
                                visualizationRequestLock
                              }
                            >
                              {isGeneratingVisualization &&
                              visualizationType === "block" ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                    />
                                  </svg>
                                  View 3D Visualization
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => setSelectedBlockDetail(null)}
                              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold text-gray-700 mb-2">
                              Properties
                            </h4>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Efficiency:</span>
                                <span className="font-semibold text-gray-600">
                                  {selectedBlockDetail.efficiency}%
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Size:</span>
                                <span className="font-semibold text-gray-600">
                                  {selectedBlockDetail.size?.[0]} ×{" "}
                                  {selectedBlockDetail.size?.[1]} ×{" "}
                                  {selectedBlockDetail.size?.[2]} mm
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Volume:</span>
                                <span className="font-semibold text-gray-600">
                                  {selectedBlockDetail.size
                                    ? (
                                        selectedBlockDetail.size[0] *
                                        selectedBlockDetail.size[1] *
                                        selectedBlockDetail.size[2]
                                      ).toLocaleString()
                                    : "N/A"}{" "}
                                  mm³
                                </span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-700 mb-2">
                              Prisms in Block
                            </h4>
                            <div className="max-h-40 overflow-y-auto text-gray-600">
                              {renderPrismsDetails(
                                selectedBlockDetail.prisms || []
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* BLOCKS TABLE */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="p-4 text-left font-semibold text-gray-700">
                              Block Code
                            </th>
                            <th className="p-4 text-left font-semibold text-gray-700">
                              Efficiency
                            </th>
                            <th className="p-4 text-left font-semibold text-gray-700">
                              Prisms
                            </th>
                            <th className="p-4 text-left font-semibold text-gray-700">
                              Size (mm)
                            </th>
                            <th className="p-4 text-left font-semibold text-gray-700">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.blocks?.map((block: any, index: number) => (
                            <tr
                              key={index}
                              className={`border-b border-gray-200 hover:bg-gray-50 ${
                                selectedBlockDetail?.code === block.code
                                  ? "bg-blue-50"
                                  : ""
                              }`}
                            >
                              <td className="p-4">
                                <span className="font-bold text-blue-600">
                                  {block.code}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-green-500"
                                      style={{
                                        width: `${Math.min(
                                          100,
                                          block.efficiency
                                        )}%`,
                                      }}
                                    ></div>
                                  </div>
                                  <span className="font-semibold text-green-600">
                                    {block.efficiency}%
                                  </span>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="max-w-xs text-gray-700">
                                  {renderPrismsDetails(block.prisms || [])}
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="font-mono text-sm text-gray-700">
                                  {block.size?.[0]}×{block.size?.[1]}×
                                  {block.size?.[2]}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setSelectedBlockDetail(block)}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                                  >
                                    View Details
                                  </button>
                                  <button
                                    onClick={() =>
                                      generateBlockVisualization(block.code)
                                    }
                                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium flex items-center gap-2"
                                    disabled={
                                      isGeneratingVisualization ||
                                      visualizationRequestLock
                                    }
                                  >
                                    {isGeneratingVisualization &&
                                    visualizationType === "block" ? (
                                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                      <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                        />
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                        />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === "scraps" && (
                  <div>
                    {results.scraps && results.scraps.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="p-4 text-left font-semibold text-gray-700">
                                Scrap Code
                              </th>
                              <th className="p-4 text-left font-semibold text-gray-700">
                                Size (mm)
                              </th>
                              <th className="p-4 text-left font-semibold text-gray-700">
                                Volume (mm³)
                              </th>
                              <th className="p-4 text-left font-semibold text-gray-700">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.scraps.map((scrap: any, index: number) => (
                              <tr
                                key={index}
                                className="border-b border-gray-200 hover:bg-gray-50"
                              >
                                <td className="p-4">
                                  <span className="font-mono text-gray-500">
                                    {scrap.code}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <span className="font-mono text-sm text-gray-700">
                                    {scrap.size?.[0]}×{scrap.size?.[1]}×
                                    {scrap.size?.[2]}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <span className="font-semibold text-gray-700">
                                    {scrap.volume?.toLocaleString()}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <button
                                    onClick={() =>
                                      generateScrapVisualization(scrap.code)
                                    }
                                    className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium flex items-center gap-2"
                                    disabled={
                                      isGeneratingVisualization ||
                                      visualizationRequestLock
                                    }
                                  >
                                    {isGeneratingVisualization &&
                                    visualizationType === "scrap" ? (
                                      <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Generating...
                                      </>
                                    ) : (
                                      <>
                                        <svg
                                          className="w-4 h-4"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                          />
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                          />
                                        </svg>
                                        View 3D
                                      </>
                                    )}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-500">
                          No scraps generated from this optimization.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Visualization Modal */}
      {showVisualization && renderVisualizationModal()}
    </div>
  );
}