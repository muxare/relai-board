// GitHub OAuth App settings.
//
// Production values are baked in as defaults. For local development, override
// them in `.env.local` (see `.env.example`) using a dev OAuth app whose
// callback is registered as http://localhost:5173/relai-board/.

const PROD_CLIENT_ID = 'Ov23lifTieTFQPe8P2K1';
const PROD_WORKER_URL = 'https://relai-board-auth.sundberg-mikael.workers.dev';

export const GITHUB_CLIENT_ID =
  import.meta.env.VITE_GITHUB_CLIENT_ID || PROD_CLIENT_ID;

export const OAUTH_WORKER_URL =
  import.meta.env.VITE_OAUTH_WORKER_URL || PROD_WORKER_URL;

export const OAUTH_REDIRECT_URI = `${window.location.origin}/relai-board/`;
