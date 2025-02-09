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

// FedEx API credentials and URLs
const FEDEX_API_KEY =
  "l741c6216d04a14ba29e8a3dd2c7b2b52d";
const FEDEX_SECRET_KEY =
  "bcf5e835cce64d15a733412ec707499a";
const FEDEX_TOKEN_URL =
  "https://apis.fedex.com/oauth/token";
const FEDEX_RATE_URL =
  "https://apis.fedex.com/rate/v1/rates";

// FedEx Shipping Cost Calculation using fetch
async function calculateFedExShipping(destAddr) {
  try {
    const tokenRes = await fetch(FEDEX_TOKEN_URL, {
      method: "POST",
      headers: {
        "Authorization":
          "Basic " +
          Buffer.from(FEDEX_API_KEY + ":" +
            FEDEX_SECRET_KEY).toString("base64"),
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      throw new Error("No FedEx token");
    }
    const rateRes = await fetch(FEDEX_RATE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestedShipment: {
          shipper: {
            address: {
              postalCode: "30322",
              countryCode: "US",
            },
          },
          recipient: {
            address: {
              streetLines: [destAddr],
              countryCode: "US",
            },
          },
          packageCount: 1,
          requestedPackageLineItems: [{
            weight: {units: "LB", value: 5},
            dimensions: {
              length: 12,
              width: 8,
              height: 6,
              units: "IN",
            },
          }],
          serviceType: "FEDEX_GROUND",
        },
      }),
    });
    const rateData = await rateRes.json();
    const details =
      rateData.output &&
      rateData.output.rateReplyDetails &&
      rateData.output.rateReplyDetails[0] &&
      rateData.output.rateReplyDetails[0].ratedShipmentDetails &&
      rateData.output.rateReplyDetails[0]
          .ratedShipmentDetails[0];
    const cost =
      details && details.totalNetCharge &&
      details.totalNetCharge.amount;
    return parseFloat(cost || 0);
  } catch (err) {
    console.error("FedEx error:", err);
    return 0;
  }
}

// Middleware: Verify Firebase Auth token
async function checkAuth(req, res, next) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) {
    return res.status(401).send("No token");
  }
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
const key1 =
  "sk_live_51QoH15Lx9xG3paMnc5QaFie6gmWwLjyGsnERu6UMUytuHd";
const key2 =
  "IrpoTLCDOGnNCroEjnwHuNLFYWc8BRyuN2NpKoZK7W00M2JgOxxd";
const stripe = stripeLib(key1 + key2);

// Test route (no auth)
app.get("/", (req, res) => res.send("Hello world!"));

app.get("/shipping/cost", checkAuth, async (req, res) => {
  try {
    const address = req.query.address || "";
    if (!address) {
      return res.status(400).send({error: "Address is required"});
    }
    const shippingCost = await calculateFedExShipping(address);
    res.status(200).send({shippingCost});
  } catch (error) {
    console.error("Error calculating shipping cost:", error);
    res.status(500).send({error: error.message});
  }
});
// Payment route (requires auth)
app.post("/payments/create", checkAuth, async (req, res) => {
  try {
    const total = parseInt(req.query.total || "0", 10);
    const address = req.query.address || "";
    console.log("Received total:", total);
    const shipping = await calculateFedExShipping(address);
    console.log("Shipping cost:", shipping);
    const finalAmount = total - 7400 +
      Math.round(shipping * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount,
      currency: "usd",
    });
    console.log("Returning:",
        paymentIntent.client_secret);
    return res.status(201).send({
      clientSecret: paymentIntent.client_secret,
      shippingCost: shipping,
    });
  } catch (e) {
    console.error("Error:", e);
    return res.status(500).send({error: e.message});
  }
});

// Export the v2 HTTP function
exports.api = onRequest(app);
