const envUrl = import.meta.env.VITE_API_URL;

const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // 1. If running on Vercel, ALWAYS use the public shared URL
    // This prevents errors where Vercel accidentally uses the private dev URL
    if (hostname.includes('vercel.app')) {
      return 'https://ais-pre-4utfza4jbx2dlatcr62r64-157497256116.europe-west2.run.app';
    }
    
    // 2. If running in AI Studio dev environment or localhost, use relative URLs
    if (hostname.includes('ais-dev-') || hostname === 'localhost' || hostname === '127.0.0.1') {
      return '';
    }
  }
  
  // 3. Use env variable if provided and it's not a private dev URL
  if (typeof envUrl === 'string' && envUrl !== '/' && envUrl.trim() !== '' && !envUrl.includes('ais-dev-')) {
    return envUrl;
  }
  
  // 4. Fallback for any other external environment
  return 'https://ais-pre-4utfza4jbx2dlatcr62r64-157497256116.europe-west2.run.app';
};

export const API_URL = getApiUrl();
