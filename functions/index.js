const {onRequest} = require("firebase-functions/v2/https");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const stripeLib = require("stripe");
const fetch = require("node-fetch");
const nodemailer = require("nodemailer");

admin.initializeApp();

const app = express();
app.use(cors({origin: true}));
app.use(express.json());

const FEDEX_API_KEY =
  "l741c6216d04a14ba29e8a3dd2c7b2b52d";
const FEDEX_SECRET_KEY =
  "9978785af08c4d66b1d2022118e851f9";
const FEDEX_TOKEN_URL =
  "https://apis.fedex.com/oauth/token";
const FEDEX_RATE_URL =
  "https://apis.fedex.com/rate/v1/rates/quotes";

const key1 =
  "sk_live_51QoH15Lx9xG3paMnc5QaFie6gmWwLjyGsnERu6UMUytuHd";
const key2 =
  "IrpoTLCDOGnNCroEjnwHuNLFYWc8BRyuN2NpKoZK7W00M2JgOxxd";
const stripe = stripeLib(key1 + key2);

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "jessiecoleman928@gmail.com",
    pass: "wjuw vkqd xcgh nqsw",
  },
});

/**
 * Extracts a two-letter country code from the address.
 *
 * @param {string} address Full address string.
 * @return {string} Two-letter country code.
 */
function getCountryCode(address) {
  const lower = address.toLowerCase();
  if (lower.includes("united states") ||
      lower.includes("usa")) {
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
  if (lower.includes("united kingdom") ||
      lower.includes("uk")) {
    return "GB";
  }
  return "US";
}

/**
 * Calculates shipping cost via FedEx Rates API.
 *
 * @param {string} destAddr Full recipient address.
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
    console.log("DEBUG: Token status:", tokenRes.status);
    console.log("DEBUG: Token text:", tokenText);
    if (!tokenRes.ok) {
      let errResp;
      try {
        errResp = await tokenRes.json();
      } catch (e) {
        errResp = tokenText || "No error msg";
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
    console.log("DEBUG: Extracted ZIP:", rPostal);
    const rCountry = getCountryCode(destAddr);
    console.log("DEBUG: Recipient country:", rCountry);
    let serviceType = "FEDEX_GROUND";
    const reqBody = {
      accountNumber: {value: "204492269"},
      requestedShipment: {
        shipDateStamp: new Date().toISOString().split("T")[0],
        shipper: {
          address: {postalCode: "30033", countryCode: "US"},
        },
        recipient: {
          address: {
            postalCode: rPostal,
            countryCode: rCountry,
          },
        },
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
    console.log("DEBUG: Payload:", JSON.stringify(reqBody, null, 2));
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
    console.log("DEBUG: Rate status:", rateRes.status);
    console.log("DEBUG: Rate text:", rateText);
    if (!rateRes.ok) {
      let errRate;
      try {
        errRate = await rateRes.json();
      } catch (e) {
        errRate = rateText || "No error msg";
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
    if (rateData.output &&
        Array.isArray(rateData.output.rateReplyDetails)) {
      for (const detail of rateData.output.rateReplyDetails) {
        if (detail.ratedShipmentDetails &&
            Array.isArray(detail.ratedShipmentDetails)) {
          for (const shipment of detail.ratedShipmentDetails) {
            if (shipment.totalNetCharge !== undefined) {
              if (typeof shipment.totalNetCharge === "object" &&
                  shipment.totalNetCharge.amount !== undefined) {
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
    return 20;
  }
}

/**
 * Middleware to verify Firebase Auth token and attach user.
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
 * Route to get shipping cost.
 */
app.get("/shipping/cost", checkAuth, async (req, res, next) => {
  try {
    const addr = req.query.address || "";
    if (!addr) {
      return res.status(400).send({error: "Address is required"});
    }
    const netCharge = await calculateFedExShipping(addr);
    return res.status(200).send({totalNetCharge: netCharge});
  } catch (error) {
    console.error("Error calculating shipping:", error);
    next(error);
  }
});

/**
 * Route to create PaymentIntent with shipping and tax.
 * Shipping is excluded from taxed base.
 * Does NOT send email.
 */
app.post("/payments/create", checkAuth, async (req, res, next) => {
  try {
    const total = parseInt(req.query.total || "0", 10);
    const addr = req.query.address || "";
    console.log("Received total:", total);
    const netCharge = await calculateFedExShipping(addr);
    console.log("Extracted totalNetCharge:", netCharge);
    const shippingCents = Math.round(netCharge * 100);
    // Base amount is the basket total (in cents)
    const baseAmount = total;
    const parts = addr.split(",").map((s) => s.trim());
    const customerAddress = {
      line1: parts[0] || "unknown",
      city: parts[1] || "unknown",
      state: parts[2] || "unknown",
      postal_code: parts[3] || "30033",
      country: parts[4] || getCountryCode(addr),
    };
    let taxCalc;
    try {
      taxCalc = await stripe.tax.calculations.create({
        currency: "usd",
        line_items: [{amount: baseAmount, reference: "L1"}],
        customer_details: {
          address: customerAddress,
          address_source: "shipping",
        },
      });
      if (!taxCalc.tax_amount_exclusive ||
          taxCalc.tax_amount_exclusive === 0) {
        throw new Error("No tax generated");
      }
    } catch (taxErr) {
      console.error("Error during tax calc:", taxErr);
      const fbTax = Math.round(baseAmount * 0.10);
      taxCalc = {
        id: "fallback",
        amount_total: baseAmount + fbTax,
        tax_amount_exclusive: fbTax,
      };
    }
    const finalAmount = taxCalc.amount_total + shippingCents;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount,
      currency: "usd",
      shipping: {
        name: "Customer",
        address: customerAddress,
      },
      metadata: {tax_calculation_id: taxCalc.id},
    });
    console.log("Returning client secret:",
        paymentIntent.client_secret);
    return res.status(201).send({
      clientSecret: paymentIntent.client_secret,
      shippingCost: shippingCents,
      totalNetCharge: netCharge,
      baseAmount: baseAmount,
      taxCalculation: taxCalc,
    });
  } catch (e) {
    console.error("Error in payments/create:", e);
    next(e);
  }
});

/**
 * New endpoint to send order email.
 * This is called only when "Buy Now" is pressed.
 */
app.post("/payments/notify", checkAuth, async (req, res, next) => {
  try {
    // Use basket from req.body (default empty array)
    const basketItems = req.body.basket || [];
    if (basketItems.length === 0) {
      return res.status(400).send({error: "Basket is empty"});
    }
    const addr = req.query.address || "";
    const orderDetails = `
      <p>User: ${req.user ? req.user.email : "Unknown"}</p>
      <p>Location: ${addr}</p>
      <p>Ordered Items:</p>
      <ul>
        ${
  basketItems
      .map((item) =>
        `<li>${item.title} - $${item.price}<br/>
              <img src="${item.image}" width="100"/></li>`)
      .join("")
}
      </ul>
    `;
    const mailOpts = {
      from: "jessiecoleman928@gmail.com",
      to: [
        req.user && req.user.email ?
          req.user.email :
          "unknown@example.com",
        "xsacredstudiosx@gmail.com",
      ].join(", "),
      subject: `New Order from ${
        req.user ? req.user.email : "Unknown"
      }`,
      html: orderDetails,
    };
    await transporter.sendMail(mailOpts);
    return res.status(200).send({message: "Email sent"});
  } catch (e) {
    console.error("Error in payments/notify:", e);
    next(e);
  }
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).send({error: err.message});
});

exports.api = onRequest(app);
