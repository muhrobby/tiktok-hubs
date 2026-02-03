import { db } from "../db/client.js";
import { storeAccounts } from "../db/schema.js";
import { eq } from "drizzle-orm";

async function checkAccounts() {
  try {
    const accounts = await db
      .select()
      .from(storeAccounts)
      .where(eq(storeAccounts.status, "CONNECTED"));
    
    console.log(`Connected accounts: ${accounts.length}`);
    console.log(JSON.stringify(accounts, null, 2));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

checkAccounts();
