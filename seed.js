const path = require("path");
const fs = require("fs");
const { getDb, closeDb } = require("./database");
const { v7: uuidv7 } = require("uuid");

const SEED_PATH = process.argv[2] || path.join(__dirname, "./seed.json");

async function seed() {
  if (!fs.existsSync(SEED_PATH)) {
    console.error(`Seed file not found: ${SEED_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(SEED_PATH, "utf-8");
  const { profiles } = JSON.parse(raw);

  if (!Array.isArray(profiles) || profiles.length === 0) {
    console.error("No profiles found in seed file.");
    process.exit(1);
  }

  console.log(`Connecting to MongoDB...`);
  const db = await getDb();
  const col = db.collection("profiles");

  console.log(`Seeding ${profiles.length} profiles...`);

  const now = new Date().toISOString();
  const ops = profiles.map((p) => ({
    updateOne: {
      filter: { name: p.name },
      update: {
        $setOnInsert: {
          id: uuidv7(),
          name: p.name,
          gender: p.gender,
          gender_probability: p.gender_probability,
          age: p.age,
          age_group: p.age_group,
          country_id: p.country_id,
          country_name: p.country_name,
          country_probability: p.country_probability,
          created_at: now,
        },
      },
      upsert: true,
    },
  }));

  const result = await col.bulkWrite(ops, { ordered: false });

  console.log(`Done.`);
  console.log(`Inserted : ${result.upsertedCount}`);
  console.log(`Skipped  : ${result.matchedCount} (already exist)`);

  await closeDb();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
