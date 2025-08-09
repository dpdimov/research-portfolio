"use client";

import React, { useState, useEffect } from 'react';
import { Search, FileText, MessageCircle, RefreshCw, Settings, ChevronRight, Calendar, Users, Tag } from 'lucide-react';

const ResearchPortfolio = () => {
  const [activeTab, setActiveTab] = useState('browse');
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [researchData, setResearchData] = useState({
    themes: [],
    papers: []
  });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState(null);

  // Load data from database on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoadingData(true);
        // For now, we'll just set empty data since the sync functionality
        // will populate the database. In the future, you could add an API
        // endpoint to fetch existing data from the database.
        setResearchData({ themes: [], papers: [] });
        setDataError(null);
      } catch (error) {
        console.error('Error loading research data:', error);
        setDataError('Failed to load research data');
      } finally {
        setIsLoadingData(false);
      }
    };

    loadData();
  }, []);

  const filteredPapers = researchData.papers.filter(paper => {
    const matchesSearch = searchQuery === '' || 
      paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      paper.keywords.some(keyword => keyword.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTheme = selectedTheme === null || paper.themeId === selectedTheme;
    return matchesSearch && matchesTheme;
  });

  const handleSync = async (clearFirst = false) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/sync-dropbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clearFirst })
      });

      const result = await response.json();

      if (result.success) {
        // Update the research data with synced data
        setResearchData(result.data);
        
        let message = clearFirst 
          ? `Clear & Re-sync completed! Processed ${result.newPapers} papers with AI analysis. `
          : `Sync completed! Found ${result.newPapers} new papers. `;
          
        message += `Total: ${result.summary.totalPdfFiles} PDF files, ` +
          `${result.summary.skippedFiles} already processed, ` +
          `${result.summary.errorFiles} errors.`;
        
        alert(message);
      } else {
        alert('Sync failed: ' + result.error);
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert('Sync failed: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearAndResync = async () => {
    if (confirm('This will delete all existing papers and re-process them with AI analysis. Continue?')) {
      await handleSync(true);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Research Portfolio</h1>
              <p className="mt-1 text-gray-600">Explore themes and ask questions about my research</p>
            </div>
            <div className="flex items-center gap-4">
              {isAdmin && (
                <>
                  <button
                    onClick={handleSync}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
                    Sync Dropbox
                  </button>
                  <button
                    onClick={handleClearAndResync}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
                    Clear & Re-sync
                  </button>
                  <button
                    onClick={handleReanalyzePapers}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
                    Re-analyze Papers
                  </button>
                </>
              )}
              <button
                onClick={() => setIsAdmin(!isAdmin)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Settings className="h-4 w-4" />
                {isAdmin ? 'Exit Admin' : 'Admin Mode'}
              </button>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex space-x-8 pb-4">
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
      </header>

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
                    <div className="font-medium">All Papers</div>
                    <div className="text-sm text-gray-500">{researchData.papers.length} papers</div>
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
                        <span className="font-medium">{theme.name}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${theme.color}`}>
                          {theme.paperCount}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{theme.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Content - Papers */}
            <div className="lg:col-span-3">
              {/* Search Bar */}
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    placeholder="Search papers, keywords, or topics..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
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
                    </div>

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
                      <button className="flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium">
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
                  {isAdmin && (
                    <button
                      onClick={handleSync}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
                      Sync Dropbox
                    </button>
                  )}
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
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
    </div>
  );
};

export default ResearchPortfolio;