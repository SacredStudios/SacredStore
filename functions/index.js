/* eslint max-len: ["error", { "code": 80 }] */
/* eslint valid-jsdoc: ["error", { "requireParamDescription": false }] */

const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const stripeLib = require("stripe");
const fetch = require("node-fetch");
const nodemailer = require("nodemailer");

admin.initializeApp();

const app = express();

/**
 * Global middleware to catch all OPTIONS requests
 * and set required CORS headers.
 */
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS",
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
    );
    return res.status(200).send();
  }
  next();
});

// Allow all origins via cors
app.use(cors({origin: "*"}));
app.use(express.json());

// Retrieve sensitive credentials from functions.config()
const configData = functions.config();
const FEDEX_API_KEY = configData.fedex.api_key;
const FEDEX_SECRET_KEY = configData.fedex.secret_key;
const FEDEX_TOKEN_URL = "https://apis.fedex.com/oauth/token";
const FEDEX_RATE_URL = "https://apis.fedex.com/rate/v1/rates/quotes";

const stripeKey1 = configData.stripe.key1;
const stripeKey2 = configData.stripe.key2;
const stripe = stripeLib(stripeKey1 + stripeKey2);

const EMAIL_USER = configData.email.user;
const EMAIL_PASS = configData.email.pass;
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {user: EMAIL_USER, pass: EMAIL_PASS},
});

/**
 * Extracts a two-letter country code from the address.
 *
 * @param {string} address - Full address string.
 * @return {string} Two-letter country code.
 */
function getCountryCode(address) {
  const lower = address.toLowerCase();
  if (lower.includes("united states") || lower.includes("usa")) {
    return "US";
  }
  if (lower.includes("canada") || lower.includes("bc")) {
    return "CA";
  }
  if (lower.includes("mexico")) {
    return "MX";
  }
  if (lower.includes("australia")) {
    return "AU";
  }
  if (lower.includes("united kingdom") || lower.includes("uk")) {
    return "GB";
  }
  return "US"; // fallback
}

/**
 * Calculates shipping cost via FedEx Rates API.
 *
 * @param {string} destAddr - Full recipient address.
 * @return {Promise<number>} Shipping cost in dollars.
 */
async function calculateFedExShipping(destAddr) {
  try {
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

    if (!tokenRes.ok) {
      let errResp;
      try {
        errResp = await tokenRes.json();
      } catch (e) {
        errResp = tokenText || "No error message";
      }
      console.error("FedEx token error:", errResp);
      throw new Error(
          `Failed to fetch token (status ${tokenRes.status}): ` +
        JSON.stringify(errResp),
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

    const zipRegex = /\b\d{5}(?:-\d{4})?\b/;
    const zipMatch = destAddr.match(zipRegex);
    const rPostal = zipMatch ? zipMatch[0] : "30033";
    const rCountry = getCountryCode(destAddr);

    let serviceType = "FEDEX_GROUND";
    const reqBody = {
      accountNumber: {value: "204492269"},
      requestedShipment: {
        shipDateStamp: new Date().toISOString().split("T")[0],
        shipper: {address: {postalCode: "30033", countryCode: "US"}},
        recipient: {address: {postalCode: rPostal, countryCode: rCountry}},
        pickupType: "DROPOFF_AT_FEDEX_LOCATION",
        rateRequestType: ["ACCOUNT", "LIST"],
        requestedPackageLineItems: [
          {weight: {units: "LB", value: "1"}},
        ],
      },
    };

    if (rCountry !== "US") {
      serviceType = "INTERNATIONAL_ECONOMY";
      reqBody.requestedShipment.customsClearanceDetail = {
        commodities: [
          {
            numberOfPieces: 1,
            description: "Merchandise",
            countryOfManufacture: "US",
            weight: {units: "LB", value: "1"},
            customsValue: {currency: "USD", amount: "100"},
          },
        ],
        purpose: "SOLD",
      };
    }
    reqBody.requestedShipment.serviceType = serviceType;

    const rateRes = await fetch(FEDEX_RATE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "x-locale": "en_US",
      },
      body: JSON.stringify(reqBody),
    });
    const rateText = await rateRes.text();

    if (!rateRes.ok) {
      let errRate;
      try {
        errRate = await rateRes.json();
      } catch (e) {
        errRate = rateText || "No error message";
      }
      console.error("FedEx rate error:", errRate);
      throw new Error(
          `Failed to fetch rates (status ${rateRes.status}): ` +
        JSON.stringify(errRate),
      );
    }

    let rateData;
    try {
      rateData = JSON.parse(rateText);
    } catch (err) {
      console.error("DEBUG: Error parsing rate JSON:", err);
      throw new Error("FedEx rate returned invalid JSON");
    }

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
    // Fallback shipping cost
    return 20;
  }
}

