import { db } from './index';
import { lists } from './schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Seeds the database with initial data.
 * Creates the Inbox list if it doesn't exist.
 */
export async function seed() {
  // Check if Inbox already exists
  const existingInbox = await db
    .select()
    .from(lists)
    .where(eq(lists.isInbox, true))
    .limit(1);

  if (existingInbox.length === 0) {
    const now = new Date();
    await db.insert(lists).values({
      id: uuidv4(),
      name: 'Inbox',
      isInbox: true,
      createdAt: now,
      updatedAt: now,
    });
    console.log('✓ Created Inbox list');
  } else {
    console.log('✓ Inbox list already exists');
  }
}

/**
 * Ensures the Inbox list exists.
 * Returns the Inbox list.
 */
export async function ensureInboxExists() {
  const existingInbox = await db
    .select()
    .from(lists)
    .where(eq(lists.isInbox, true))
    .limit(1);

  if (existingInbox.length > 0) {
    return existingInbox[0];
  }

  const now = new Date();
  const inboxId = uuidv4();
  
  await db.insert(lists).values({
    id: inboxId,
    name: 'Inbox',
    isInbox: true,
    createdAt: now,
    updatedAt: now,
  });

  const [inbox] = await db
    .select()
    .from(lists)
    .where(eq(lists.id, inboxId));

  return inbox;
}

// Run seed if executed directly via: bun run src/lib/db/seed.ts
// Using require.main check for Node.js compatibility, or call seed() directly when using Bun
const isMainModule = typeof require !== 'undefined' && require.main === module;

if (isMainModule) {
  seed()
    .then(() => {
      console.log('Seed completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
