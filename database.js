const { MongoClient } = require("mongodb");
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = mongoose.connection.name;

let client;
let db;

async function getDb() {
  if (db) return db;
  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  await ensureIndexes(db);
  return db;
}

async function ensureIndexes(db) {
  const col = db.collection("profiles");
  await col.createIndex({ name: 1 }, { unique: true });
  await col.createIndex({ gender: 1 });
  await col.createIndex({ age_group: 1 });
  await col.createIndex({ country_id: 1 });
  await col.createIndex({ age: 1 });
  await col.createIndex({ created_at: 1 });
  await col.createIndex({ gender_probability: 1 });
}

async function closeDb() {
  if (client) await client.close();
}

module.exports = { getDb, closeDb };
