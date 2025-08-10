# Image Directory Structure

This directory contains all images for your research portfolio site.

## Directory Structure

```
/public/images/
├── profile/          # Profile photos and headshots
│   ├── profile.jpg           # Main profile photo (400x400px recommended)
│   ├── profile-large.jpg     # Higher resolution for about page (800x800px)
│   └── headshot.jpg          # Professional headshot (optional)
├── research/         # Research-related images
│   ├── lab-photo.jpg         # Laboratory or workspace photos
│   ├── diagrams/             # Research diagrams and charts
│   └── publications/         # Publication-related images
├── logos/           # Logos and branding
│   ├── favicon.ico           # Site favicon (32x32px)
│   ├── institution-logo.png  # University/institution logo
│   └── lab-logo.png          # Lab or research group logo
└── banners/         # Banner images
    └── research-banner.jpg   # Optional research banner
```

## Image Requirements

### Profile Photos
- **Format**: JPG or PNG
- **Size**: 400x400px minimum, square aspect ratio preferred
- **Quality**: High resolution, professional appearance
- **File size**: < 500KB for web optimization

### Logos
- **Format**: PNG (for transparency) or SVG (vector)
- **Background**: Transparent preferred
- **File size**: < 100KB

### Research Images
- **Format**: JPG for photos, PNG for diagrams
- **Size**: Width 800-1200px for good quality
- **File size**: < 1MB each

## How to Add Images

1. **Copy your images** to the appropriate directories above
2. **Update the site config** in `/src/config/site.js`:
   ```javascript
   images: {
     profile: "/images/profile/your-photo.jpg",
     profileLarge: "/images/profile/your-photo-large.jpg",
     // ... other images
   }
   ```

3. **Restart the development server** if needed to see changes

## Image Optimization Tips

- Use modern formats (WebP) when possible
- Compress images before uploading (use tools like TinyPNG)
- Keep file sizes reasonable for web performance
- Use descriptive filenames (e.g., "john-doe-profile.jpg" not "IMG_001.jpg")