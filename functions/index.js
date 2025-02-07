const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(functions.config().stripe.secret_key);

// App config
const app = express();

// Middlewares
app.use(cors({ origin: true }));
app.use(express.json());

// API routes
app.get("/", (req, res) => {
  res.status(200).send("Hello world!");
});

app.post('/payments/create', async (request, response) => {
    try {
      const total = request.query.total;
      console.log("Received total:", total);
  
      const paymentIntent = await stripe.paymentIntents.create({
        amount: total,
        currency: "usd",
      });
  
      // Log the entire paymentIntent
      //console.log("PaymentIntent object:", paymentIntent);
  
      //console.log("Sending back:", paymentIntent.client_secret);
      response.status(201).send({
        clientSecret: paymentIntent.client_secret, // underscores are required from Stripe
      });
    } catch (error) {
      console.error("Error creating PaymentIntent:", error);
      response.status(500).send({ error: error.message });
    }
  });
  
// Exports (v2 style)
exports.api = onRequest(app);
