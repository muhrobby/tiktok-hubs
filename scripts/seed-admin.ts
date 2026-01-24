#!/usr/bin/env tsx

/**
 * ==============================================
 * SEED ADMIN USER SCRIPT
 * ==============================================
 * Script untuk membuat user admin pertama di production database
 * 
 * Usage:
 *   npm run seed:admin -- --username=admin --email=admin@example.com --password=YourSecurePassword123
 * 
 * Atau jalankan via Docker:
 *   docker exec tiktokhubs-backend npm run seed:admin -- --username=admin --email=admin@example.com --password=YourSecurePassword123
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { users, roles, userRoles } from '../backend/src/db/schema';
import { eq } from 'drizzle-orm';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};
  
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (key && value) {
        parsed[key] = value;
      }
    }
  }
  
  return parsed;
}

async function seedAdmin() {
  const args = parseArgs();
  
  // Validate arguments
  const username = args.username;
  const email = args.email;
  const password = args.password;
  const fullName = args.fullname || args.name || 'Administrator';
  
  if (!username || !email || !password) {
    console.error('❌ Error: Missing required arguments');
    console.log('');
    console.log('Usage:');
    console.log('  npm run seed:admin -- --username=admin --email=admin@example.com --password=SecurePass123');
    console.log('');
    console.log('Optional:');
    console.log('  --fullname="Admin Name"  (default: "Administrator")');
    console.log('');
    process.exit(1);
  }
  
  // Validate password strength
  if (password.length < 8) {
    console.error('❌ Error: Password harus minimal 8 karakter');
    process.exit(1);
  }
  
  console.log('================================================');
  console.log('👤 TikTok Hubs - Seed Admin User');
  console.log('================================================');
  console.log('');
  
  // Get database URL from environment
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL tidak ditemukan di environment variables');
    process.exit(1);
  }
  
  console.log('🔌 Connecting to database...');
  
  // Connect to database
  const sql = postgres(databaseUrl);
  const db = drizzle(sql);
  
  try {
    // Check if user already exists
    console.log('🔍 Checking if user already exists...');
    const existingUser = await db.select().from(users).where(eq(users.username, username)).limit(1);
    
    if (existingUser.length > 0) {
      console.error(`❌ Error: User dengan username "${username}" sudah ada!`);
      process.exit(1);
    }
    
    // Hash password
    console.log('🔐 Hashing password...');
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user
    console.log('👤 Creating admin user...');
    const [newUser] = await db.insert(users).values({
      username,
      email,
      fullName,
      passwordHash,
      isActive: true,
    }).returning();
    
    console.log(`✅ User created: ID=${newUser.id}, Username=${newUser.username}`);
    
    // Get Admin role
    console.log('🔍 Finding Admin role...');
    const [adminRole] = await db.select().from(roles).where(eq(roles.name, 'Admin')).limit(1);
    
    if (!adminRole) {
      console.error('❌ Error: Admin role tidak ditemukan di database!');
      console.log('   Pastikan migrations sudah dijalankan dengan benar.');
      process.exit(1);
    }
    
    console.log(`✅ Admin role found: ID=${adminRole.id}`);
    
    // Assign Admin role to user
    console.log('🔗 Assigning Admin role to user...');
    await db.insert(userRoles).values({
      userId: newUser.id,
      roleId: adminRole.id,
      storeCode: null, // Admin tidak terikat ke store tertentu
    });
    
    console.log('✅ Admin role assigned successfully');
    console.log('');
    console.log('================================================');
    console.log('✅ ADMIN USER CREATED SUCCESSFULLY!');
    console.log('================================================');
    console.log('');
    console.log('📋 User Details:');
    console.log(`   Username: ${newUser.username}`);
    console.log(`   Email: ${newUser.email}`);
    console.log(`   Full Name: ${newUser.fullName}`);
    console.log(`   Role: Admin`);
    console.log(`   Created At: ${newUser.createdAt}`);
    console.log('');
    console.log('🔐 Login Credentials:');
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log('');
    console.log('⚠️  PENTING: Segera ganti password setelah login pertama!');
    console.log('================================================');
    
  } catch (error) {
    console.error('❌ Error saat membuat admin user:');
    console.error(error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the script
seedAdmin();
