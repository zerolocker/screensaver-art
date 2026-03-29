// In dev, Vite proxies /api/* → localhost:3000; in production use the live site
const API_BASE = import.meta.env.DEV ? '' : 'https://living-art-screensaver.com'

export const GALLERY_ENDPOINT = `${API_BASE}/api/gallery`
export const SUBSCRIPTION_VERIFY_ENDPOINT = `${API_BASE}/api/subscription/verify`
