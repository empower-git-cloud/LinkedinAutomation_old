declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    LINKEDIN_CLIENT_ID?: string;
    LINKEDIN_CLIENT_SECRET?: string;
    LINKEDIN_REDIRECT_URI?: string;
    LINKEDIN_SCOPES?: string;
    LINKEDIN_API_VERSION?: string;
    TOKEN_ENCRYPTION_KEY?: string;
    CRON_SECRET?: string;
  }
}
