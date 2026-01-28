import { db } from "../db/client.js";
import { tiktokUserDaily, tiktokVideoDaily } from "../db/schema.js";
import { sql } from "drizzle-orm";

async function checkData() {
  try {
    const userDailyCount = await db.select({ count: sql<number>`count(*)` }).from(tiktokUserDaily);
    const videoDailyCount = await db.select({ count: sql<number>`count(*)` }).from(tiktokVideoDaily);
    
    console.log(`✅ tiktokUserDaily records: ${userDailyCount[0].count}`);
    console.log(`✅ tiktokVideoDaily records: ${videoDailyCount[0].count}`);
    
    // Get sample data
    const sampleUser = await db.select().from(tiktokUserDaily).limit(3);
    const sampleVideo = await db.select().from(tiktokVideoDaily).limit(3);
    
    console.log("\nSample user daily data:");
    console.log(JSON.stringify(sampleUser, null, 2));
    
    console.log("\nSample video daily data:");
    console.log(JSON.stringify(sampleVideo, null, 2));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

checkData();
