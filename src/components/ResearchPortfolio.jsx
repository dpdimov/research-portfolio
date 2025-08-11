"use client";

import React, { useState, useEffect } from 'react';
import { Search, FileText, MessageCircle, RefreshCw, Settings, ChevronRight, Calendar, Users, Tag, Upload, ExternalLink, Download, X, Edit3 } from 'lucide-react';
import Navigation from './Navigation';
import { useSearchParams } from 'next/navigation';

const ResearchPortfolio = () => {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('browse');
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [clearExistingPapers, setClearExistingPapers] = useState(true);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPaper, setEditingPaper] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFormData, setAddFormData] = useState({
    title: '',
    authors: '',
    year: new Date().getFullYear(),
    venue: '',
    abstract: '',
    keywords: '',
    doi: '',
    link: '',
    volume: '',
    issue: '',
    pageStart: '',
    pageEnd: '',
    type: 'other'
  });

  const [researchData, setResearchData] = useState({
    themes: [],
    papers: []
  });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState(null);

  // Check URL parameter for tab selection
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'chat') {
      setActiveTab('chat');
    }
  }, [searchParams]);

  // Load data from database on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoadingData(true);
        const response = await fetch('/api/papers');
        const result = await response.json();
        
        if (result.success) {
          setResearchData(result.data);
          setDataError(null);
        } else {
          setDataError('Failed to load research data: ' + result.error);
        }
      } catch (error) {
        console.error('Error loading research data:', error);
        setDataError('Failed to load research data');
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
  }, []);

  // Get all unique keywords for the dropdown
  const allKeywords = [...new Set(
    researchData.papers.flatMap(paper => paper.keywords)
  )].sort();

  const filteredPapers = researchData.papers.filter(paper => {
    const matchesSearch = searchQuery === '' || 
      paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      paper.keywords.some(keyword => keyword.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Updated theme matching for multiple themes per paper
    const matchesTheme = selectedTheme === null || 
      (paper.themes && paper.themes.some(theme => theme.id === selectedTheme)) ||
      paper.themeId === selectedTheme; // Backward compatibility
    
    const matchesKeyword = selectedKeyword === null || paper.keywords.includes(selectedKeyword);
    const matchesType = selectedType === null || paper.type === selectedType;
    return matchesSearch && matchesTheme && matchesKeyword && matchesType;
  });


  const handleConsolidateThemes = async () => {
    if (confirm('This will consolidate all themes into 8 broader categories and reassign all papers based on their content. This action cannot be undone. Continue?')) {
      setIsProcessing(true);
      try {
        const response = await fetch('/api/consolidate-themes-v2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        const result = await response.json();

        if (result.success) {
          // Update the research data with consolidated themes
          setResearchData(result.data);
          
          alert(result.message);
        } else {
          alert('Theme consolidation failed: ' + result.error);
        }
      } catch (error) {
        console.error('Theme consolidation error:', error);
        alert('Theme consolidation failed: ' + error.message);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleReanalyzePapers = async () => {
    if (confirm('This will re-analyze existing papers with AI to improve titles, authors, and summaries. Continue?')) {
      setIsProcessing(true);
      try {
        const response = await fetch('/api/reanalyze-papers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        const result = await response.json();

        if (result.success) {
          // Update the research data with re-analyzed data
          setResearchData(result.data);
          
          const message = `Re-analysis completed! Updated ${result.updatedCount} papers with AI analysis. ` +
            `Total processed: ${result.totalProcessed}, Errors: ${result.errorCount}.`;
          
          alert(message);
        } else {
          alert('Re-analysis failed: ' + result.error);
        }
      } catch (error) {
        console.error('Re-analysis error:', error);
        alert('Re-analysis failed: ' + error.message);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleChatSubmit = async () => {
    if (!currentMessage.trim()) return;

    const newMessage = { role: 'user', content: currentMessage };
    setChatMessages(prev => [...prev, newMessage]);
    setCurrentMessage('');

    // Simulate AI response
    setTimeout(() => {
      const aiResponse = {
        role: 'assistant',
        content: `Based on your research portfolio, I can see you have ${researchData.papers.length} papers across ${researchData.themes.length} main themes. Your question "${currentMessage}" relates to several of your publications. Would you like me to elaborate on any specific paper or theme?`
      };
      setChatMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  const handleAdminToggle = () => {
    if (isAdmin) {
      setIsAdmin(false);
    } else {
      setShowAdminLogin(true);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: adminPassword })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setIsAdmin(true);
        setShowAdminLogin(false);
        setAdminPassword('');
      } else {
        alert('Incorrect password');
        setAdminPassword('');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      alert('Authentication failed');
      setAdminPassword('');
    }
  };

  const handleAdminCancel = () => {
    setShowAdminLogin(false);
    setAdminPassword('');
  };


  const handleCsvUpload = async () => {
    if (!csvFile) {
      alert('Please select a CSV file first');
      return;
    }

    const confirmMessage = clearExistingPapers 
      ? 'This will import papers from the CSV file and REPLACE all existing data. Continue?'
      : 'This will import papers from the CSV file and ADD to existing data. Continue?';
      
    if (confirm(confirmMessage)) {
      setIsUploadingCsv(true);
      try {
        const formData = new FormData();
        formData.append('csvFile', csvFile);
        formData.append('clearExisting', clearExistingPapers.toString());

        const response = await fetch('/api/import-csv', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (result.success) {
          // Update the research data with imported data
          setResearchData(result.data);
          
          const message = `CSV import completed! Imported ${result.importCount} papers. ` +
            `Errors: ${result.errorCount}.`;
          
          alert(message);
          setShowCsvUpload(false);
          setCsvFile(null);
        } else {
          alert('CSV import failed: ' + result.error);
        }
      } catch (error) {
        console.error('CSV import error:', error);
        alert('CSV import failed: ' + error.message);
      } finally {
        setIsUploadingCsv(false);
      }
    }
  };

  const handleCsvFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
    } else {
      alert('Please select a valid CSV file');
      e.target.value = '';
    }
  };

  const handleCsvUploadCancel = () => {
    setShowCsvUpload(false);
    setCsvFile(null);
    setClearExistingPapers(true);
  };

  const handleViewPaper = (paper) => {
    setSelectedPaper(paper);
  };

  const handleClosePaper = () => {
    setSelectedPaper(null);
  };

  const handleDownloadPdf = async (paper) => {
    try {
      setIsProcessing(true);
      
      const response = await fetch('/api/get-pdf-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paperId: paper.id,
          paperTitle: paper.title,
          paperYear: paper.year,
          paperAuthors: paper.authors
        })
      });

      const result = await response.json();

      if (result.success) {
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert(`PDF not found: ${result.error}`);
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download PDF: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReanalyzeSinglePaper = async (paper) => {
    if (confirm(`Re-analyze "${paper.title}" with Claude Sonnet 4?\n\nThis will update the summary and theme assignment while preserving all original data.`)) {
      try {
        setIsProcessing(true);
        
        const response = await fetch('/api/reanalyze-paper', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paperId: paper.id
          })
        });

        const result = await response.json();

        if (result.success) {
          alert(`Paper re-analyzed successfully!\n\nUpdated: ${result.message}`);
          
          // Refresh the data to show updated paper
          const refreshResponse = await fetch('/api/papers');
          const refreshResult = await refreshResponse.json();
          if (refreshResult.success) {
            setResearchData(refreshResult.data);
            // Update the selected paper with new data
            const updatedPaper = refreshResult.data.papers.find(p => p.id === paper.id);
            if (updatedPaper) {
              setSelectedPaper(updatedPaper);
            }
          }
        } else {
          alert(`Re-analysis failed: ${result.error}`);
        }
      } catch (error) {
        console.error('Re-analysis error:', error);
        alert('Failed to re-analyze paper: ' + error.message);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleEditPaper = (paper) => {
    setEditingPaper(paper);
    setEditFormData({
      title: paper.title,
      authors: paper.authors.join('; '),
      year: paper.year,
      venue: paper.venue,
      abstract: paper.summary || '',
      keywords: paper.keywords.join('; '),
      doi: paper.doi || '',
      link: paper.link || '',
      volume: paper.volume || '',
      issue: paper.issue || '',
      pageStart: paper.pageStart || '',
      pageEnd: paper.pageEnd || '',
      type: paper.type || 'other'
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPaper) return;

    try {
      setIsProcessing(true);

      // Parse authors and keywords back to arrays
      const authorsArray = editFormData.authors.split(';').map(a => a.trim()).filter(a => a);
      const keywordsArray = editFormData.keywords.split(';').map(k => k.trim()).filter(k => k);

      const updates = {
        title: editFormData.title,
        authors: authorsArray,
        year: parseInt(editFormData.year),
        venue: editFormData.venue,
        abstract: editFormData.abstract,
        keywords: keywordsArray,
        doi: editFormData.doi,
        link: editFormData.link,
        volume: editFormData.volume,
        issue: editFormData.issue,
        pageStart: editFormData.pageStart,
        pageEnd: editFormData.pageEnd,
        type: editFormData.type || 'other'
      };

      const response = await fetch('/api/update-paper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paperId: editingPaper.id,
          updates: updates
        })
      });

      const result = await response.json();

      if (result.success) {
        alert('Paper updated successfully!');
        
        // Refresh the data
        const refreshResponse = await fetch('/api/papers');
        const refreshResult = await refreshResponse.json();
        if (refreshResult.success) {
          setResearchData(refreshResult.data);
          // Update selected paper if it's still open
          const updatedPaper = refreshResult.data.papers.find(p => p.id === editingPaper.id);
          if (updatedPaper) {
            setSelectedPaper(updatedPaper);
          }
        }
        
        setShowEditModal(false);
        setEditingPaper(null);
        setEditFormData({});
      } else {
        alert('Failed to update paper: ' + result.error);
      }
    } catch (error) {
      console.error('Update error:', error);
      alert('Failed to update paper: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
    setEditingPaper(null);
    setEditFormData({});
  };

  const handleFormChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddPaper = async () => {
    if (!addFormData.title || !addFormData.authors || !addFormData.venue) {
      alert('Please fill in all required fields (Title, Authors, and Venue)');
      return;
    }

    try {
      setIsProcessing(true);

      const response = await fetch('/api/add-paper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(addFormData)
      });

      const result = await response.json();

      if (result.success) {
        alert('Paper added successfully!');
        
        // Refresh the data to show the new paper
        const refreshResponse = await fetch('/api/papers');
        const refreshResult = await refreshResponse.json();
        if (refreshResult.success) {
          setResearchData(refreshResult.data);
        }
        
        // Reset the form and close modal
        setAddFormData({
          title: '',
          authors: '',
          year: new Date().getFullYear(),
          venue: '',
          abstract: '',
          keywords: '',
          doi: '',
          link: '',
          volume: '',
          issue: '',
          pageStart: '',
          pageEnd: '',
          type: 'other'
        });
        setShowAddModal(false);
      } else {
        alert('Failed to add paper: ' + result.error);
      }
    } catch (error) {
      console.error('Add paper error:', error);
      alert('Failed to add paper: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCitation = (paper) => {
    const authors = paper.authors.join(', ');
    const pages = paper.pageStart && paper.pageEnd ? `, ${paper.pageStart}-${paper.pageEnd}` : '';
    const volume = paper.volume ? `, ${paper.volume}` : '';
    const issue = paper.issue ? `(${paper.issue})` : '';
    return `${authors} (${paper.year}). ${paper.title}. ${paper.venue}${volume}${issue}${pages}.`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <Navigation />
      
      {/* Page Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Research Portfolio</h1>
              <p className="mt-1 text-gray-600">Explore themes and ask questions about my research</p>
            </div>
            <div className="flex items-center gap-4">
              {isAdmin && (
                <>
                  <button
                    onClick={handleConsolidateThemes}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                  >
                    <Tag className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
                    Consolidate Themes
                  </button>
                  <button
                    onClick={handleReanalyzePapers}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
                    Re-analyze with AI
                  </button>
                  <button
                    onClick={() => setShowCsvUpload(true)}
                    disabled={isProcessing || isUploadingCsv}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    Import CSV
                  </button>
                  <button
                    onClick={() => setShowAddModal(true)}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4" />
                    Add Paper
                  </button>
                </>
              )}
              <button
                onClick={handleAdminToggle}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-900"
              >
                <Settings className="h-4 w-4" />
                {isAdmin ? 'Exit Admin' : 'Admin Login'}
              </button>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <nav className="flex space-x-8 pt-4">
            <button
              onClick={() => setActiveTab('browse')}
              className={`pb-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'browse'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Browse Research
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`pb-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'chat'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Ask Questions
            </button>
          </nav>
        </div>
      </div>

      {/* Admin Login Modal */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Authentication</h3>
            <form onSubmit={handleAdminLogin}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="Enter admin password"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={handleAdminCancel}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Upload Modal */}
      {showCsvUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Import Papers from CSV</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                Upload a CSV file with your academic papers. Expected columns:
                Authors, Title, Year, Source title, DOI, Abstract, Author Keywords, etc.
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {csvFile && (
                <p className="text-sm text-green-600 mt-2">
                  Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
              <div className="mt-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={clearExistingPapers}
                    onChange={(e) => setClearExistingPapers(e.target.checked)}
                    className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    Clear existing papers before import (recommended for fresh data)
                  </span>
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCsvUpload}
                disabled={!csvFile || isUploadingCsv}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUploadingCsv ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {isUploadingCsv ? 'Importing...' : 'Import CSV'}
              </button>
              <button
                type="button"
                onClick={handleCsvUploadCancel}
                disabled={isUploadingCsv}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'browse' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar - Themes */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Research Themes</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setSelectedTheme(null)}
                    className={`w-full text-left p-3 rounded-lg transition ${
                      selectedTheme === null ? 'bg-blue-50 border-blue-200 border' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-gray-900">All Papers</div>
                    <div className="text-sm text-gray-700">{researchData.papers.length} papers</div>
                  </button>
                  {researchData.themes.map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => setSelectedTheme(theme.id)}
                      className={`w-full text-left p-3 rounded-lg transition ${
                        selectedTheme === theme.id ? 'bg-blue-50 border-blue-200 border' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">{theme.name}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${theme.color}`}>
                          {theme.paperCount}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{theme.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Content - Papers */}
            <div className="lg:col-span-3">
              {/* Search and Filters */}
              <div className="mb-6 space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-5 w-5" />
                  <input
                    type="text"
                    placeholder="Search papers, keywords, or topics..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Keyword and Type Filters */}
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <select
                      value={selectedKeyword || ''}
                      onChange={(e) => setSelectedKeyword(e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    >
                      <option value="">All Keywords ({allKeywords.length})</option>
                      {allKeywords.map((keyword, index) => (
                        <option key={index} value={keyword}>
                          {keyword} ({researchData.papers.filter(p => p.keywords.includes(keyword)).length})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <select
                      value={selectedType || ''}
                      onChange={(e) => setSelectedType(e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    >
                      <option value="">All Types ({researchData.papers.length})</option>
                      <option value="article">Articles ({researchData.papers.filter(p => p.type === 'article').length})</option>
                      <option value="book">Books ({researchData.papers.filter(p => p.type === 'book').length})</option>
                      <option value="chapter">Chapters ({researchData.papers.filter(p => p.type === 'chapter').length})</option>
                      <option value="report">Reports ({researchData.papers.filter(p => p.type === 'report').length})</option>
                      <option value="other">Other ({researchData.papers.filter(p => p.type === 'other' || !p.type).length})</option>
                    </select>
                  </div>
                  {(selectedKeyword || selectedTheme || selectedType) && (
                    <button
                      onClick={() => {
                        setSelectedKeyword(null);
                        setSelectedTheme(null);
                        setSelectedType(null);
                      }}
                      className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Papers Grid */}
              <div className="grid gap-6">
                {filteredPapers.map(paper => (
                  <div key={paper.id} className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-semibold text-gray-900 leading-tight">{paper.title}</h3>
                      <FileText className="h-5 w-5 text-gray-400 mt-1 flex-shrink-0 ml-3" />
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600 mb-3">
                      <Users className="h-4 w-4 mr-1" />
                      <span>{paper.authors.join(', ')}</span>
                      <span className="mx-2">•</span>
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>{paper.year}</span>
                      <span className="mx-2">•</span>
                      <span className="font-medium">{paper.venue}</span>
                      {paper.type && paper.type !== 'other' && (
                        <>
                          <span className="mx-2">•</span>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium capitalize">
                            {paper.type}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Multiple Themes Display */}
                    {paper.themes && paper.themes.length > 0 && (
                      <div className="flex items-center gap-2 mb-3">
                        <Tag className="h-4 w-4 text-gray-400" />
                        <div className="flex gap-2 flex-wrap">
                          {paper.themes.map((theme) => (
                            <span
                              key={theme.id}
                              className={`px-2 py-1 rounded-full text-xs font-medium ${theme.color || 'bg-gray-100 text-gray-800'}`}
                            >
                              {theme.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-gray-700 mb-4 leading-relaxed">{paper.summary}</p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-gray-400" />
                        <div className="flex gap-2 flex-wrap">
                          {paper.keywords.slice(0, 4).map((keyword, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleViewPaper(paper)}
                        className="flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View Details <ChevronRight className="h-4 w-4 ml-1" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {isLoadingData ? (
                <div className="text-center py-12">
                  <RefreshCw className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-spin" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Loading research data...</h3>
                  <p className="text-gray-600">Please wait while we load your papers</p>
                </div>
              ) : filteredPapers.length === 0 && researchData.papers.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No research papers yet</h3>
                  <p className="text-gray-600 mb-4">Use the "Sync Dropbox" button above to import your papers from Dropbox</p>
                </div>
              ) : filteredPapers.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No papers match your filters</h3>
                  <p className="text-gray-600">Try adjusting your search or theme filter</p>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow">
              {/* Chat Header */}
              <div className="border-b border-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-6 w-6 text-blue-600" />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Research Q&A</h2>
                    <p className="text-gray-600">Ask questions about my research themes, methodologies, or findings</p>
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="h-96 overflow-y-auto p-6">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Start a conversation</h3>
                    <p className="text-gray-600 mb-4">Ask me anything about my research!</p>
                    <div className="text-sm text-gray-500 space-y-1">
                      <p>"What are your main research areas?"</p>
                      <p>"Tell me about your latest work on machine learning"</p>
                      <p>"How do you approach statistical analysis?"</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatMessages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-3xl px-4 py-2 rounded-lg ${
                            message.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          {message.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="border-t border-gray-200 p-6">
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Ask about my research..."
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                  <button
                    onClick={handleChatSubmit}
                    disabled={!currentMessage.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Paper Detail Modal */}
      {selectedPaper && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-start">
              <div className="flex-1 pr-4">
                <h2 className="text-xl font-semibold text-gray-900 leading-tight">
                  {selectedPaper.title}
                </h2>
                <div className="flex items-center text-sm text-gray-600 mt-2">
                  <Users className="h-4 w-4 mr-1" />
                  <span>{selectedPaper.authors.join(', ')}</span>
                  <span className="mx-2">•</span>
                  <Calendar className="h-4 w-4 mr-1" />
                  <span>{selectedPaper.year}</span>
                </div>
              </div>
              <button
                onClick={handleClosePaper}
                className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Publication Details */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Publication Details</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium text-gray-700">Journal/Venue:</span>
                      <p className="text-gray-900">{selectedPaper.venue}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Type:</span>
                      <p className="text-gray-900 capitalize">{selectedPaper.type || 'other'}</p>
                    </div>
                    {selectedPaper.volume && (
                      <div>
                        <span className="font-medium text-gray-700">Volume:</span>
                        <p className="text-gray-900">{selectedPaper.volume}</p>
                      </div>
                    )}
                    {selectedPaper.issue && (
                      <div>
                        <span className="font-medium text-gray-700">Issue:</span>
                        <p className="text-gray-900">{selectedPaper.issue}</p>
                      </div>
                    )}
                    {selectedPaper.pageStart && selectedPaper.pageEnd && (
                      <div>
                        <span className="font-medium text-gray-700">Pages:</span>
                        <p className="text-gray-900">{selectedPaper.pageStart}-{selectedPaper.pageEnd}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Abstract/Summary */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Abstract</h3>
                <p className="text-gray-700 leading-relaxed">{selectedPaper.summary}</p>
              </div>

              {/* Keywords */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedPaper.keywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>

              {/* Citation */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Citation</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700 text-sm leading-relaxed font-mono">
                    {formatCitation(selectedPaper)}
                  </p>
                </div>
              </div>

              {/* Links */}
              <div className="flex flex-wrap gap-3">
                {selectedPaper.doi && (
                  <a
                    href={`https://doi.org/${selectedPaper.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View DOI
                  </a>
                )}
                {selectedPaper.link && (
                  <a
                    href={selectedPaper.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Scopus Record
                  </a>
                )}
                <button
                  onClick={() => handleDownloadPdf(selectedPaper)}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition"
                >
                  {isProcessing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isProcessing ? 'Finding PDF...' : 'Download PDF'}
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => handleEditPaper(selectedPaper)}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit Paper
                    </button>
                    <button
                      onClick={() => handleReanalyzeSinglePaper(selectedPaper)}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition"
                    >
                      {isProcessing ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      {isProcessing ? 'Re-analyzing...' : 'Re-analyze Paper'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Paper Modal */}
      {showEditModal && editingPaper && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">
                Edit Paper: {editingPaper.title}
              </h2>
              <button
                onClick={handleCancelEdit}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Title */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editFormData.title || ''}
                    onChange={(e) => handleFormChange('title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Authors */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Authors (separate with semicolons)
                  </label>
                  <input
                    type="text"
                    value={editFormData.authors || ''}
                    onChange={(e) => handleFormChange('authors', e.target.value)}
                    placeholder="Author 1; Author 2; Author 3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Year */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Year
                  </label>
                  <input
                    type="number"
                    value={editFormData.year || ''}
                    onChange={(e) => handleFormChange('year', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Venue */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Journal/Venue
                  </label>
                  <input
                    type="text"
                    value={editFormData.venue || ''}
                    onChange={(e) => handleFormChange('venue', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Type
                  </label>
                  <select
                    value={editFormData.type || 'other'}
                    onChange={(e) => handleFormChange('type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  >
                    <option value="article">Article</option>
                    <option value="book">Book</option>
                    <option value="chapter">Chapter</option>
                    <option value="report">Report</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* DOI */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    DOI
                  </label>
                  <input
                    type="text"
                    value={editFormData.doi || ''}
                    onChange={(e) => handleFormChange('doi', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Link */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Scopus Link
                  </label>
                  <input
                    type="text"
                    value={editFormData.link || ''}
                    onChange={(e) => handleFormChange('link', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Volume */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Volume
                  </label>
                  <input
                    type="text"
                    value={editFormData.volume || ''}
                    onChange={(e) => handleFormChange('volume', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Issue */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Issue
                  </label>
                  <input
                    type="text"
                    value={editFormData.issue || ''}
                    onChange={(e) => handleFormChange('issue', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Page Start */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Page Start
                  </label>
                  <input
                    type="text"
                    value={editFormData.pageStart || ''}
                    onChange={(e) => handleFormChange('pageStart', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Page End */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Page End
                  </label>
                  <input
                    type="text"
                    value={editFormData.pageEnd || ''}
                    onChange={(e) => handleFormChange('pageEnd', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Keywords */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Keywords (separate with semicolons)
                  </label>
                  <input
                    type="text"
                    value={editFormData.keywords || ''}
                    onChange={(e) => handleFormChange('keywords', e.target.value)}
                    placeholder="keyword1; keyword2; keyword3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Abstract */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Abstract
                  </label>
                  <textarea
                    value={editFormData.abstract || ''}
                    onChange={(e) => handleFormChange('abstract', e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                    placeholder="Enter the paper abstract here..."
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  onClick={handleCancelEdit}
                  disabled={isProcessing}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : null}
                  {isProcessing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Paper Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">
                Add New Paper
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Title */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={addFormData.title || ''}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    placeholder="Enter paper title"
                  />
                </div>

                {/* Authors */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Authors (separate with semicolons) *
                  </label>
                  <input
                    type="text"
                    value={addFormData.authors || ''}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, authors: e.target.value }))}
                    placeholder="Author 1; Author 2; Author 3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Year */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Year *
                  </label>
                  <input
                    type="number"
                    value={addFormData.year || ''}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, year: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Venue */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Journal/Venue *
                  </label>
                  <input
                    type="text"
                    value={addFormData.venue || ''}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, venue: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    placeholder="Journal or venue name"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Type
                  </label>
                  <select
                    value={addFormData.type || 'other'}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  >
                    <option value="article">Article</option>
                    <option value="book">Book</option>
                    <option value="chapter">Chapter</option>
                    <option value="report">Report</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* DOI */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    DOI
                  </label>
                  <input
                    type="text"
                    value={addFormData.doi || ''}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, doi: e.target.value }))}
                    placeholder="10.1000/journal.123456"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Link */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Scopus/Publisher Link
                  </label>
                  <input
                    type="url"
                    value={addFormData.link || ''}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, link: e.target.value }))}
                    placeholder="https://www.scopus.com/..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Volume */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Volume
                  </label>
                  <input
                    type="text"
                    value={addFormData.volume || ''}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, volume: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Issue */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Issue
                  </label>
                  <input
                    type="text"
                    value={addFormData.issue || ''}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, issue: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Page Start */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Page Start
                  </label>
                  <input
                    type="text"
                    value={addFormData.pageStart || ''}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, pageStart: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Page End */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Page End
                  </label>
                  <input
                    type="text"
                    value={addFormData.pageEnd || ''}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, pageEnd: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Keywords */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Keywords (separate with semicolons)
                  </label>
                  <input
                    type="text"
                    value={addFormData.keywords || ''}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, keywords: e.target.value }))}
                    placeholder="keyword1; keyword2; keyword3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>

                {/* Abstract */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Abstract
                  </label>
                  <textarea
                    value={addFormData.abstract || ''}
                    onChange={(e) => setAddFormData(prev => ({ ...prev, abstract: e.target.value }))}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    placeholder="Enter the paper abstract here..."
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  onClick={() => setShowAddModal(false)}
                  disabled={isProcessing}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPaper}
                  disabled={isProcessing || !addFormData.title || !addFormData.authors || !addFormData.venue}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : null}
                  {isProcessing ? 'Adding...' : 'Add Paper'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchPortfolio;