/**
 * Generate Test Analytics Data
 * Creates dummy daily snapshots for testing analytics charts
 */

import { db } from "../db/client.js";
import { tiktokUserDaily, tiktokVideoDaily, stores, storeAccounts } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../utils/logger.js";

async function generateTestData() {
  try {
    logger.info("Starting test data generation...");

    // Get all stores with connected accounts
    const connectedAccounts = await db
      .select({
        storeCode: storeAccounts.storeCode,
      })
      .from(storeAccounts)
      .where(eq(storeAccounts.status, "CONNECTED"));

    if (connectedAccounts.length === 0) {
      logger.warn("No connected accounts found. Please connect at least one account first.");
      return;
    }

    logger.info(`Found ${connectedAccounts.length} connected accounts`);

    // Generate data for last 30 days
    const days = 30;
    const today = new Date();

    for (let dayOffset = days - 1; dayOffset >= 0; dayOffset--) {
      const date = new Date(today);
      date.setDate(date.getDate() - dayOffset);
      const snapshotDate = date.toISOString().split("T")[0];

      logger.info(`Generating data for ${snapshotDate}...`);

      for (const account of connectedAccounts) {
        // Generate user daily data with growth trend
        const baseFollowers = 10000 + Math.floor(Math.random() * 50000);
        const growthRate = 1 + (days - dayOffset) * 0.02; // 2% growth per day
        const followers = Math.floor(baseFollowers * growthRate);
        const likes = Math.floor(followers * (2 + Math.random() * 3)); // 2-5x followers
        const videos = 50 + Math.floor(Math.random() * 100);

        await db.insert(tiktokUserDaily).values({
          storeCode: account.storeCode,
          displayName: `Store ${account.storeCode}`,
          avatarUrl: `https://picsum.photos/seed/${account.storeCode}/200/200`,
          followerCount: followers,
          followingCount: Math.floor(followers * 0.1), // 10% of followers
          likesCount: likes,
          videoCount: videos,
          snapshotDate,
        }).onConflictDoNothing();

        // Generate video daily data (5-10 videos per store)
        const videoCount = 5 + Math.floor(Math.random() * 6);
        for (let i = 0; i < videoCount; i++) {
          const baseViews = 5000 + Math.floor(Math.random() * 50000);
          const viewGrowth = 1 + (days - dayOffset) * 0.03; // 3% growth per day
          const views = Math.floor(baseViews * viewGrowth);
          const videoLikes = Math.floor(views * (0.05 + Math.random() * 0.1)); // 5-15% engagement
          const comments = Math.floor(videoLikes * (0.1 + Math.random() * 0.2));
          const shares = Math.floor(videoLikes * (0.05 + Math.random() * 0.1));

          await db.insert(tiktokVideoDaily).values({
            storeCode: account.storeCode,
            videoId: `test_video_${account.storeCode}_${snapshotDate}_${i}`,
            description: `Test video ${i + 1} for ${snapshotDate}`,
            coverImageUrl: `https://picsum.photos/seed/${account.storeCode}_${i}/400/600`,
            shareUrl: `https://tiktok.com/@store_${account.storeCode}/video/test_${i}`,
            createTime: new Date(date.getTime() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)), // Random within last 30 days
            viewCount: views,
            likeCount: videoLikes,
            commentCount: comments,
            shareCount: shares,
            snapshotDate,
          }).onConflictDoNothing();
        }
      }
    }

    logger.info("✅ Test data generation completed successfully!");
    logger.info(`Generated ${days} days of data for ${connectedAccounts.length} accounts`);
    logger.info("You can now view analytics in the dashboard");

  } catch (error) {
    console.error("Error generating test data:", error);
    logger.error({ error }, "Failed to generate test data");
    throw error;
  } finally {
    process.exit(0);
  }
}

// Run the script
generateTestData();
