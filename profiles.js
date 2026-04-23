const express = require("express");
const router = express.Router();
const { getDb } = require("./database.js");
const { parseNaturalLanguage } = require("./nlParser.js");

const VALID_SORT_BY = ["age", "created_at", "gender_probability"];
const VALID_ORDER = ["asc", "desc"];
const VALID_AGE_GROUPS = ["child", "teenager", "adult", "senior"];
const VALID_GENDERS = ["male", "female"];


function buildMongoFilter(filters) {
  const query = {};

  if (filters.gender) query.gender = filters.gender;
  if (filters.age_group) query.age_group = filters.age_group;
  if (filters.country_id) query.country_id = filters.country_id.toUpperCase();

  if (filters.min_age !== undefined || filters.max_age !== undefined) {
    query.age = {};
    if (filters.min_age !== undefined) query.age.$gte = filters.min_age;
    if (filters.max_age !== undefined) query.age.$lte = filters.max_age;
  }
  if (filters.min_gender_probability !== undefined) {
    query.gender_probability = { $gte: filters.min_gender_probability };
  }
  if (filters.min_country_probability !== undefined) {
    query.country_probability = { $gte: filters.min_country_probability };
  }

  return query;
}

function formatProfile(doc) {
  return {
    id: doc.id,
    name: doc.name,
    gender: doc.gender,
    gender_probability: doc.gender_probability,
    age: doc.age,
    age_group: doc.age_group,
    country_id: doc.country_id,
    country_name: doc.country_name,
    country_probability: doc.country_probability,
    created_at: doc.created_at,
  };
}

router.get("/", async (req, res) => {
  const {
    gender,
    age_group,
    country_id,
    min_age,
    max_age,
    min_gender_probability,
    min_country_probability,
    sort_by = "created_at",
    order = "asc",
    page = "1",
    limit = "10",
  } = req.query;

  if (!VALID_SORT_BY.includes(sort_by)) {
    return res.status(422).json({ status: "error", message: "Invalid query parameters" });
  }
  if (!VALID_ORDER.includes(order.toLowerCase())) {
    return res.status(422).json({ status: "error", message: "Invalid query parameters" });
  }
  if (gender && !VALID_GENDERS.includes(gender.toLowerCase())) {
    return res.status(422).json({ status: "error", message: "Invalid query parameters" });
  }
  if (age_group && !VALID_AGE_GROUPS.includes(age_group.toLowerCase())) {
    return res.status(422).json({ status: "error", message: "Invalid query parameters" });
  }

  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), 50);

  if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
    return res.status(422).json({ status: "error", message: "Invalid query parameters" });
  }

  const filters = {};
  if (gender) filters.gender = gender.toLowerCase();
  if (age_group) filters.age_group = age_group.toLowerCase();
  if (country_id) filters.country_id = country_id;

  if (min_age !== undefined) {
    const v = parseInt(min_age);
    if (isNaN(v)) return res.status(422).json({ status: "error", message: "Invalid query parameters" });
    filters.min_age = v;
  }
  if (max_age !== undefined) {
    const v = parseInt(max_age);
    if (isNaN(v)) return res.status(422).json({ status: "error", message: "Invalid query parameters" });
    filters.max_age = v;
  }
  if (min_gender_probability !== undefined) {
    const v = parseFloat(min_gender_probability);
    if (isNaN(v) || v < 0 || v > 1) return res.status(422).json({ status: "error", message: "Invalid query parameters" });
    filters.min_gender_probability = v;
  }
  if (min_country_probability !== undefined) {
    const v = parseFloat(min_country_probability);
    if (isNaN(v) || v < 0 || v > 1) return res.status(422).json({ status: "error", message: "Invalid query parameters" });
    filters.min_country_probability = v;
  }

  try {
    const db = await getDb();
    const col = db.collection("profiles");
    const mongoFilter = buildMongoFilter(filters);
    const sortDir = order.toLowerCase() === "desc" ? -1 : 1;
    const skip = (pageNum - 1) * limitNum;

    const [total, docs] = await Promise.all([
      col.countDocuments(mongoFilter),
      col.find(mongoFilter)
        .sort({ [sort_by]: sortDir })
        .skip(skip)
        .limit(limitNum)
        .toArray(),
    ]);

    return res.json({
      status: "success",
      page: pageNum,
      limit: limitNum,
      total,
      data: docs.map(formatProfile),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
});

/**
 GET /api/profiles/search
 */
router.get("/search", async (req, res) => {
  const { q, page = "1", limit = "10" } = req.query;

  if (!q || q.trim() === "") {
    return res.status(400).json({ status: "error", message: "Missing or empty parameter" });
  }

  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), 50);

  if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
    return res.status(422).json({ status: "error", message: "Invalid query parameters" });
  }

  const filters = parseNaturalLanguage(q);
  if (!filters) {
    return res.status(200).json({ status: "error", message: "Unable to interpret query" });
  }

  try {
    const db = await getDb();
    const col = db.collection("profiles");
    const mongoFilter = buildMongoFilter(filters);
    const skip = (pageNum - 1) * limitNum;

    const [total, docs] = await Promise.all([
      col.countDocuments(mongoFilter),
      col.find(mongoFilter)
        .sort({ created_at: 1 })
        .skip(skip)
        .limit(limitNum)
        .toArray(),
    ]);

    return res.json({
      status: "success",
      page: pageNum,
      limit: limitNum,
      total,
      data: docs.map(formatProfile),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
});

module.exports = router;