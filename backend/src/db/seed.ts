/**
 * Database Seed Script
 *
 * Initializes roles and creates default admin user
 * Run with: npm run db:seed
 */

import dotenv from "dotenv";
dotenv.config();

import { ensureDefaultAdmin, initializeRoles } from "../services/user.service.js";
import { logger } from "../utils/logger.js";
import { closeDb } from "./client.js";

async function seed() {
  try {
    logger.info("Starting database seeding...");

    // Initialize roles first
    await initializeRoles();
    logger.info("Roles initialized");

    // Create default admin if none exists
    await ensureDefaultAdmin();

    logger.info("Database seeding completed successfully!");
  } catch (error) {
    logger.error({ error }, "Database seeding failed");
    process.exit(1);
  } finally {
    await closeDb();
  }
}

seed();
