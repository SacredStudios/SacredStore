const {onRequest} = require("firebase-functions/v2/https");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const stripeLib = require("stripe");
const fetch = require("node-fetch");

admin.initializeApp();

const app = express();
app.use(cors({origin: true}));
app.use(express.json());

const FEDEX_API_KEY = "l741c6216d04a14ba29e8a3dd2c7b2b52d";
const FEDEX_SECRET_KEY = "9978785af08c4d66b1d2022118e851f9";
const FEDEX_TOKEN_URL = "https://apis.fedex.com/oauth/token";
const FEDEX_RATE_URL = "https://apis.fedex.com/rate/v1/rates/quotes";

const key1 = "sk_live_51QoH15Lx9xG3paMnc5QaFie6gmWwLjyGsnERu6UMUytuHd";
const key2 = "IrpoTLCDOGnNCroEjnwHuNLFYWc8BRyuN2NpKoZK7W00M2JgOxxd";
const stripe = stripeLib(key1 + key2);

/**
 * Calculates shipping using the FedEx API with a minimal payload.
 * This function parses the response and returns the first
 * "total net charge" value extracted from the rated shipment details.
 *

 * @param {string} destAddr
 * @return {Promise<number>}
 */
async function calculateFedExShipping(destAddr) {
  try {
    // Step 1: Obtain OAuth token
    const tokenRes = await fetch(FEDEX_TOKEN_URL, {
      method: "POST",
      headers: {"Content-Type": "application/x-www-form-urlencoded"},
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: FEDEX_API_KEY,
        client_secret: FEDEX_SECRET_KEY,
      }).toString(),
    });

    const tokenText = await tokenRes.text();
    console.log("DEBUG: Token response status:", tokenRes.status);
    console.log("DEBUG: Token response text:", tokenText);

    if (!tokenRes.ok) {
      let errorResponse;
      try {
        errorResponse = await tokenRes.json();
      } catch (e) {
        errorResponse = tokenText || "No error message provided";
      }
      console.error("FedEx token error response:", errorResponse);
      throw new Error(
          "Failed to fetch token (status " +
          tokenRes.status +
          "): " +
          JSON.stringify(errorResponse),
      );
    }

    let tokenData;
    try {
      tokenData = JSON.parse(tokenText);
    } catch (err) {
      throw new Error(`Invalid token JSON: ${tokenText}`);
    }
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      throw new Error("No FedEx token in response");
    }

    // Minimal payload as provided:
    const requestBody = {
      accountNumber: {value: "204492269"},
      requestedShipment: {
        shipper: {
          address: {postalCode: "65247", countryCode: "US"},
        },
        recipient: {
          address: {postalCode: "72348", countryCode: "US"},
        },
        pickupType: "DROPOFF_AT_FEDEX_LOCATION",
        rateRequestType: ["ACCOUNT", "LIST"],
        requestedPackageLineItems: [
          {weight: {units: "LB", value: "10"}},
        ],
      },
    };

    console.log("DEBUG: Payload:", JSON.stringify(requestBody, null, 2));
    // Step 3: Send the rate request
    const rateRes = await fetch(FEDEX_RATE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "x-locale": "en_US",
      },
      body: JSON.stringify(requestBody),
    });

    const rateText = await rateRes.text();
    console.log("DEBUG: Rate response status:", rateRes.status);
    console.log("DEBUG: Rate response text:", rateText);

    if (!rateRes.ok) {
      let errorRate;
      try {
        errorRate = await rateRes.json();
      } catch (e) {
        errorRate = rateText || "No error message provided";
      }
      console.error("FedEx rate error response:", errorRate);
      throw new Error(
          "Failed to fetch rates (status " +
          rateRes.status +
          "): " +
          JSON.stringify(errorRate),
      );
    }

    let rateData;
    try {
      rateData = JSON.parse(rateText);
    } catch (err) {
      console.error("DEBUG: Error parsing rate JSON:", err);
      throw new Error("FedEx rate returned invalid JSON");
    }

    // Parse the response and extract the first "total net charge" value.
    let netCharge = 0;
    if (
      rateData.output &&
      Array.isArray(rateData.output.rateReplyDetails)
    ) {
      for (const detail of rateData.output.rateReplyDetails) {
        if (
          detail.ratedShipmentDetails &&
          Array.isArray(detail.ratedShipmentDetails)
        ) {
          for (const shipment of detail.ratedShipmentDetails) {
            if (shipment.totalNetCharge !== undefined) {
              if (
                typeof shipment.totalNetCharge === "object" &&
                shipment.totalNetCharge.amount !== undefined
              ) {
                netCharge = shipment.totalNetCharge.amount;
              } else {
                netCharge = shipment.totalNetCharge;
              }
              // Return the first encountered value
              return netCharge;
            }
          }
        }
      }
    }
    return netCharge;
  } catch (err) {
    console.error("FedEx error:", err);
    return 0;
  }
}

/**
 * Middleware to verify the Firebase Auth token.
 *
 * @param {Object} req Express request object.
 * @param {Object} res Express response object.
 * @param {Function} next Next function to call.
 * @return {void}
 */
async function checkAuth(req, res, next) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) {
    return res.status(401).send({error: "No token provided"});
  }
  const idToken = h.split("Bearer ")[1];
  try {
    await admin.auth().verifyIdToken(idToken);
    return next();
  } catch (e) {
    console.error("Token error:", e);
    return res.status(403).send({error: "Unauthorized"});
  }
}

/**
 * Test route (no auth required).
 *
 * @param {Object} req Express request object.
 * @param {Object} res Express response object.
 */
app.get("/", (req, res) => res.send("Hello world!"));

/**
 * Route to get shipping cost.
 *
 * @param {Object} req Express request object.
 * @param {Object} res Express response object.
 * @param {Function} next Next function to call.
 */
app.get("/shipping/cost", checkAuth, async (req, res, next) => {
  try {
    // Even though the minimal payload ignores the input address,
    // we'll require one for consistency.
    const address = req.query.address || "";
    if (!address) {
      return res.status(400).send({error: "Address is required"});
    }
    const netCharge = await calculateFedExShipping(address);
    return res.status(200).send({totalNetCharge: netCharge});
  } catch (error) {
    console.error("Error calculating shipping:", error);
    next(error);
  }
});

/**
 * Route to create PaymentIntent factoring in shipping cost.
 *
 * @param {Object} req Express request object.
 * @param {Object} res Express response object.
 * @param {Function} next Next function to call.
 */
app.post("/payments/create", checkAuth, async (req, res, next) => {
  try {
    const total = parseInt(req.query.total || "0", 10);
    const address = req.query.address || "";
    console.log("Received total:", total);
    const netCharge = await calculateFedExShipping(address);
    console.log("Extracted totalNetCharge:", netCharge);
    const shipping = netCharge || 0;
    const finalAmount = total - 7400 + Math.round(shipping * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount,
      currency: "usd",
    });
    console.log("Returning client secret:", paymentIntent.client_secret);
    return res.status(201).send({
      clientSecret: paymentIntent.client_secret,
      shippingCost: shipping,
      totalNetCharge: netCharge,
    });
  } catch (e) {
    console.error("Error in payments/create:", e);
    next(e);
  }
});

/**
 * Express error-handling middleware.
 *
 * @param {Error} err Error object.
 * @param {Object} req Express request object.
 * @param {Object} res Express response object.
 * @param {Function} next Next function to call.
 */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).send({error: err.message});
});

/**
 * Exports the Express app as a Firebase Function.
 */
exports.api = onRequest(app);
