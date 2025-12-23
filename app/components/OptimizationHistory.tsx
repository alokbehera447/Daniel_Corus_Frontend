"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

export default function OptimizationHistory() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OptimizationDetails | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const [loadingOptimization, setLoadingOptimization] = useState<number | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [username, setUsername] = useState<string>('');

  // Initialize from localStorage
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  // Get access token with better error handling
  const getAccessToken = async () => {
    try {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('accessToken');
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        // Check if token might be expired (rough check)
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const expiryTime = payload.exp * 1000; // Convert to milliseconds
          
          // If token expires in less than 5 minutes, try to refresh
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
              } else {
                console.error('Token refresh failed, clearing tokens');
                clearTokens();
                router.push('/login');
                return null;
              }
            }
          }
          return token;
        } catch (parseError) {
          console.error('Error parsing token:', parseError);
          return token; // Return token even if parsing fails
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

  // Fetch detailed view
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
          setShowDetails(true);
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

  // Delete optimization (single)
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
            setShowDetails(false);
            setSelectedItem(null);
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
    
    setDeleting(-1); // -1 indicates bulk delete
    
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
    
    setDeleting(-2); // -2 indicates delete all
    
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

  // Load optimization to main view
  const loadToMainView = () => {
    if (!selectedItem) return;
    
    setLoadingOptimization(selectedItem.id);
    
    // Store comprehensive data for main view
    const optimizationData = {
      id: selectedItem.id,
      job_name: selectedItem.job_name,
      uploaded_file_name: selectedItem.uploaded_file_name,
      selected_blocks: selectedItem.selected_blocks,
      selected_parents: selectedItem.selected_parents,
      parameters: selectedItem.parameters,
      created_at: selectedItem.created_at,
      loadFromHistory: true,
      timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('loaded_optimization', JSON.stringify(optimizationData));
    
    showNotification('Optimization loaded! Redirecting to main view...');
    
    setTimeout(() => {
      router.push('/?loadOptimization=true');
    }, 1500);
  };

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

  // Render history item
  const renderHistoryItem = (item: HistoryItem) => (
    <div key={item.id} className={`p-5 border border-gray-200 rounded-xl mb-3 hover:border-blue-300 hover:shadow-md transition-all duration-300 ${selectedIds.includes(item.id) ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-300 shadow-md' : 'bg-white'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
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
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h4 className="font-bold text-gray-800 text-lg">{item.job_name}</h4>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${item.is_successful ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {item.is_successful ? 'Successful' : 'Failed'}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                <span>{item.file_name}</span>
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                <span>{formatDate(item.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${item.efficiency > 70 ? 'bg-gradient-to-r from-green-100 to-green-50 text-green-800' : item.efficiency > 50 ? 'bg-gradient-to-r from-yellow-100 to-yellow-50 text-yellow-800' : 'bg-gradient-to-r from-red-100 to-red-50 text-red-800'}`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
              </svg>
              <span className="font-bold">{item.efficiency}%</span>
            </div>
            <p className="text-sm text-gray-600 mt-2 font-medium">
              {item.blocks_created} block{item.blocks_created !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => fetchDetails(item.id)}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-sm hover:shadow-md"
            >
              View Details
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
              ) : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Render details modal
  const renderDetailsModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-gray-200">
        <div className="flex justify-between items-center p-6 border-b bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3">
            {editingName ? (
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                  onKeyDown={(e) => e.key === 'Enter' && renameOptimization()}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={renameOptimization} className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-colors font-medium">
                    Save
                  </button>
                  <button onClick={() => setEditingName(false)} className="px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 transition-colors font-medium">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-bold text-gray-800">{selectedItem?.job_name}</h3>
                <button
                  onClick={() => {
                    setNewName(selectedItem?.job_name || '');
                    setEditingName(true);
                  }}
                  className="text-blue-600 hover:text-blue-800 transition-colors"
                  title="Rename"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              </>
            )}
          </div>
          <button
            onClick={() => {
              setShowDetails(false);
              setEditingName(false);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto max-h-[70vh]">
          {selectedItem && (
            <div className="space-y-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-700">Efficiency</p>
                      <p className="text-3xl font-bold text-blue-800">{selectedItem.efficiency}%</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M11.17 3a1 1 0 01.832.445l4.5 6A1 1 0 0116 10H4a1 1 0 01-.832-1.555l4.5-6A1 1 0 0111.17 3z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-700">Blocks Created</p>
                      <p className="text-3xl font-bold text-green-800">{selectedItem.summary.total_blocks_created}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-purple-700">Parts Packed</p>
                      <p className="text-3xl font-bold text-purple-800">
                        {selectedItem.summary.total_parts_packed}/{selectedItem.summary.total_parts_requested}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-xl border border-amber-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-amber-700">Date</p>
                      <p className="text-lg font-bold text-amber-800">
                        {formatDate(selectedItem.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4 pt-6 border-t">
                <button
                  onClick={loadToMainView}
                  disabled={loadingOptimization === selectedItem.id}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-3 font-semibold"
                >
                  {loadingOptimization === selectedItem.id ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                      </svg>
                      Load in Main View
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    const dataStr = JSON.stringify(selectedItem, null, 2);
                    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                    const exportFileDefaultName = `${selectedItem.job_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_optimization.json`;
                    const linkElement = document.createElement('a');
                    linkElement.setAttribute('href', dataUri);
                    linkElement.setAttribute('download', exportFileDefaultName);
                    document.body.appendChild(linkElement);
                    linkElement.click();
                    document.body.removeChild(linkElement);
                    showNotification('Export started! Check your downloads.');
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-3 font-semibold"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Export as JSON
                </button>
                
                <button
                  onClick={() => deleteOptimization(selectedItem.id)}
                  disabled={deleting === selectedItem.id}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-3 font-semibold"
                >
                  {deleting === selectedItem.id ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

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
      
      {/* Header - Same as main page */}
      <header className="bg-white shadow-lg border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Company Logo and Name */}
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

            {/* User Controls */}
            <div className="flex items-center gap-4">
              {/* Back to Main Button */}
              <Link
                href="/"
                className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Back to Optimizer</span>
              </Link>

              {/* Mobile Back Button */}
              <Link
                href="/"
                className="md:hidden flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full shadow-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300"
                title="Back to Main"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </Link>

              {/* User Profile */}
              <div className="relative group">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg cursor-pointer shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  {username?.charAt(0).toUpperCase() || 'U'}
                </div>
                
                {/* User Dropdown */}
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
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden mt-6">
          {/* Toolbar */}
          <div className="p-6 border-b bg-gradient-to-r from-gray-50 to-white">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Optimization History</h2>
                <p className="text-gray-600 mt-1">View, manage, and reload previous optimizations</p>
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
            
            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                <p className="text-sm font-medium text-blue-700 mb-1">Total Runs</p>
                <p className="text-2xl font-bold text-blue-800">{history.length}</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                <p className="text-sm font-medium text-green-700 mb-1">Successful</p>
                <p className="text-2xl font-bold text-green-800">
                  {history.filter(h => h.is_successful).length}
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
                <p className="text-sm font-medium text-purple-700 mb-1">Avg Efficiency</p>
                <p className="text-2xl font-bold text-purple-800">
                  {history.length > 0 
                    ? Math.round(history.reduce((sum, h) => sum + h.efficiency, 0) / history.length) 
                    : 0}%
                </p>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-xl border border-amber-200">
                <p className="text-sm font-medium text-amber-700 mb-1">Total Blocks</p>
                <p className="text-2xl font-bold text-amber-800">
                  {history.reduce((sum, h) => sum + h.blocks_created, 0)}
                </p>
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
                {history.map(renderHistoryItem)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && renderDetailsModal()}
    </div>
  );
}