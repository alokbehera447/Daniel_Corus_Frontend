"use client";

import React, { useState, useRef, useEffect } from "react";
import { API_URL } from "@/lib/config";

export default function Home() {
  // ==========================
  // AUTHENTICATION STATE
  // ==========================
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [userInitial, setUserInitial] = useState("");
  const [accessToken, setAccessToken] = useState<string>("");
  const [refreshToken, setRefreshToken] = useState<string>("");

  // ==========================
  // EXISTING STATE MANAGEMENT
  // ==========================
  const [blockData, setBlockData] = useState<any[]>([]);
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PARENT BLOCK MANAGEMENT
  const [customParentBlocks, setCustomParentBlocks] = useState<any[]>([
    {
      label: "800×350×1870",
      dimensions: { length: 1870, width: 800, height: 350 },
    },
    {
      label: "800×400×2000",
      dimensions: { length: 2000, width: 800, height: 400 },
    },
  ]);

  // Custom parent block form state
  const [showCustomParentForm, setShowCustomParentForm] = useState(false);
  const [newParentLabel, setNewParentLabel] = useState("");
  const [newParentLength, setNewParentLength] = useState("");
  const [newParentWidth, setNewParentWidth] = useState("");
  const [newParentHeight, setNewParentHeight] = useState("");

  const [selectedParents, setSelectedParents] = useState<string[]>(["800×350×1870"]);

  // RUN LOGIC
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  // Results display
  const [selectedBlockDetail, setSelectedBlockDetail] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "blocks" | "scraps">(
    "summary"
  );

  // Visualization state
  const [showVisualization, setShowVisualization] = useState(false);
  const [visualizationUrl, setVisualizationUrl] = useState<string>("");
  const [visualizationType, setVisualizationType] = useState<"block" | "scrap">(
    "block"
  );
  const [isGeneratingVisualization, setIsGeneratingVisualization] =
    useState(false);
  const [visualizationRequestLock, setVisualizationRequestLock] =
    useState(false);

  // ==========================
  // JWT AUTHENTICATION FUNCTIONS (unchanged)
  // ==========================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    if (!username.trim() || !password.trim()) {
      setLoginError("Please enter both username and password");
      setLoginLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.detail || `Login failed: ${response.statusText}`
        );
      }

      const data = await response.json();

      // Store tokens
      setAccessToken(data.access);
      setRefreshToken(data.refresh);

      // Update authentication state
      setIsLoggedIn(true);
      setShowLogin(false);
      setUserInitial(username.charAt(0).toUpperCase());

      // Store authentication state
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userInitial", username.charAt(0).toUpperCase());
      localStorage.setItem("accessToken", data.access);
      localStorage.setItem("refreshToken", data.refresh);
      localStorage.setItem("username", username.trim());

      setLoginError("");
    } catch (error: any) {
      console.error("Login error:", error);
      setLoginError(error.message || "Invalid credentials. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  const refreshAccessToken = async () => {
    try {
      const refresh = localStorage.getItem("refreshToken");
      if (!refresh) {
        throw new Error("No refresh token available");
      }

      const response = await fetch(`${API_URL}/auth/refresh/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refresh: refresh,
        }),
      });

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      const data = await response.json();
      const newAccessToken = data.access;

      // Update tokens
      setAccessToken(newAccessToken);
      localStorage.setItem("accessToken", newAccessToken);

      return newAccessToken;
    } catch (error) {
      console.error("Token refresh error:", error);
      handleLogout();
      return null;
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setShowLogin(true);
    setUsername("");
    setPassword("");
    setUserInitial("");
    setAccessToken("");
    setRefreshToken("");
    setIsUserDropdownOpen(false);

    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userInitial");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("username");
  };

  // Check for existing login on component mount
  useEffect(() => {
    const loggedIn = localStorage.getItem("isLoggedIn");
    const initial = localStorage.getItem("userInitial");
    const storedAccessToken = localStorage.getItem("accessToken");
    const storedRefreshToken = localStorage.getItem("refreshToken");
    const storedUsername = localStorage.getItem("username");

    if (
      loggedIn === "true" &&
      initial &&
      storedAccessToken &&
      storedRefreshToken &&
      storedUsername
    ) {
      setIsLoggedIn(true);
      setShowLogin(false);
      setUserInitial(initial);
      setAccessToken(storedAccessToken);
      setRefreshToken(storedRefreshToken);
      setUsername(storedUsername);
    }
  }, []);

  // ==========================
  // AUTHENTICATED API REQUEST FUNCTION
  // ==========================
const makeAuthenticatedRequest = async (
  url: string,
  options: RequestInit = {}
) => {
  let token = accessToken;

  if (!token) {
    const storedToken = localStorage.getItem("accessToken");
    if (storedToken) {
      token = storedToken;
      setAccessToken(storedToken);
    } else {
      showMainNotification("Please login again", "error");
      setTimeout(() => {
        handleLogout();
      }, 1000);
      throw new Error("No authentication token available");
    }
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  if (options.body instanceof FormData) {
    headers.delete("Content-Type");
  } else {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  let fullUrl = url;
  if (url.startsWith("/")) {
    fullUrl = `${API_URL}${url}`;
  }

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Try to refresh token
      try {
        const newToken = await refreshAccessToken();
        if (newToken) {
          headers.set("Authorization", `Bearer ${newToken}`);
          
          if (options.body instanceof FormData) {
            headers.delete("Content-Type");
          }
          
          // Retry with new token
          return await fetch(fullUrl, { ...options, headers });
        } else {
          showMainNotification("Session expired. Please login again.", "error");
          setTimeout(() => {
            handleLogout();
          }, 2000);
          throw new Error("Session expired");
        }
      } catch (refreshError) {
        showMainNotification("Session expired. Please login again.", "error");
        setTimeout(() => {
          handleLogout();
        }, 2000);
        throw new Error("Session expired");
      }
    }

    return response;
  } catch (error) {
    console.error("API request error:", error);
    throw error;
  }
};

  // ==========================
  // CUSTOM PARENT BLOCK FUNCTIONS
  // ==========================
  const validateCustomParentBlock = () => {
    if (!newParentLabel.trim()) {
      setError("Please enter a label for the parent block");
      return false;
    }

    if (
      customParentBlocks.some((block) => block.label === newParentLabel.trim())
    ) {
      setError("A parent block with this label already exists");
      return false;
    }

    const length = parseFloat(newParentLength);
    const width = parseFloat(newParentWidth);
    const height = parseFloat(newParentHeight);

    if (isNaN(length) || length <= 0) {
      setError("Please enter a valid positive length");
      return false;
    }

    if (isNaN(width) || width <= 0) {
      setError("Please enter a valid positive width");
      return false;
    }

    if (isNaN(height) || height <= 0) {
      setError("Please enter a valid positive height");
      return false;
    }

    return true;
  };

  const addCustomParentBlock = () => {
    if (!validateCustomParentBlock()) return;

    const newBlock = {
      label: newParentLabel.trim(),
      dimensions: {
        length: parseFloat(newParentLength),
        width: parseFloat(newParentWidth),
        height: parseFloat(newParentHeight),
      },
    };

    setCustomParentBlocks([...customParentBlocks, newBlock]);

    // Clear form
    setNewParentLabel("");
    setNewParentLength("");
    setNewParentWidth("");
    setNewParentHeight("");
    setShowCustomParentForm(false);
    setError(null);
  };

  const removeCustomParentBlock = (label: string) => {
    // Don't remove if it's selected
    if (selectedParents.includes(label)) {
      setError(
        `Cannot remove "${label}" because it is selected. Deselect it first.`
      );
      return;
    }

    setCustomParentBlocks(
      customParentBlocks.filter((block) => block.label !== label)
    );
  };

  // ==========================
  // VISUALIZATION FUNCTIONS - FIXED ENDPOINTS
  // ==========================
  const generateBlockVisualization = async (blockCode: string) => {
    // ⛔ Prevent duplicate clicks
    if (visualizationRequestLock) return;

    setVisualizationRequestLock(true);
    setIsGeneratingVisualization(true);
    setVisualizationType("block");

    try {
      const response = await makeAuthenticatedRequest(
        `/api/visualization/block/${blockCode}/`,
        { method: "POST" }
      );

      if (!response.ok) {
        throw new Error("Visualization generation failed");
      }

      const result = await response.json();

      if (result.success && result.visualization_url) {
        // ✅ WAIT 300ms so backend finishes writing file
        setTimeout(() => {
          setVisualizationUrl(`${API_URL}${result.visualization_url}`);
          setShowVisualization(true);
        }, 500);
      } else {
        throw new Error(result.error || "Visualization failed");
      }
    } catch (err: any) {
      console.error(err);
      setError("Visualization is being prepared. Please try once.");
    } finally {
      setIsGeneratingVisualization(false);
      setVisualizationRequestLock(false);
    }
  };

  const generateScrapVisualization = async (scrapCode: string) => {
    if (visualizationRequestLock) return;

    setVisualizationRequestLock(true);
    setIsGeneratingVisualization(true);
    setVisualizationType("scrap");

    try {
      const response = await makeAuthenticatedRequest(
        `/api/visualization/scrap/${scrapCode}/`,
        { method: "POST" }
      );

      if (!response.ok) {
        throw new Error("Visualization generation failed");
      }

      const result = await response.json();

      if (result.success && result.visualization_url) {
        setTimeout(() => {
          setVisualizationUrl(`${API_URL}${result.visualization_url}`);
          setShowVisualization(true);
        }, 1500);
      } else {
        throw new Error(result.error || "Visualization failed");
      }
    } catch (err: any) {
      console.error(err);
      setError("Visualization is being prepared. Please wait.");
    } finally {
      setIsGeneratingVisualization(false);
      setVisualizationRequestLock(false);
    }
  };

  // ==========================
  // UPDATED FILE IMPORT HANDLER
  // ==========================
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
      setError("Please upload a valid Excel file (.xlsx, .xls, .csv)");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setError(null);

      const response = await makeAuthenticatedRequest(`/api/upload/`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Authentication required. Please login again.");
        }
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        setBlockData(result.data);
        setSelectedBlocks([]);
        setIsDropdownOpen(false);
        setSearchTerm("");
      } else {
        setError(result.error || "Failed to process Excel file");
      }
    } catch (error: any) {
      console.error("Error uploading file:", error);
      setError(error.message || "Error uploading file. Please try again.");
    }
  };

  // ==========================
  // HELPER FUNCTIONS
  // ==========================
  const getBlockIdentifier = (block: any) => {
    try {
      const identifier =
        block?.MARK || block?.mark || `Block-${blockData.indexOf(block) + 1}`;
      return String(identifier || "");
    } catch (error) {
      console.error("Error getting block identifier:", error, block);
      return `Block-${blockData.indexOf(block) + 1}`;
    }
  };

  const getBlockValue = (block: any, field: string) => {
    if (!block) return "N/A";

    const value =
      block[field] ||
      block[field.toLowerCase()] ||
      block[field.replace(/\s+/g, "")] ||
      "N/A";

    return value !== undefined && value !== null && value !== ""
      ? value
      : "N/A";
  };

  const selectAll =
    selectedBlocks.length === blockData.length && blockData.length > 0;

  const filteredBlocks = blockData.filter((block) => {
    try {
      const blockId = getBlockIdentifier(block);
      const searchText = searchTerm.toLowerCase();
      return String(blockId).toLowerCase().includes(searchText);
    } catch (error) {
      console.error("Error in block filtering:", error, block);
      return false;
    }
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isMobile && !target.closest(".user-profile-dropdown")) {
        setIsUserDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile]);

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkDevice();
    window.addEventListener("resize", checkDevice);
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  // Add at the top of your main page component
  // useEffect(() => {
  //   // Check if we need to load optimization from history
  //   const params = new URLSearchParams(window.location.search);
  //   if (params.has("loadOptimization")) {
  //     const savedData = localStorage.getItem("load_optimization");
  //     if (savedData) {
  //       try {
  //         const optimization = JSON.parse(savedData);
  //         // Load the optimization into your main page state
  //         // This depends on your main page structure
  //         console.log("Loading optimization:", optimization);

  //         // Clear the URL parameter
  //         window.history.replaceState({}, "", "/");
  //       } catch (error) {
  //         console.error("Failed to load optimization:", error);
  //       }
  //     }
  //   }
  // }, []);

  // In your main page component, add this useEffect
// Add these state variables near your other state declarations
const [fileName, setFileName] = useState<string>("");
const [bufferSpacing, setBufferSpacing] = useState<number>(2.0);
const [selectedParentBlocks, setSelectedParentBlocks] = useState<string[]>([]);

// Add notification state
const [mainNotification, setMainNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

// Add this function to show notifications in main page
const showMainNotification = (message: string, type: 'success' | 'error' = 'success') => {
  setMainNotification({ message, type });
  setTimeout(() => setMainNotification(null), 3000);
};

// Add this useEffect to handle loading optimization from history
useEffect(() => {
  const loadOptimizationFromHistory = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('loadOptimization')) {
      try {
        const savedData = localStorage.getItem('loaded_optimization');
        if (savedData) {
          const optimization = JSON.parse(savedData);
          
          // Clear the URL parameter
          window.history.replaceState({}, '', '/');
          
          // Load the optimization into your state
          if (optimization.loadFromHistory) {
            // Set your form fields with the loaded data
            setFileName(optimization.uploaded_file_name || "");
            setSelectedBlocks(optimization.selected_blocks || []);
            setSelectedParentBlocks(optimization.selected_parents || []);
            setBufferSpacing(optimization.parameters?.buffer_spacing || 2.0);
            
            // Show notification
            showMainNotification(`Loaded optimization: ${optimization.job_name || 'Previous optimization'}`);
            
            // Clear the stored data
            localStorage.removeItem('loaded_optimization');
          }
        }
      } catch (error) {
        console.error('Failed to load optimization:', error);
        showMainNotification('Failed to load optimization from history', 'error');
      }
    }
  };

  loadOptimizationFromHistory();
}, []);

// Add this Notification component to your main page render
const MainNotification = () => {
  if (!mainNotification) return null;
  
  return (
    <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-down ${mainNotification.type === 'success' ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-red-600'} text-white flex items-center gap-3`}>
      <svg className={`w-5 h-5 ${mainNotification.type === 'success' ? 'text-green-100' : 'text-red-100'}`} fill="currentColor" viewBox="0 0 20 20">
        {mainNotification.type === 'success' ? (
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        ) : (
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        )}
      </svg>
      <span className="font-medium">{mainNotification.message}</span>
    </div>
  );
};

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // ==========================
  // BLOCK SELECTION HANDLERS
  // ==========================
  const toggleBlock = (mark: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedBlocks((prev) =>
      prev.includes(mark) ? prev.filter((x) => x !== mark) : [...prev, mark]
    );
  };

  const handleSelectAll = () => {
    if (!selectAll) {
      setSelectedBlocks(blockData.map((b) => getBlockIdentifier(b)));
    } else {
      setSelectedBlocks([]);
    }
  };

  const removeSelectedBlock = (mark: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBlocks((prev) => prev.filter((m) => m !== mark));
  };

  // ==========================
  // PARENT BLOCK SELECTION HANDLERS
  // ==========================
  const toggleParentBlock = (parent: string) => {
    setSelectedParents((prev) =>
      prev.includes(parent)
        ? prev.filter((p) => p !== parent)
        : [...prev, parent]
    );
  };

  const handleSelectAllParents = () => {
    if (selectedParents.length === customParentBlocks.length) {
      setSelectedParents([]);
    } else {
      setSelectedParents(customParentBlocks.map((p) => p.label));
    }
  };

  // ==========================
  // UPDATED RUN BUTTON LOGIC - FIXED PARAMETERS
  // ==========================
  const onRun = async () => {
    if (blockData.length === 0) {
      setError("Please import an Excel file first.");
      return;
    }

    if (selectedBlocks.length === 0) {
      setError("Please select at least one block.");
      return;
    }

    if (selectedParents.length === 0) {
      setError("Please select at least one parent block.");
      return;
    }

    setError(null);
    setRunning(true);
    setResults(null);
    setSelectedBlockDetail(null);
    setShowVisualization(false);

    try {
      // Get selected parent block dimensions
      const selectedDimensions = selectedParents
        .map((label) => {
          const parent = customParentBlocks.find((p) => p.label === label);
          return parent
            ? {
                label: parent.label,
                dimensions: parent.dimensions,
              }
            : null;
        })
        .filter(Boolean);

      if (selectedDimensions.length === 0) {
        throw new Error("No valid stock dimensions selected");
      }

      // Create FormData for the API request
      const formData = new FormData();

      // Get the current file from input
      const fileInput = fileInputRef.current;
      if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        throw new Error("No file selected");
      }

      const file = fileInput.files[0];
      formData.append("file", file);

      // Add selected blocks as JSON string
      formData.append("selected_blocks", JSON.stringify(selectedBlocks));

      // Add parent blocks as JSON string - CORRECT PARAMETER NAME
      formData.append(
        "parent_blocks",
        JSON.stringify(
          selectedDimensions
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .map((item) => ({
              label: item.label,
              dimensions: item.dimensions,
            }))
        )
      );

      // Add buffer spacing
      formData.append("buffer_spacing", "2.0");

      console.log("Sending optimization request with:", {
        file: file.name,
        selected_blocks: selectedBlocks,
        parent_blocks: selectedDimensions,
        buffer_spacing: 2.0,
      });

      // Call the API endpoint for optimization
      const response = await makeAuthenticatedRequest(`/api/upload-optimize/`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error Response:", errorText);
        throw new Error(`Optimization failed: ${response.statusText}`);
      }

      const result = await response.json();

      console.log("Received optimization response:", result);

      if (!result.success) {
        throw new Error(result.error || "Optimization failed");
      }

      setResults(result);
      setActiveTab("summary");
    } catch (error: any) {
      console.error("Error running optimization:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to run optimization. Please try again."
      );
    } finally {
      setRunning(false);
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

  // ==========================
  // VISUALIZATION MODAL COMPONENT
  // ==========================
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

  // ==========================
  // CUSTOM PARENT BLOCK FORM COMPONENT - FIXED TEXT COLOR
  // ==========================
  const renderCustomParentBlockForm = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b">
          <h3 className="text-xl font-bold text-gray-800">
            Add Custom Parent Block
          </h3>
          <p className="text-gray-600 text-sm mt-1">
            Enter dimensions in millimeters (mm)
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Label (e.g., 800×350×1870)
            </label>
            <input
              type="text"
              value={newParentLabel}
              onChange={(e) => setNewParentLabel(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
              placeholder="Enter label"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Length (mm)
              </label>
              <input
                type="number"
                value={newParentLength}
                onChange={(e) => setNewParentLength(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                placeholder="1870"
                min="1"
                step="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Width (mm)
              </label>
              <input
                type="number"
                value={newParentWidth}
                onChange={(e) => setNewParentWidth(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                placeholder="800"
                min="1"
                step="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Height (mm)
              </label>
              <input
                type="number"
                value={newParentHeight}
                onChange={(e) => setNewParentHeight(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                placeholder="350"
                min="1"
                step="1"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={() => {
              setShowCustomParentForm(false);
              setError(null);
            }}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={addCustomParentBlock}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Parent Block
          </button>
        </div>
      </div>
    </div>
  );

  // ==========================
  // RENDER MAIN INTERFACE
  // ==========================
  const renderMainInterface = () => (
    <main
      className={`min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 ${
        showLogin ? "blur-sm" : ""
      }`}
    >
      <MainNotification /> 
      <div className="max-w-7xl mx-auto">
        {/* HEADER WITH USER PROFILE */}
        <div className="flex justify-between items-center mb-10">
          {/* COMPANY NAME + LOGO */}
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

          {/* USER CONTROLS */}
          {isLoggedIn && (
            <div className="flex items-center gap-4">
              {/* HISTORY BUTTON - ALWAYS VISIBLE */}
              <button
                onClick={() => (window.location.href = "/optimization-history")}
                className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
                <span>Optimization History</span>
              </button>

              {/* MOBILE HISTORY BUTTON */}
              <button
                onClick={() => (window.location.href = "/optimization-history")}
                className="md:hidden flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full shadow-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300"
                title="View History"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
              </button>

              {/* USER PROFILE DROPDOWN */}
              <div className="relative group user-profile-dropdown">
                <div
                  className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg cursor-pointer shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                  onClick={
                    isMobile
                      ? () => setIsUserDropdownOpen(!isUserDropdownOpen)
                      : undefined
                  }
                >
                  {userInitial}
                </div>

                {/* DESKTOP DROPDOWN */}
                {!isMobile && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                    {/* USER INFO */}
                    <div className="p-4 border-b border-gray-100/50">
                      <p className="text-sm text-gray-600 font-medium">
                        Signed in as
                      </p>
                      <p className="font-semibold text-gray-800 truncate text-lg">
                        {username}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date().toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>

                    {/* MOBILE HISTORY LINK (Hidden on desktop since we have button) */}
                    <div className="md:hidden">
                      <button
                        onClick={() =>
                          (window.location.href = "/optimization-history")
                        }
                        className="w-full px-4 py-3.5 text-left text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors font-medium flex items-center gap-3 border-b border-gray-100/50"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                          />
                        </svg>
                        <div className="flex-1">
                          <span>Optimization History</span>
                          <p className="text-xs text-gray-500 font-normal mt-0.5">
                            View past optimization runs
                          </p>
                        </div>
                      </button>
                    </div>

                    {/* DASHBOARD LINK */}
                    {/* <button
                      onClick={() => (window.location.href = "/")}
                      className="w-full px-4 py-3.5 text-left text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors font-medium flex items-center gap-3 border-b border-gray-100/50"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                        />
                      </svg>
                      <div className="flex-1">
                        <span>Optimization Dashboard</span>
                        <p className="text-xs text-gray-500 font-normal mt-0.5">
                          Return to main optimization
                        </p>
                      </div>
                    </button> */}

                    {/* LOGOUT BUTTON */}
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-3.5 text-left text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors font-medium flex items-center gap-3"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      <div className="flex-1">
                        <span>Sign Out</span>
                        <p className="text-xs text-gray-500 font-normal mt-0.5">
                          End current session
                        </p>
                      </div>
                    </button>
                  </div>
                )}

                {/* MOBILE DROPDOWN */}
                {isMobile && isUserDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 z-50">
                    {/* USER INFO */}
                    <div className="p-4 border-b border-gray-100/50">
                      <p className="text-sm text-gray-600 font-medium">
                        Signed in as
                      </p>
                      <p className="font-semibold text-gray-800 text-lg">
                        {username}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <p className="text-xs text-gray-500">
                          Active •{" "}
                          {new Date().toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>

                    {/* HISTORY LINK (Mobile) */}
                    <button
                      onClick={() => {
                        window.location.href = "/optimization-history";
                        setIsUserDropdownOpen(false);
                      }}
                      className="w-full px-4 py-4 text-left text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors font-medium flex items-center gap-3 border-b border-gray-100/50"
                    >
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold">
                          Optimization History
                        </span>
                        <p className="text-sm text-gray-600 mt-0.5">
                          View and manage past runs
                        </p>
                      </div>
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>

                    {/* DASHBOARD LINK */}
                    {/* <button
                      onClick={() => {
                        window.location.href = "/";
                        setIsUserDropdownOpen(false);
                      }}
                      className="w-full px-4 py-4 text-left text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors font-medium flex items-center gap-3 border-b border-gray-100/50"
                    >
                      <div className="w-10 h-10 bg-gradient-to-r from-gray-500 to-gray-600 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold">
                          Optimization Dashboard
                        </span>
                        <p className="text-sm text-gray-600 mt-0.5">
                          Run new optimizations
                        </p>
                      </div>
                    </button> */}

                    {/* LOGOUT BUTTON */}
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsUserDropdownOpen(false);
                      }}
                      className="w-full px-4 py-4 text-left text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors font-medium flex items-center gap-3"
                    >
                      <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold">Sign Out</span>
                        <p className="text-sm text-gray-600 mt-0.5">
                          End your current session
                        </p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MAIN CARD */}
        <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-white/20 mb-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-2 h-8 bg-linear-to-b from-blue-500 to-purple-600 rounded-full"></div>
            <h2 className="text-2xl font-bold text-gray-800">
              Import Requirements
            </h2>
          </div>

          {/* EXCEL IMPORT SECTION */}
          <div className="mb-8">
            <h3 className="font-semibold text-lg mb-4 text-gray-700 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Import Blocks from Excel
            </h3>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />

            <button
              onClick={triggerFileInput}
              className="w-full p-6 border-2 border-dashed border-gray-300 bg-white/50 rounded-xl shadow-sm hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-300 backdrop-blur-sm text-center group"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-linear-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <div>
                  <span className="text-gray-700 font-semibold text-lg">
                    {blockData.length > 0
                      ? `✅ Imported ${blockData.length} blocks`
                      : "Click to import Excel file"}
                  </span>
                  <p className="text-sm text-gray-500 mt-1">
                    Supports .xlsx, .xls, .csv files with block data
                  </p>
                </div>
                {blockData.length > 0 && (
                  <span className="text-blue-600 text-sm font-medium">
                    Click to re-import
                  </span>
                )}
              </div>
            </button>

            {/* File requirements info */}
            {blockData.length === 0 && (
              <div className="mt-4 p-4 bg-blue-50/50 rounded-lg border border-blue-200/50">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Expected Excel Format:
                  </h4>

                  {/* Download Sample Button */}
                  <a
                    href="/prism_data.xlsx"
                    download="Sample_data.xlsx"
                    className="flex items-center gap-2 px-3 py-2 bg-linear-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold rounded-lg shadow hover:from-green-600 hover:to-emerald-700 transition-all duration-300 hover:scale-105 active:scale-95"
                    onClick={(e) => {
                      console.log("Sample Excel file downloaded");
                    }}
                  >
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
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Download Sample
                  </a>
                </div>

                <ul className="text-sm text-blue-700 list-disc list-inside space-y-1 mb-3">
                  <li>
                    <strong>Required Columns:</strong> MARK, Bottom Length, Top
                    Length, Width, Height, Nos
                  </li>
                  <li>First row should contain headers</li>
                  <li>Supported formats: Excel (.xlsx, .xls) or CSV</li>
                  <li>
                    Bottom Length must be ≥ Top Length for trapezoidal prisms
                  </li>
                </ul>

                <p className="text-xs text-blue-600 italic mt-2">
                  Download the sample file above to see the required format
                </p>
              </div>
            )}
          </div>

          {/* BLOCK SELECTION - DROPDOWN */}
          {blockData.length > 0 && (
            <div className="mb-8">
              <h3 className="font-semibold text-lg mb-4 text-gray-700 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Select Blocks
              </h3>

              <div
                ref={dropdownRef}
                className="relative cursor-pointer"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <div className="border-2 border-gray-200/80 bg-white/50 p-4 rounded-xl shadow-sm hover:border-blue-300/50 transition-all duration-300 backdrop-blur-sm min-h-[60px]">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-wrap gap-2 flex-1">
                      {selectedBlocks.length === 0 ? (
                        <span className="text-gray-400 font-medium">
                          {selectedBlocks.length === 0
                            ? "No blocks selected"
                            : `${selectedBlocks.length} block${
                                selectedBlocks.length > 1 ? "s" : ""
                              } selected`}
                        </span>
                      ) : (
                        selectedBlocks.map((mark) => {
                          const block = blockData.find(
                            (b) => getBlockIdentifier(b) === mark
                          );
                          return (
                            <div
                              key={mark}
                              className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium group hover:bg-blue-200 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span>{mark}</span>
                              <span className="text-xs text-blue-600">
                                ({getBlockValue(block, "Nos")} units)
                              </span>
                              <button
                                onClick={(e) => removeSelectedBlock(mark, e)}
                                className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs hover:bg-blue-600 transition-colors"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform duration-300 flex-shrink-0 ${
                        isDropdownOpen ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

                {/* DROPDOWN CONTENT */}
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-lg border border-gray-200/80 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto">
                    {/* SEARCH BAR */}
                    <div className="p-4 border-b border-gray-100/50 bg-white">
                      <div className="relative">
                        <svg
                          className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                        <input
                          type="text"
                          placeholder="Search blocks (e.g., G14, G15...)"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    {/* SELECT ALL OPTION */}
                    <div
                      className="flex items-center gap-3 p-3 border-b border-gray-100/50 hover:bg-blue-50/50 transition-colors cursor-pointer"
                      onClick={handleSelectAll}
                    >
                      <div
                        className={`w-5 h-5 border-2 rounded-md flex items-center justify-center transition-all duration-200 ${
                          selectAll
                            ? "bg-blue-500 border-blue-500"
                            : "border-gray-300"
                        }`}
                      >
                        {selectAll && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <span className="font-medium text-gray-700">
                        {selectAll
                          ? "Deselect All Blocks"
                          : "Select All Blocks"}
                      </span>
                    </div>

                    {/* BLOCK OPTIONS */}
                    <div className="max-h-80 overflow-y-auto">
                      {filteredBlocks.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          No blocks found matching "{searchTerm}"
                        </div>
                      ) : (
                        filteredBlocks.map((block, index) => {
                          const blockId = getBlockIdentifier(block);
                          return (
                            <div
                              key={blockId}
                              className="flex items-center gap-3 p-3 hover:bg-gray-50/80 transition-colors cursor-pointer border-b border-gray-100/30 last:border-b-0"
                              onClick={(e) => toggleBlock(blockId, e)}
                            >
                              <div
                                className={`w-5 h-5 border-2 rounded-md flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                                  selectedBlocks.includes(blockId)
                                    ? "bg-blue-500 border-blue-500"
                                    : "border-gray-300"
                                }`}
                              >
                                {selectedBlocks.includes(blockId) && (
                                  <svg
                                    className="w-3 h-3 text-white"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <span className="font-bold text-gray-800 text-sm whitespace-nowrap flex-shrink-0">
                                      {blockId}
                                    </span>
                                    <div className="flex items-center gap-4 text-xs text-gray-600 flex-1 overflow-x-auto scrollbar-hide">
                                      <span className="whitespace-nowrap">
                                        <strong>Bottom:</strong>{" "}
                                        {getBlockValue(block, "Bottom Length")}
                                      </span>
                                      <span className="whitespace-nowrap">
                                        <strong>Top:</strong>{" "}
                                        {getBlockValue(block, "Top Length")}
                                      </span>
                                      <span className="whitespace-nowrap">
                                        <strong>Width:</strong>{" "}
                                        {getBlockValue(block, "Width")}
                                      </span>
                                      <span className="whitespace-nowrap">
                                        <strong>Height:</strong>{" "}
                                        {getBlockValue(block, "Height")}
                                      </span>
                                      <span className="whitespace-nowrap">
                                        <strong>Nos:</strong>{" "}
                                        {getBlockValue(block, "Nos")}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 ml-3 flex-shrink-0">
                                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap">
                                      {getBlockValue(block, "Nos")} units
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PARENT BLOCK SELECTOR - WITH CUSTOM ADDITIONS */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg text-gray-700 flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                Select Parent Blocks
              </h3>
              <button
                onClick={() => setShowCustomParentForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-300 text-sm font-medium"
              >
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Custom Size
              </button>
            </div>

            <div className="space-y-4">
              {/* SELECT ALL PARENTS OPTION */}
              <div
                className="flex items-center gap-3 p-3 border-2 border-gray-200/80 bg-white/50 rounded-xl shadow-sm hover:border-purple-300/50 transition-all duration-300 backdrop-blur-sm cursor-pointer"
                onClick={handleSelectAllParents}
              >
                <div
                  className={`w-5 h-5 border-2 rounded-md flex items-center justify-center transition-all duration-200 ${
                    selectedParents.length === customParentBlocks.length
                      ? "bg-purple-500 border-purple-500"
                      : "border-gray-300"
                  }`}
                >
                  {selectedParents.length === customParentBlocks.length && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <span className="font-medium text-gray-700">
                  {selectedParents.length === customParentBlocks.length
                    ? "Deselect All Parent Blocks"
                    : "Select All Parent Blocks"}
                </span>
              </div>

              {/* PARENT BLOCK OPTIONS */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customParentBlocks.map((parent) => (
                  <div
                    key={parent.label}
                    className={`p-4 border-2 rounded-xl shadow-sm transition-all duration-300 backdrop-blur-sm cursor-pointer group relative ${
                      selectedParents.includes(parent.label)
                        ? "border-purple-500 bg-purple-50/50"
                        : "border-gray-200/80 bg-white/50 hover:border-purple-300/50"
                    }`}
                    onClick={() => toggleParentBlock(parent.label)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 border-2 rounded-md flex items-center justify-center transition-all duration-200 ${
                            selectedParents.includes(parent.label)
                              ? "bg-purple-500 border-purple-500"
                              : "border-gray-300"
                          }`}
                        >
                          {selectedParents.includes(parent.label) && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </div>
                        <span className="font-medium text-gray-700">
                          {parent.label}
                        </span>
                      </div>
                      {selectedParents.includes(parent.label) && (
                        <span className="text-purple-600 text-sm font-semibold">
                          Selected
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 pl-8">
                      <div>Length: {parent.dimensions.length} mm</div>
                      <div>Width: {parent.dimensions.width} mm</div>
                      <div>Height: {parent.dimensions.height} mm</div>
                    </div>

                    {/* Delete button for custom blocks */}
                    {parent.label !== "800×350×1870" &&
                      parent.label !== "800×400×2000" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCustomParentBlock(parent.label);
                          }}
                          className="absolute top-2 right-2 p-1 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"
                          title="Remove custom parent block"
                        >
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
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                  </div>
                ))}
              </div>

              {/* SELECTED PARENT BLOCKS SUMMARY */}
              {selectedParents.length > 0 && (
                <div className="mt-4 p-3 bg-purple-50/50 rounded-lg border border-purple-200/50">
                  <p className="text-sm text-purple-700">
                    <span className="font-semibold">
                      {selectedParents.length}
                    </span>{" "}
                    parent block{selectedParents.length > 1 ? "s" : ""}{" "}
                    selected:
                    <span className="ml-2 font-medium">
                      {selectedParents.join(", ")}
                    </span>
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    {selectedParents.length === 1
                      ? "Optimization will use this stock type"
                      : "Optimization will consider multiple stock types"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ERROR */}
          {error && (
            <div className="mb-6 p-4 bg-red-50/80 border border-red-200/50 rounded-xl backdrop-blur-sm">
              <p className="text-red-600 font-medium flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </p>
            </div>
          )}

          {/* RUN BUTTON */}
          <div className="text-center">
            <button
              onClick={onRun}
              disabled={
                running ||
                blockData.length === 0 ||
                selectedParents.length === 0
              }
              className={`px-12 py-4 rounded-xl text-white font-semibold text-lg shadow-2xl transform transition-all duration-300 hover:scale-105 active:scale-95 ${
                running ||
                blockData.length === 0 ||
                selectedParents.length === 0
                  ? "bg-linear-to-r from-gray-400 to-gray-500 cursor-not-allowed"
                  : "bg-linear-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-blue-500/25"
              }`}
            >
              {running ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Processing Optimization...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Run Optimization
                </div>
              )}
            </button>
          </div>
        </div>

        {/* RESULTS SECTION */}
        {results && (
          <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-white/20 mb-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-8 bg-linear-to-b from-green-500 to-teal-600 rounded-full"></div>
              <h2 className="text-2xl font-bold text-gray-800">
                Optimization Results
              </h2>
            </div>

            {/* SUMMARY STATS */}
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

            {/* TABS */}
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

            {/* TAB CONTENT */}
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
                        {selectedParents.map((parent, idx) => (
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
        )}

        {/* FOOTER */}
        <div className="text-center text-gray-500 text-sm pt-8 border-t border-gray-200/50">
          <p>
            Danieli Corus Optimization System • Advanced Trapezoidal Block
            Cutting Solutions
          </p>
        </div>
      </div>
    </main>
  );

  // ==========================
  // LOGIN OVERLAY COMPONENT
  // ==========================
  const renderLoginOverlay = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-md"></div>

      <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 w-full max-w-md transform transition-all duration-500 scale-100">
        <div className="p-8 pb-0">
          <div className="flex items-center justify-center gap-4 mb-8">
            <img
              src="/danieli_logo.svg"
              alt="Danieli Corus Logo"
              className="h-12 w-auto"
            />
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
              DANIELI <span className="font-light">CORUS</span>
            </h1>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
              Welcome Back
            </h2>
            <p className="text-gray-600 text-lg">
              Sign in to access the optimization system
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="p-8 pt-6">
          {loginError && (
            <div className="mb-6 p-4 bg-red-50/80 border border-red-200/50 rounded-xl backdrop-blur-sm">
              <p className="text-red-600 font-medium flex items-center gap-2 text-sm">
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {loginError}
              </p>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-4 border-2 border-gray-200/80 bg-white/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm font-medium text-gray-700 placeholder-gray-400"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-4 border-2 border-gray-200/80 bg-white/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm font-medium text-gray-700 placeholder-gray-400"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className={`w-full px-8 py-4 text-white font-semibold text-lg rounded-xl shadow-2xl transform transition-all duration-300 hover:scale-105 active:scale-95 ${
                loginLoading
                  ? "bg-linear-to-r from-gray-400 to-gray-500 cursor-not-allowed"
                  : "bg-linear-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-blue-500/25"
              }`}
            >
              {loginLoading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Signing In...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Sign In to System
                </div>
              )}
            </button>
          </div>
        </form>

        <div className="p-8 pt-6 border-t border-gray-100/50">
          <p className="text-center text-gray-500 text-sm">
            Secure access to Danieli Corus optimization platform
          </p>
        </div>
      </div>
    </div>
  );

  // ==========================
  // MAIN RENDER
  // ==========================
  return (
    <>
      {renderMainInterface()}
      {showLogin && renderLoginOverlay()}
      {showCustomParentForm && renderCustomParentBlockForm()}
      {showVisualization && renderVisualizationModal()}
    </>
  );
}
