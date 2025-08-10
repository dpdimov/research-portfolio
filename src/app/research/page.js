import { Suspense } from 'react'
import ResearchPortfolio from '@/components/ResearchPortfolio'

export const metadata = {
  title: 'Research Portfolio - Dr. [Your Name]',
  description: 'Browse my complete research portfolio with 83+ published papers. Search by themes, keywords, and ask AI-powered questions about my work.',
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading research portfolio...</p>
      </div>
    </div>
  )
}

export default function ResearchPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResearchPortfolio />
    </Suspense>
  )
}