const {onRequest} = require("firebase-functions/v2/https");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const stripeLib = require("stripe");

/* eslint-disable require-jsdoc */
// Initialize Firebase Admin
admin.initializeApp();

// Create an Express app
const app = express();
app.use(cors({origin: true}));
app.use(express.json());

// Middleware: Verify Firebase Auth token
async function checkAuth(req, res, next) {
  const h = req.headers.authorization||"";
  if (!h.startsWith("Bearer ")) return res.status(401).send("No token");
  const idToken = h.split("Bearer ")[1];
  try {
    await admin.auth().verifyIdToken(idToken);
    return next();
  } catch (e) {
    console.error("Token error:", e);
    return res.status(403).send("Unauthorized");
  }
}

// Combine your Stripe live key
const key1="sk_live_51QoH15Lx9xG3paMnc5QaFie6gmWwLjyGsnERu6UMUytuHd";
const key2="IrpoTLCDOGnNCroEjnwHuNLFYWc8BRyuN2NpKoZK7W00M2JgOxxd";
const stripe = stripeLib(key1+key2);

// Test route (no auth)
app.get("/", (req, res)=>res.send("Hello world!"));

// Payment route (requires auth)
app.post("/payments/create", checkAuth, async (req, res) => {
  try {
    const total = parseInt(req.query.total||"0", 10);
    console.log("Received total:", total);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: total-7400, // example logic
      currency: "usd",
    });
    console.log("Returning:", paymentIntent.client_secret);
    return res.status(201).send({clientSecret: paymentIntent.client_secret});
  } catch (e) {
    console.error("Error:", e);
    return res.status(500).send({error: e.message});
  }
});

// Export the v2 HTTP function
exports.api = onRequest(app);
