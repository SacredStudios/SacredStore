const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const express = require("express");
const cors = require("cors");
const stripe = require("stripe")("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");

// App config
const app = express();

// Middlewares
app.use(cors({ origin: true }));
app.use(express.json());

// API routes
app.get("/", (req, res) => {
  res.status(200).send("Hello world!");
});

// Exports (v2 style)
exports.api = onRequest(app);
