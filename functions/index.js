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
 * Extract a two-letter country code from the full address.
 * Currently supports US, CA, MX, AU, and GB.
 *
 * @param {string} address Full address string.
 * @return {string} Two-letter country code.
 */
function getCountryCode(address) {
  const lowerAddress = address.toLowerCase();
  if (lowerAddress.includes("united states") || lowerAddress.includes("usa")) {
    return "US";
  }
  if (lowerAddress.includes("canada") || lowerAddress.includes("bc")) {
    return "CA";
  }
  if (lowerAddress.includes("mexico")) {
    return "MX";
  }
  if (lowerAddress.includes("australia")) {
    return "AU";
  }
  if (lowerAddress.includes("united kingdom") || lowerAddress.includes("uk")) {
    return "GB";
  }
  // Add additional mappings as needed.
  // Default to US if no match is found.
  return "US";
}

/**
 * Calculate shipping costs using the FedEx Rates and Transit Times API.
 * Supports both domestic and international shipments.
 *
 * @param {string} destAddr Full recipient address.
 * @return {Promise<number>} The total net charge (shipping cost).
 */
async function calculateFedExShipping(destAddr) {
  try {
    // Step 1: Obtain the OAuth token.
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

    // Extract postal code using a regex (matches 5-digit or ZIP+4)
    const zipRegex = /\b\d{5}(?:-\d{4})?\b/;
    const zipMatch = destAddr.match(zipRegex);
    const recipientPostalCode = zipMatch ? zipMatch[0] : "30033";
    console.log("DEBUG: Extracted recipient ZIP code:", recipientPostalCode);

    // Extract country code from the full address.
    const recipientCountryCode = getCountryCode(destAddr);
    console.log("DEBUG: Recipient country code:", recipientCountryCode);

    // Determine the service type and set up the payload.
    // For domestic shipments, use FEDEX_GROUND.
    // For international shipments, use INTERNATIONAL_ECONOMY.
    let serviceType = "FEDEX_GROUND";
    const requestBody = {
      accountNumber: {value: "204492269"},
      requestedShipment: {
        shipDateStamp: new Date().toISOString().split("T")[0],
        shipper: {
          address: {postalCode: "30033", countryCode: "US"},
        },
        recipient: {
          address: {
            postalCode: recipientPostalCode,
            countryCode: recipientCountryCode,
          },
        },
        pickupType: "DROPOFF_AT_FEDEX_LOCATION",
        rateRequestType: ["ACCOUNT", "LIST"],
        requestedPackageLineItems: [
          {weight: {units: "LB", value: "1"}},
        ],
      },
    };

    // Adjust the payload for international shipments.
    if (recipientCountryCode !== "US") {
      serviceType = "INTERNATIONAL_ECONOMY";
      requestBody.requestedShipment.customsClearanceDetail = {
        // Minimal required customs details.
        commodities: [
          {
            numberOfPieces: 1,
            description: "Merchandise",
            countryOfManufacture: "US", // Adjust as needed.
            weight: {units: "LB", value: "1"},
            customsValue: {currency: "USD", amount: "100"},
          },
        ],
        purpose: "SOLD",
      };
    }
    requestBody.requestedShipment.serviceType = serviceType;

    console.log("DEBUG: Payload:", JSON.stringify(requestBody, null, 2));

    // Step 3: Send the rate request.
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

    // Parse the response and extract the first "total net charge" value.
    let netCharge = 0;
    if (rateData.output && Array.isArray(rateData.output.rateReplyDetails)) {
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
 * @param {Function} next Next function.
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
 * Route to get shipping cost.
 */
app.get("/shipping/cost", checkAuth, async (req, res, next) => {
  try {
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
 */
app.post("/payments/create", checkAuth, async (req, res, next) => {
  try {
    const total = parseInt(req.query.total || "0", 10);
    const address = req.query.address || "";
    console.log("Received total:", total);
    const netCharge = await calculateFedExShipping(address);
    console.log("Extracted totalNetCharge:", netCharge);
    const shipping = netCharge || 0;
    // Adjust your calculation logic as needed.
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
 */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).send({error: err.message});
});

/**
 * Export the Express app as a Firebase Function.
 */
exports.api = onRequest(app);
