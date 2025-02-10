/**
 * Express + FedEx shipping + Stripe Payment backend
 * with enhanced error handling.
 */

const {onRequest} = require("firebase-functions/v2/https");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const stripeLib = require("stripe");

// Initialize Firebase Admin
admin.initializeApp();

const app = express();
app.use(cors({origin: true}));
app.use(express.json());

// FedEx API credentials and URLs
const FEDEX_API_KEY = "l741c6216d04a14ba29e8a3dd2c7b2b52d";
const FEDEX_SECRET_KEY = "9978785af08c4d66b1d2022118e851f9";
const FEDEX_TOKEN_URL = "https://apis.fedex.com/oauth/token";
// IMPORTANT: Use the /quotes endpoint per documentation.
const FEDEX_RATE_URL = "https://apis.fedex.com/rate/v1/rates/quotes";

// Combine your Stripe live key parts
const key1 = "sk_live_51QoH15Lx9xG3paMnc5QaFie6gmWwLjyGsnERu6UMUytuHd";
const key2 = "IrpoTLCDOGnNCroEjnwHuNLFYWc8BRyuN2NpKoZK7W00M2JgOxxd";
const stripe = stripeLib(key1 + key2);

/**
 * Calculates shipping using the FedEx API.
 * @param {string} destAddr The recipient's street address.
 * @return {Promise<number>} The shipping cost as a float (0 if error).
 */
async function calculateFedExShipping(destAddr) {
  try {
    // 1) Obtain OAuth token by sending credentials in the request body.
    const tokenRes = await fetch(FEDEX_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
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
          `Failed to fetch token (status ${tokenRes.status}): ${JSON.stringify(
              errorResponse,
          )}`,
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

    // 2) Build the rate request payload.
    // Note: For testing we use a known valid recipient address.
    const requestBody = {
      accountNumber: {value: "204492269"},
      rateRequestControlParameters: {
        returnTransitTimes: false,
        servicesNeededOnRateFailure: true,
        rateSortOrder: "SERVICENAMETRADITIONAL",
      },
      requestedShipment: {
        shipDateStamp: "2025-02-11", // Must be current or near-future.
        pickupType: "DROPOFF_AT_FEDEX_LOCATION",
        serviceType: "FEDEX_GROUND", // Verify this service type for your needs.
        preferredCurrency: "USD",
        packagingType: "YOUR_PACKAGING",
        totalPackageCount: 1,
        totalWeight: {units: "LB", value: 5},
        shipper: {
          address: {
            streetLines: ["123 Shipper St"],
            city: "Atlanta",
            stateOrProvinceCode: "GA",
            postalCode: "30322",
            countryCode: "US",
          },
        },
        recipient: {
          address: {
            streetLines: [destAddr], // Provided by query param.
            // For testing, use a known valid recipient address:
            city: "Atlanta",
            stateOrProvinceCode: "GA",
            postalCode: "30322",
            countryCode: "US",
          },
        },
        requestedPackageLineItems: [
          {
            weight: {units: "LB", value: 5},
            dimensions: {length: 12, width: 8, height: 6, units: "IN"},
          },
        ],
      },
      carrierCodes: ["FDXG"],
      rateRequestTypes: ["ACCOUNT", "LIST"],
    };

    // 3) Request shipping rates from FedEx.
    const rateRes = await fetch(FEDEX_RATE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "x-locale": "en_US", // Optional locale header.
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
          `Failed to fetch rates (status ${rateRes.status}): ${JSON.stringify(
              errorRate,
          )}`,
      );
    }

    let rateData;
    try {
      rateData = JSON.parse(rateText);
    } catch (err) {
      console.error("DEBUG: Error parsing rate JSON:", err);
      throw new Error("FedEx rate returned invalid JSON");
    }

    // 4) Extract the shipping cost from the FedEx response.
    const details =
      rateData.output &&
      rateData.output.rateReplyDetails &&
      rateData.output.rateReplyDetails[0] &&
      rateData.output.rateReplyDetails[0].ratedShipmentDetails &&
      rateData.output.rateReplyDetails[0].ratedShipmentDetails[0];

    const cost =
      details &&
      details.totalNetCharge &&
      details.totalNetCharge.amount;

    console.log("DEBUG: Extracted shipping cost:", cost);

    // Return cost as a float (or 0 if undefined)
    return parseFloat(cost || 0);
  } catch (err) {
    console.error("FedEx error:", err);
    // Optionally, rethrow the error to bubble it up.
    return 0;
  }
}

/**
 * Middleware to verify the Firebase Auth token.
 * @param {Object} req The request object.
 * @param {Object} res The response object.
 * @param {Function} next The next function to call.
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
 */
app.get("/", (req, res) => res.send("Hello world!"));

/**
 * Calculates and returns shipping cost via FedEx.
 */
app.get("/shipping/cost", checkAuth, async (req, res, next) => {
  try {
    const address = req.query.address || "";
    if (!address) {
      return res.status(400).send({error: "Address is required"});
    }
    const shippingCost = await calculateFedExShipping(address);
    return res.status(200).send({shippingCost});
  } catch (error) {
    console.error("Error calculating shipping:", error);
    next(error);
  }
});

/**
 * Creates a Stripe PaymentIntent, factoring in FedEx shipping cost.
 */
app.post("/payments/create", checkAuth, async (req, res, next) => {
  try {
    const total = parseInt(req.query.total || "0", 10);
    const address = req.query.address || "";
    console.log("Received total:", total);

    const shipping = await calculateFedExShipping(address);
    console.log("Shipping cost:", shipping);

    // Example: subtract 7400 from total, then add shipping cost (in cents)
    const finalAmount = total - 7400 + Math.round(shipping * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount,
      currency: "usd",
    });
    console.log("Returning client secret:", paymentIntent.client_secret);

    return res.status(201).send({
      clientSecret: paymentIntent.client_secret,
      shippingCost: shipping,
    });
  } catch (e) {
    console.error("Error in payments/create:", e);
    next(e);
  }
});

// Express error-handling middleware.
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).send({error: err.message});
});

/**
 * Exports the Express app as a Firebase Function.
 */
exports.api = onRequest(app);
