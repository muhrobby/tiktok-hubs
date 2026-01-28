/**
 * Database Seed Script for K6 Testing
 *
 * Creates test users for load testing and security testing:
 * - admin (Admin role)
 * - ops (Ops role)
 * - store_user (Store role)
 *
 * Run with: npx tsx src/db/seed-test-users.ts
 */

import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcrypt";
import { db } from "./client.js";
import { users, roles, userRoles, stores } from "./schema.js";
import { logger } from "../utils/logger.js";
import { closeDb } from "./client.js";
import { eq, and } from "drizzle-orm";

const TEST_USERS = [
  {
    username: "admin",
    password: "admin123",
    fullName: "Test Admin",
    email: "admin@test.local",
    roleName: "Admin" as const,
    storeAccess: "all", // Admin has access to all stores
  },
  {
    username: "ops",
    password: "ops123",
    fullName: "Test Ops",
    email: "ops@test.local",
    roleName: "Ops" as const,
    storeAccess: "all", // Ops has access to all stores
  },
  {
    username: "store_user",
    password: "store123",
    fullName: "Test Store User",
    email: "store@test.local",
    roleName: "Store" as const,
    storeAccess: "STORE001", // Store user has access to specific store only
  },
];

async function seedTestUsers() {
  try {
    logger.info("Starting test users seeding for K6...");

    // 1. Check if roles exist
    logger.info("Checking roles...");
    const existingRoles = await db.select().from(roles);
    
    if (existingRoles.length === 0) {
      logger.error("No roles found! Please run the main seed script first: npm run db:seed");
      process.exit(1);
    }

    logger.info(`Found ${existingRoles.length} roles`);

    // 2. Create test stores if they don't exist (for store_user)
    logger.info("Checking test stores...");
    const testStores = ["STORE001", "STORE002", "STORE003"];
    
    for (const storeCode of testStores) {
      const existingStore = await db
        .select()
        .from(stores)
        .where(eq(stores.storeCode, storeCode))
        .limit(1);

      if (existingStore.length === 0) {
        await db.insert(stores).values({
          storeCode: storeCode,
          storeName: `Test Store ${storeCode}`,
          picName: `PIC ${storeCode}`,
          picContact: `+62812345${storeCode.slice(-3)}`,
        });
        logger.info(`Created test store: ${storeCode}`);
      }
    }

    // 3. Create test users
    logger.info("Creating test users...");

    for (const testUser of TEST_USERS) {
      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.username, testUser.username))
        .limit(1);

      if (existingUser.length > 0) {
        logger.info(`User '${testUser.username}' already exists, updating password...`);
        
        // Update password
        const passwordHash = await bcrypt.hash(testUser.password, 10);
        await db
          .update(users)
          .set({ 
            passwordHash: passwordHash,
            fullName: testUser.fullName,
            email: testUser.email,
          })
          .where(eq(users.username, testUser.username));

        logger.info(`✓ Updated user: ${testUser.username}`);
      } else {
        logger.info(`Creating user: ${testUser.username}...`);
        
        // Hash password
        const passwordHash = await bcrypt.hash(testUser.password, 10);

        // Insert user
        const [newUser] = await db
          .insert(users)
          .values({
            username: testUser.username,
            passwordHash: passwordHash,
            fullName: testUser.fullName,
            email: testUser.email,
          })
          .returning();

        logger.info(`✓ Created user: ${testUser.username} (ID: ${newUser.id})`);

        // Assign role
        const role = existingRoles.find((r) => r.name === testUser.roleName);
        if (role) {
          // Determine store code for role assignment
          const storeCodeForRole = testUser.storeAccess !== "all" ? testUser.storeAccess : null;
          
          // Check if role assignment already exists
          const existingRoleAssignment = await db
            .select()
            .from(userRoles)
            .where(
              and(
                eq(userRoles.userId, newUser.id),
                eq(userRoles.roleId, role.id),
                storeCodeForRole 
                  ? eq(userRoles.storeCode, storeCodeForRole)
                  : eq(userRoles.storeCode, null)
              )
            )
            .limit(1);

          if (existingRoleAssignment.length === 0) {
            await db.insert(userRoles).values({
              userId: newUser.id,
              roleId: role.id,
              storeCode: storeCodeForRole,
            });
            
            if (storeCodeForRole) {
              logger.info(`  ✓ Assigned role: ${testUser.roleName} with access to ${storeCodeForRole}`);
            } else {
              logger.info(`  ✓ Assigned role: ${testUser.roleName} (all stores access)`);
            }
          }
        } else {
          logger.warn(`  ⚠ Role '${testUser.roleName}' not found`);
        }
      }
    }

    // 4. Display summary
    logger.info("\n========================================");
    logger.info("Test Users Created Successfully!");
    logger.info("========================================\n");
    
    console.log("You can now use these credentials for K6 testing:\n");
    
    TEST_USERS.forEach((user) => {
      console.log(`  ${user.roleName} User:`);
      console.log(`    Username: ${user.username}`);
      console.log(`    Password: ${user.password}`);
      console.log(`    Access:   ${user.storeAccess === "all" ? "All stores" : user.storeAccess}`);
      console.log("");
    });

    console.log("To run K6 tests with these credentials:");
    console.log("  cd k6-tests");
    console.log("  ./run-tests.sh\n");

    logger.info("Database seeding completed successfully!");
  } catch (error) {
    logger.error({ error }, "Database seeding failed");
    console.error("\nError details:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

seedTestUsers();
