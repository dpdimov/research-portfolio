export const siteConfig = {
  // Personal Information
  name: "Dr. [Your Name]", // Replace with your full name
  title: "[Your Title/Position]", // e.g., "Professor of Statistics"
  institution: "[Your Institution]", // e.g., "University of Example"
  email: "[your.email@institution.edu]",
  
  // Research Focus
  researchField: "[Your Research Area]", // e.g., "Statistical Analysis and Data Science"
  
  // Bio and Descriptions
  heroDescription: "Exploring cutting-edge questions in [your research area] through rigorous methodology and innovative approaches. Discover my published work and research themes.",
  
  aboutIntro: "[Add a brief personal introduction here - your research passion, what drives your work, and your overall approach to research. This should be 2-3 sentences that give visitors a sense of who you are as a researcher.]",
  
  aboutCurrent: "[Add another paragraph about your current focus, recent achievements, or what you're working on now. This helps visitors understand your current research direction.]",
  
  // Research Areas
  primaryResearchAreas: [
    "[Research Area 1]", // e.g., "Bayesian Statistics"
    "[Research Area 2]", // e.g., "Machine Learning Applications"
    "[Research Area 3]", // e.g., "Biostatistics"
  ],
  
  methodologies: [
    "[Methodology 1]", // e.g., "Statistical Modeling"
    "[Methodology 2]", // e.g., "Data Visualization"
    "[Methodology 3]", // e.g., "Experimental Design"
  ],
  
  // Academic Timeline
  positions: [
    {
      title: "[Your Current Position]",
      institution: "[Institution Name]",
      period: "[Year] - Present",
      description: "[Brief description of your current role and responsibilities]"
    },
    {
      title: "[Previous Position]", 
      institution: "[Institution Name]",
      period: "[Year Range]",
      description: "[Brief description of this role]"
    }
  ],
  
  education: {
    degree: "Ph.D. in [Your Field]",
    university: "[University Name]", 
    year: "[Year]",
    dissertation: "[Your Dissertation Title]"
  },
  
  // Statistics (these will be automatically pulled from your database for papers count)
  stats: {
    papers: "83", // Will be auto-updated from database
    themes: "5", // Will be auto-updated from database
    citations: "[#]", // Add your citation count
    hIndex: "[#]", // Add your h-index
    yearsResearch: "15+", // Update as needed
    collaborations: "100+", // Update as needed
  },
  
  // Images (store your images in /public/images/)
  images: {
    profile: "/images/profile/profile.jpg", // Replace with your profile photo
    profileLarge: "/images/profile/profile-large.jpg", // Higher res for about page
    favicon: "/images/logos/favicon.ico", // Site favicon
    institutionLogo: "/images/logos/institution-logo.png", // University/company logo
    researchBanner: "/images/banners/research-banner.jpg", // Optional research banner
  },
  
  // Backwards compatibility
  profileImage: "/images/profile/profile.jpg", // This will be used by existing components
};