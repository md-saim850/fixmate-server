import express from "express";
import { MongoClient } from 'mongodb';
import "dotenv/config";
import cors from "cors";

import serviceRoutes from "./routes/services.js";
import bookingsRoutes from "./routes/booking.js";
import technicianRoutes from "./routes/technician.js";
import customerRoutes from "./routes/customer.js";
import adminRoutes from "./routes/admin.js";


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://your-frontend.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

const PORT = process.env.PORT || 5000;

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;

  } catch (err) {
    console.dir(err);

  }
}

// API routes
app.use("/api/services", serviceRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/technician", technicianRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/admin", adminRoutes);



app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});