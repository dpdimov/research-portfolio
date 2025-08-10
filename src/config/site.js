export const siteConfig = {
  // Company Information
  companyName: "Innsyn Ltd", // Company name for header
  // Personal Information
  name: "Dimo Dimov", // Person's full name
  title: "Professor of Entrepreneurship and Innovation", // e.g., "Professor of Statistics"
  institution: "University of Bath", // e.g., "University of Example"
  email: "dimo@innsyn.co.uk",
  
  // Research Focus
  researchField: "Entrepreneurship and Innovation", // e.g., "Statistical Analysis and Data Science"
  
  // Bio and Descriptions
  heroTitle: "Developing entrepreneurial minds, inspiring future makers",
  heroDescription: "Advancing entrepreneurial thinking and practice through scholarship, teaching, and collaboration.",
  footerSlogan: "Learning and building the future together.",
  
  aboutIntro: "I am interested in entrepreneurial thinking, processes, and practice, embracing eclectic perspectives and approaches. Underpinning these is the journey through which entrepreneurial opportunities unfold from initial ideas into viable ventures. This occurs in independent, corporate, and social settings.",
  
  aboutCurrent: "My specialty areas are entrepreneurship, innovation, entrepreneurial finance, and venture capital. I am co-founder (with Joseph Pistrui) of Kinetic Thinking, a validated framework for personal and organisational development. It helps individuals, teams and entire organizations capitalize on the changing world of work by deploying new ways of thinking, managing and leading.",
  
  // Research Areas
  primaryResearchAreas: [
    "Entrepreneurial thinking", // e.g., "Bayesian Statistics"
    "New venture design", // e.g., "Machine Learning Applications"
    "Venture capital funding", // e.g., "Biostatistics"
  ],
  
  methodologies: [
    "Conceptual analysis", // e.g., "Statistical Modeling"
    "Statistical modeling", // e.g., "Data Visualization"
    "Experimental design", // e.g., "Experimental Design"
  ],
  
  // Academic Timeline
  positions: [
    {
      title: "Professor of Entrepreneurship and Innovation",
      institution: "University of Bath (UK)",
      period: "2012 - Present",
    },
    {
      title: "Professor of Entrepreneurship", 
      institution: "Newcastle University (UK)",
      period: "2010-2012",
    },
	{
      title: "Assistant Professor of Management", 
      institution: "University of Connecticut (USA)",
      period: "2006-2010",
    },
	{
      title: "Assistant Professor of Entrepreneurship", 
      institution: "IE Business School (Spain)",
      period: "2004-2006",
    }
  ],
  
  education: {
    degree: "Ph.D. in Entrepreneurship",
    university: "London Business School", 
    year: "2004",
    dissertation: "The Glasses of Experience: Opportunity enactment, experiential learning, and human capital"
  },
  
  // Statistics (these will be automatically pulled from your database for papers count)
  stats: {
    papers: "83", // Will be auto-updated from database
    themes: "5", // Will be auto-updated from database
    citations: "13k+", // Add your citation count
    hIndex: "44", // Add your h-index
    yearsResearch: "20+", // Update as needed
    collaborations: "20+", // Update as needed
  },
  
  // Images (store your images in /public/images/)
  images: {
    profile: "/images/profile/profile.jpeg", // Replace with your profile photo
    profileLarge: "/images/profile/headshot.jpg", // Higher res for about page
    favicon: "/images/logos/favicon.ico", // Site favicon
    logo: "/images/logos/innsyn-logo.png", // Company logo for header
    institutionLogo: "/images/logos/institution-logo.png", // University/company logo
    researchBanner: "/images/banners/research-banner.jpg", // Optional research banner
  },
  
  // Backwards compatibility
  profileImage: "/images/profile/profile.jpeg", // This will be used by existing components
};