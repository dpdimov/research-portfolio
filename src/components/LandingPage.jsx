"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { BookOpen, Users, MessageCircle, Award, ArrowRight, Mail, MapPin, Building, User } from 'lucide-react';
import Link from 'next/link';
import { siteConfig } from '@/config/site';
import Navigation from './Navigation';

const LandingPage = () => {
  const [stats, setStats] = useState({
    papers: siteConfig.stats.papers,
    themes: siteConfig.stats.themes,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats');
        const result = await response.json();
        if (result.success) {
          setStats(result.stats);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <Navigation />

      {/* Hero Section */}
      <section className="pt-20 pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight sm:text-5xl md:text-6xl">
                {siteConfig.heroTitle}
              </h1>
              <p className="mt-6 text-xl text-gray-600 leading-8">
                {siteConfig.heroDescription}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/research"
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Explore Research Portfolio
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link
                  href="/about"
                  className="inline-flex items-center px-6 py-3 border border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Learn more about Dimo
                  <User className="ml-2 h-5 w-5" />
                </Link>
              </div>
            </div>
            <div className="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
              <div className="relative mx-auto w-full rounded-lg shadow-lg lg:max-w-md">
                <div className="relative block w-full bg-white rounded-lg overflow-hidden">
                  <img
                    className="w-full h-64 object-cover"
                    src={siteConfig.profileImage}
                    alt="Profile"
                  />
                  <div className="p-4">
                    <h3 className="text-lg font-medium text-gray-900">{siteConfig.name}</h3>
                    <p className="text-gray-600">{siteConfig.title}</p>
                    <p className="text-gray-600">{siteConfig.institution}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.papers}</div>
              <div className="text-gray-600 mt-2">Published Papers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{siteConfig.stats.yearsResearch}</div>
              <div className="text-gray-600 mt-2">Years Research</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.themes}</div>
              <div className="text-gray-600 mt-2">Research Themes</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{siteConfig.stats.collaborations}</div>
              <div className="text-gray-600 mt-2">Collaborations</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Research Highlights</h2>
            <p className="mt-4 text-xl text-gray-600">
              Discover the key areas of my research and contributions to the field
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Research Portfolio</h3>
              <p className="text-gray-600 mb-4">
                Browse through my complete collection of research papers, organized by themes and searchable by keywords.
              </p>
              <Link
                href="/research"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
              >
                Explore Papers
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <MessageCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">AI-Powered Q&A</h3>
              <p className="text-gray-600 mb-4">
                Ask questions about my research and get intelligent responses based on my published work.
              </p>
              <Link
                href="/research?tab=chat"
                className="inline-flex items-center text-green-600 hover:text-green-700 font-medium"
              >
                Try Q&A System
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Award className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Research Impact</h3>
              <p className="text-gray-600 mb-4">
                Learn about the real-world applications and impact of my research across different domains.
              </p>
              <Link
                href="/about"
                className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium"
              >
                View Impact
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <Image 
                  src={siteConfig.images.logo} 
                  alt="Innsyn Ltd Logo" 
                  width={24} 
                  height={24}
                  className="h-6 w-6 object-contain mr-2 filter brightness-0 invert"
                />
                <span className="text-lg font-semibold">{siteConfig.companyName}</span>
              </div>
              <p className="text-gray-400">
                {siteConfig.footerSlogan}
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
              <div className="space-y-2">
                <Link href="/research" className="block text-gray-400 hover:text-white transition-colors">
                  Research Portfolio
                </Link>
                <Link href="/about" className="block text-gray-400 hover:text-white transition-colors">
                  About
                </Link>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} {siteConfig.companyName}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;