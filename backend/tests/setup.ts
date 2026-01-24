import dotenv from "dotenv";

// Load environment variables from .env file for tests
dotenv.config();

// Override DATABASE_URL with TEST_DATABASE_URL if it exists
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
