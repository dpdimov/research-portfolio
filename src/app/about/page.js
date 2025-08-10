import Navigation from '@/components/Navigation'
import Image from 'next/image'
import { siteConfig } from '@/config/site'
import { sql } from '@vercel/postgres'

export const metadata = {
  title: `About - ${siteConfig.name}`,
  description: `Learn about my research background, academic journey, and contributions to ${siteConfig.researchField}.`,
}

async function getStats() {
  try {
    const papersResult = await sql`SELECT COUNT(*) as count FROM papers`;
    const themesResult = await sql`SELECT COUNT(*) as count FROM themes`;
    
    return {
      papers: papersResult.rows[0].count,
      themes: themesResult.rows[0].count,
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return {
      papers: siteConfig.stats.papers,
      themes: siteConfig.stats.themes,
    };
  }
}

export default async function AboutPage() {
  const stats = await getStats();
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">About</h1>
          <p className="text-xl text-gray-600">
            Research background, academic journey, and contributions
          </p>
        </div>

        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <div className="lg:flex lg:items-start lg:gap-8">
            <div className="lg:w-2/5 mb-6 lg:mb-0">
              <div className="w-80 h-80 mx-auto">
                <Image
                  src={siteConfig.images.profileLarge}
                  alt="Profile"
                  width={320}
                  height={320}
                  className="rounded-lg object-cover"
                />
              </div>
            </div>
            <div className="lg:w-3/5">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">{siteConfig.name}</h2>
              
              <p className="text-gray-700 leading-relaxed mb-4">
                {siteConfig.aboutIntro}
              </p>
              
              <p className="text-gray-700 leading-relaxed">
                My specialty areas are entrepreneurship, innovation, entrepreneurial finance, and venture capital. I am co-founder (with Joseph Pistrui) of{' '}
                <a 
                  href="https://kineticthinking.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Kinetic Thinking
                </a>
                , a validated framework for personal and organisational development. It helps individuals, teams and entire organizations capitalize on the changing world of work by deploying new ways of thinking, managing and leading.
              </p>
            </div>
          </div>
        </div>

        {/* Academic Background */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Academic Background</h2>
          <div className="space-y-6">
            {siteConfig.positions.map((position, index) => (
              <div key={index} className={`border-l-4 pl-4 ${index === 0 ? 'border-blue-500' : 'border-gray-300'}`}>
                <h3 className="text-lg font-semibold text-gray-900">{position.title}</h3>
                <p className="text-blue-600">{position.institution}</p>
                <p className="text-gray-600">{position.period}</p>
                {position.description && (
                  <p className="text-gray-700 mt-2">{position.description}</p>
                )}
              </div>
            ))}
            
            <div className="border-l-4 border-gray-300 pl-4">
              <h3 className="text-lg font-semibold text-gray-900">{siteConfig.education.degree}</h3>
              <p className="text-blue-600">{siteConfig.education.university}</p>
              <p className="text-gray-600">{siteConfig.education.year}</p>
              <p className="text-gray-700 mt-2">Dissertation: &ldquo;{siteConfig.education.dissertation}&rdquo;</p>
            </div>
          </div>
        </div>

        {/* Research Interests */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Research Interests</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Primary Areas</h3>
              <ul className="space-y-2">
                {siteConfig.primaryResearchAreas.map((area, index) => (
                  <li key={index} className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                    {area}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Methodologies</h3>
              <ul className="space-y-2">
                {siteConfig.methodologies.map((methodology, index) => (
                  <li key={index} className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    {methodology}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Key Statistics */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Research Impact</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">{stats.papers}</div>
              <div className="text-gray-600">Published Papers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">{siteConfig.stats.citations}</div>
              <div className="text-gray-600">Citations</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">{siteConfig.stats.hIndex}</div>
              <div className="text-gray-600">H-Index</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">{siteConfig.stats.yearsResearch}</div>
              <div className="text-gray-600">Years Research</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}