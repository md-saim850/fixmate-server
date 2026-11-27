import express from "express";
import Stripe from "stripe";
import { MongoClient, ObjectId } from "mongodb";
import { verifyCustomer, verifyToken } from "../middleware/auth.js";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db(process.env.DB_NAME);

router.post("/webhook",express.raw({ type: "application/json" }),async (req, res) => {
    const signature = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      console.error("Webhook error:", error.message);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
      if (
        event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded"
      ) {
        const session = event.data.object;

        if (session.payment_status !== "paid") {
          return res.status(200).json({ received: true });
        }

        const { bookingId, userId } = session.metadata || {};

        if (
          !ObjectId.isValid(bookingId) ||
          !ObjectId.isValid(userId)
        ) {
          return res.status(400).json({
            message: "Invalid booking or user ID",
          });
        }

        const paymentsCollection = db.collection("payments");
        const bookingsCollection = db.collection("bookings");

        // Save payment (avoid duplicate records)
        await paymentsCollection.updateOne(
          { stripeSessionId: session.id },
          {
            $set: {
              bookingId: new ObjectId(bookingId),
              userId: new ObjectId(userId),
              stripeSessionId: session.id,
              stripePaymentIntentId: session.payment_intent,
              amount: session.amount_total / 100,
              currency: session.currency,
              status: "paid",
              customerEmail: session.customer_details?.email,
              customerName: session.customer_details?.name,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
            },
          },
          { upsert: true }
        );

        // Update booking
        const bookingResult = await bookingsCollection.updateOne(
          {
            _id: new ObjectId(bookingId),
            userId: new ObjectId(userId),
          },
          {
            $set: {
              paymentStatus: "paid",
              paidAt: new Date(),
            },
          }
        );

        if (bookingResult.matchedCount === 0) {
          console.error("Booking not found:", bookingId);
        }
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("Payment processing error:", error);

      return res.status(500).json({
        message: "Payment processing failed",
      });
    }
  }
);

router.get("/verify-session", async (req, res) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Payment session not found",
      });
    }

    const paid = session.payment_status === "paid";

    // Only report paid when Stripe confirms payment.
    if (!paid) {
      return res.status(200).json({
        success: true,
        paid: false,
        paymentStatus: session.payment_status,
      });
    }

    const { bookingId, userId } = session.metadata || {};

    if (!bookingId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Booking information missing",
      });
    }

    const booking = await db.collection("bookings").findOne({
      _id: new ObjectId(bookingId),
      "customer.id": userId,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const service = await db.collection("services").findOne({
      _id: new ObjectId(booking.serviceId),
    });

    await db.collection("payments").updateOne(
      {
        stripeSessionId: session.id,
      },
      {
        $set: {
          // Payment information
          bookingId: booking._id,
          userId: new ObjectId(userId),

          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent,

          amount: session.amount_total / 100,
          currency: session.currency,
          status: "paid",

          customerEmail: session.customer_details?.email,
          customerName: session.customer_details?.name,

          // Booking information
          booking: {
            id: booking._id,
            serviceId: booking.serviceId,
            serviceTitle: booking.serviceTitle,
            serviceImage: booking.serviceImage,
            category: booking.category,
            basePrice: booking.basePrice,
            finalAmount: booking.finalAmount,
            serviceDate: booking.serviceDate,
            address: booking.address,
            problemDescription: booking.problemDescription,
            status: booking.status,
            paymentStatus: "paid",
            paidAt: new Date(),
          },

          service:{
            _id:service.id,
            title:service.title,
          },

          // Customer information
          customer: booking.customer,

          // Technician information
          technician: booking.technician,

          updatedAt: new Date(),
        },

        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
      }
    );

    // 3. Update booking payment status
    await db.collection("bookings").updateOne(
      {
        _id: new ObjectId(bookingId),
        "customer.id": userId,
      },
      {
        $set: {
          paymentStatus: "paid",
          paidAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      paid: true,
      sessionId: session.id,
      amount: session.amount_total / 100,
      currency: session.currency,
      customerEmail: session.customer_details?.email,
      customerName: session.customer_details?.name,
      paymentStatus: session.payment_status,
    });

  } catch (error) {
    console.error("Verify payment error:", error);

    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
    });
  }
});

router.get("/customer", verifyToken, verifyCustomer, async (req, res) => {
  try {
    const userId = req.user.id;

    const payments = await db
      .collection("payments")
      .find({
        userId: new ObjectId(userId),
      })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      totalPayments: payments.length,
      payments,
    });
  } catch (error) {
    console.error("Get customer payments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment history",
    });
  }
});

export default router;