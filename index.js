
import express from "express";
import { MongoClient } from "mongodb";
import "dotenv/config";
import cors from "cors";

import serviceRoutes from "./routes/services.js";
import bookingsRoutes from "./routes/booking.js";
import technicianRoutes from "./routes/technician.js";
import customerRoutes from "./routes/customer.js";
import adminRoutes from "./routes/admin.js";
import usersRoutes from "./routes/users.js";
import paymentRoutes from "./routes/paymentRoutes.js";

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

let connectionPromise;

export async function connectToMongoDB() {
  try {
    if (!connectionPromise) {
      connectionPromise = client.connect().catch((error) => {
        connectionPromise = null;
        throw error;
      });
    }

    await connectionPromise;
    return client;
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    throw error;
  }
}

app.get("/", (req, res) => {
  res.send("FixMate API is running!");
});

app.use("/api/payments", paymentRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/technician", technicianRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", usersRoutes);

export default app;

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