/**
 * Middleware to verify Firebase Auth token and attach user.
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 * @returns {Object} The response if unauthorized; otherwise next()
 */
async function checkAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).send({error: "No token provided"});
  }
  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded;
    return next();
  } catch (e) {
    console.error("Token error:", e);
    return res.status(403).send({error: "Unauthorized"});
  }
}

app.get("/", (req, res) => res.send("Hello world!"));

/**
 * Create payment without taxes, just shipping + base total.
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 * @returns {Promise<Object>} JSON response with PaymentIntent info
 */
app.post("/payments/create", checkAuth, async (req, res, next) => {
  try {
    // 'total' is basket subtotal in cents
    const total = parseInt(req.query.total || "0", 10);
    const addr = req.query.address || "";

    const netCharge = await calculateFedExShipping(addr);
    const shippingCents = Math.round(netCharge * 100);
    const finalAmount = total + shippingCents;

    // Minimal address parsing for shipping details
    const parts = addr.split(",").map((s) => s.trim());
    const customerAddress = {
      line1: parts[0] || "unknown",
      city: parts[1] || "unknown",
      state: parts[2] || "unknown",
      postal_code: parts[3] || "30033",
      country: parts[4] || getCountryCode(addr),
    };

    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount,
      currency: "usd",
      shipping: {
        name: "Customer",
        address: customerAddress,
      },
    });

    return res.status(201).send({
      clientSecret: paymentIntent.client_secret,
      shippingCost: shippingCents, // shipping in cents
      totalNetCharge: netCharge, // shipping in dollars
      baseAmount: total, // basket total in cents
    });
  } catch (e) {
    console.error("Error in payments/create:", e);
    next(e);
  }
});

/**
 * Endpoint to send order email. Called when "Buy Now" is pressed.
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 * @returns {Promise<Object>} Express response with success message
 */
app.post("/payments/notify", checkAuth, async (req, res, next) => {
  try {
    const basketItems = req.body.basket || [];
    if (basketItems.length === 0) {
      return res.status(400).send({error: "Basket is empty"});
    }

    const addr = req.query.address || "";
    const phone = req.query.phone || "";
    const orderDetails = `
      <p>User: ${req.user ? req.user.email : "Unknown"}</p>
      <p>Location: ${addr}</p>
      ${
        phone ?
          `<p>Phone: ${phone}</p>` :
          ""
}
      <p>Ordered Items:</p>
      <ul>
        ${basketItems
      .map((item) => `
            <li>${item.title} - $${item.price}<br/>
              <img src="${item.image}" width="100"/>
            </li>`)
      .join("")}
      </ul>
    `;

    const mailOpts = {
      from: EMAIL_USER,
      to: [
        req.user && req.user.email ? req.user.email : "unknown@example.com",
        "xsacredstudiosx@gmail.com",
      ].join(", "),
      subject: `New Order from ${req.user ? req.user.email : "Unknown"}`,
      html: orderDetails,
    };

    await transporter.sendMail(mailOpts);
    return res.status(200).send({message: "Email sent"});
  } catch (e) {
    console.error("Error in payments/notify:", e);
    next(e);
  }
});
app.get("/shipping/cost", checkAuth, async (req, res, next) => {
  try {
    const addr = req.query.address || "";
    if (!addr.trim()) {
      return res.status(400).send({error: "Address is required"});
    }
    const netCharge = await calculateFedExShipping(addr);
    return res.status(200).send({totalNetCharge: netCharge});
  } catch (error) {
    console.error("Error calculating shipping:", error);
    next(error);
  }
});
// Express error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.set("Access-Control-Allow-Origin", "*");
  res.status(500).send({error: err.message});
});

exports.api = functions.https.onRequest(app);
