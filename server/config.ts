import dotenv from "dotenv";
import path from "path";

// Load environment variables from project .env file
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const config = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: process.env.PORT ?? "5000",
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  SESSION_SECRET: process.env.SESSION_SECRET ?? "notepanda-dev-secret",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  REPLIT_DEPLOYMENT: process.env.REPLIT_DEPLOYMENT,
  REPLIT_DEV_DOMAIN: process.env.REPLIT_DEV_DOMAIN,
  REPL_SLUG: process.env.REPL_SLUG,
  REPL_ID: process.env.REPL_ID,
};

export default config;
