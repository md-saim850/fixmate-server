import { createRemoteJWKSet, jwtVerify } from "jose";
import { MongoClient } from "mongodb";
import 'dotenv/config'
import { ObjectId } from "mongodb";

// Better Auth configuration
const AUTH_URL = process.env.BETTER_AUTH_URL;

// Get public keys from Better Auth
const JWKS = createRemoteJWKSet(
  new URL(`${AUTH_URL}/api/auth/jwks`)
);

// Verify user token
async function verifyToken(req, res, next) {
  try {
    // 1. Get token from request header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Please login first",
      });
    }

    const token = authHeader.split(" ")[1]

    // 2. Verify JWT signature and claims
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: AUTH_URL,
      audience: AUTH_URL,
      algorithms: ["EdDSA"],
    });

    // 3. Get user ID from token
    const userId = payload.sub;

    if (!userId) {
      return res.status(401).json({
        message: "Invalid user token",
      });
    }

    // 4. Find user in MongoDB
    const client = new MongoClient(process.env.MONGODB_URI);
    const db = client.db(process.env.DB_NAME);
      
    const user = await db.collection("user").findOne({
      _id: new ObjectId(userId),
    })

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    // 5. Attach user information to request
    const {...userData } = user;

    req.user = {  
      id: String(user._id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      area: user.area,
      bio: user.bio,
      avatar: user.avatar,
    };
    // 6. Continue to the API route
    next();

  } catch (error) {
    console.error("Token verification failed:", error.message);

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

// Check user role
function allowRole(requiredRole) {
  return (req, res, next) => {
    if (req.user?.role !== requiredRole) {
      return res.status(403).json({
        message: "You don't have permission",
      });
    }

    next();
  };
}

// Export middleware
export { verifyToken, allowRole };

export const verifyCustomer = allowRole("customer");
export const verifyTechnician = allowRole("technician");
export const verifyAdmin = allowRole("admin");