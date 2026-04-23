const express = require("express");
const cors = require("cors");
const profilesRouter = require("./profiles.js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

app.use(express.json());


app.use("/api/profiles", profilesRouter);


app.use((req, res) => {
  res.status(404).json({ status: "error", message: "Route not found" });
});


app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ status: "error", message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Insighta Labs API running on http://localhost:${PORT}`);
});

module.exports = app;