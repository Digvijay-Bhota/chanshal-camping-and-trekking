import express, { Request, Response } from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import rateLimit from "express-rate-limit"
import { pool } from "./db"
import Razorpay from "razorpay"
import {
  findAllProperties,
  findPropertyById,
  findAllPropertiesForAdmin,
  createProperty,
  updateProperty,
  UpdatePropertyInput,
  setPropertyActive,
} from "./modules/properties/property.repository"
import crypto from "crypto"
import {
  createPaymentRecord,
  findPaymentByOrderId,
  capturePaymentAndConfirmBooking,
  markPaymentFailed,
} from "./modules/payments/payment.repository"
import {
  findUserById,
  findUserByEmail,
  findUserByPhone,
  createUser,
  updateUserPhone,
} from "./modules/users/user.repository"
import { hashPassword, verifyPassword } from "./modules/users/password.util"
import { signAuthToken } from "./modules/auth/auth.util"
import {
  requireAuth,
  requireAdmin,
  AuthenticatedRequest,
} from "./modules/auth/auth.middleware"
import {
  Booking,
  createBooking,
  findAllBookings,
  findBookingById,
  findBookingsByUserId,
  deleteBookingForUser,
  cancelBookingForUser,
  findOverlappingBooking,
  findRecentDuplicateBooking,
  createBookingTransaction,
  findAllBookingsWithDetails,
  updateBookingStatus,
} from "./modules/bookings/booking.repository"

const app = express()

// Comment
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
)

// ⚡ RAZORPAY WEBHOOK ROUTE (RAW BODY PARSER FOR SIGNATURE VERIFICATION)
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const signature = req.headers["x-razorpay-signature"]
    if (!signature || typeof signature !== "string" || signature.trim() === "") {
      return res.status(400).json({ message: "Missing webhook signature" })
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!webhookSecret || !webhookSecret.trim()) {
      console.error("RAZORPAY_WEBHOOK_SECRET is not configured")
      return res.status(500).json({ message: "Webhook configuration error" })
    }

    const rawBody = req.body
    if (!Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ message: "Invalid raw request body" })
    }

    // 1. Signature Verification using HMAC-SHA256 & timing-safe comparison
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret.trim())
      .update(rawBody)
      .digest("hex")

    const sigBuffer = Buffer.from(signature.trim())
    const expBuffer = Buffer.from(expectedSignature)

    const isValid =
      sigBuffer.length === expBuffer.length &&
      crypto.timingSafeEqual(sigBuffer, expBuffer)

    if (!isValid) {
      return res.status(400).json({ message: "Invalid webhook signature" })
    }

    // 2. Parse JSON Payload
    let eventData: { event?: string; payload?: Record<string, any> }
    try {
      eventData = JSON.parse(rawBody.toString("utf-8"))
    } catch {
      return res.status(400).json({ message: "Malformed JSON payload" })
    }

    const { event, payload } = eventData
    if (!event || !payload) {
      return res.status(400).json({ message: "Invalid event payload structure" })
    }

    try {
      if (event === "payment.captured") {
        const paymentEntity = payload.payment?.entity
        if (!paymentEntity) {
          return res.status(400).json({ message: "Missing payment entity in payload" })
        }

        const razorpayPaymentId = String(paymentEntity.id || "")
        const razorpayOrderId = String(paymentEntity.order_id || "")
        const amount = Number(paymentEntity.amount)
        const currency = String(paymentEntity.currency || "")

        if (!razorpayOrderId) {
          return res.status(400).json({ message: "Missing order_id in payment entity" })
        }

        const paymentRecord = await findPaymentByOrderId(razorpayOrderId)
        if (!paymentRecord) {
          return res.status(404).json({ message: "Payment order not found" })
        }

        // Idempotency check
        if (paymentRecord.status === "captured") {
          return res.status(200).json({ message: "Payment already captured" })
        }

        // Verify amount & currency match stored order
        const expectedAmountInPaise = Math.round(paymentRecord.amount * 100)
        if (amount !== expectedAmountInPaise || currency !== paymentRecord.currency) {
          return res.status(400).json({ message: "Payment amount or currency mismatch" })
        }

        await capturePaymentAndConfirmBooking(
          paymentRecord.id,
          paymentRecord.bookingId,
          razorpayPaymentId,
          signature.trim(),
        )

        return res.status(200).json({ message: "Payment captured successfully" })
      }

      if (event === "payment.failed") {
        const paymentEntity = payload.payment?.entity
        if (!paymentEntity) {
          return res.status(400).json({ message: "Missing payment entity in payload" })
        }

        const razorpayOrderId = String(paymentEntity.order_id || "")
        const errorMessage =
          String(paymentEntity.error_description || paymentEntity.error_reason || "Payment failed")

        if (!razorpayOrderId) {
          return res.status(400).json({ message: "Missing order_id in payment entity" })
        }

        const paymentRecord = await findPaymentByOrderId(razorpayOrderId)
        if (!paymentRecord) {
          return res.status(404).json({ message: "Payment order not found" })
        }

        if (paymentRecord.status === "captured") {
          return res.status(200).json({ message: "Payment already captured" })
        }

        await markPaymentFailed(paymentRecord.id, errorMessage)
        return res.status(200).json({ message: "Payment failure recorded" })
      }

      if (event === "order.paid") {
        const orderEntity = payload.order?.entity
        if (!orderEntity) {
          return res.status(400).json({ message: "Missing order entity in payload" })
        }

        const razorpayOrderId = String(orderEntity.id || "")
        const amount = Number(orderEntity.amount)
        const currency = String(orderEntity.currency || "")

        if (!razorpayOrderId) {
          return res.status(400).json({ message: "Missing order_id in payload" })
        }

        const paymentRecord = await findPaymentByOrderId(razorpayOrderId)
        if (!paymentRecord) {
          return res.status(404).json({ message: "Payment order not found" })
        }

        // Idempotency check
        if (paymentRecord.status === "captured") {
          return res.status(200).json({ message: "Order already paid and captured" })
        }

        // Verify amount & currency
        const expectedAmountInPaise = Math.round(paymentRecord.amount * 100)
        if (amount !== expectedAmountInPaise || currency !== paymentRecord.currency) {
          return res.status(400).json({ message: "Payment amount or currency mismatch" })
        }

        await capturePaymentAndConfirmBooking(
          paymentRecord.id,
          paymentRecord.bookingId,
          paymentRecord.providerPaymentId || "webhook_order_paid",
          signature.trim(),
        )

        return res.status(200).json({ message: "Order paid successfully" })
      }

      // Return 200 for unknown / unhandled valid events
      return res.status(200).json({ message: "Webhook event received and ignored" })
    } catch (error) {
      logError("Failed to process Razorpay webhook", {
        route: "/api/payments/webhook",
        method: "POST",
        error,
      })
      return res.status(500).json({ message: "Webhook processing failed" })
    }
  },
)

app.use(express.json())
app.use(cookieParser())

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite:
    process.env.NODE_ENV === "production"
      ? ("none" as const)
      : ("lax" as const),
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

// 🛡️ RATE LIMITERS
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many authentication attempts. Please try again later.",
  },
})

export const paymentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many payment requests. Please try again later.",
  },
})

export const bookingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many booking requests. Please try again later.",
  },
})

// 📝 STRUCTURED LOGGING HELPER
export type LogContext = {
  route?: string
  method?: string
  userId?: number
  error?: unknown
  [key: string]: unknown
}

function sanitizeContext(context?: LogContext): Record<string, unknown> | undefined {
  if (!context) return undefined

  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase()
    if (
      lowerKey.includes("password") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("token") ||
      lowerKey.includes("cookie") ||
      lowerKey.includes("signature")
    ) {
      sanitized[key] = "[REDACTED]"
      continue
    }

    if (value instanceof Error) {
      sanitized[key] = {
        name: value.name,
        message: value.message,
        stack: value.stack,
      }
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

export function logInfo(message: string, context?: LogContext): void {
  const sanitized = sanitizeContext(context)
  if (process.env.NODE_ENV === "production") {
    console.log(
      JSON.stringify({
        level: "info",
        timestamp: new Date().toISOString(),
        message,
        ...(sanitized || {}),
      }),
    )
  } else {
    if (sanitized && Object.keys(sanitized).length > 0) {
      console.log(`ℹ️  [INFO] ${message}`, sanitized)
    } else {
      console.log(`ℹ️  [INFO] ${message}`)
    }
  }
}

export function logError(message: string, context?: LogContext): void {
  const sanitized = sanitizeContext(context)
  if (process.env.NODE_ENV === "production") {
    console.error(
      JSON.stringify({
        level: "error",
        timestamp: new Date().toISOString(),
        message,
        ...(sanitized || {}),
      }),
    )
  } else {
    if (sanitized && Object.keys(sanitized).length > 0) {
      console.error(`🚨 [ERROR] ${message}`, sanitized)
    } else {
      console.error(`🚨 [ERROR] ${message}`)
    }
  }
}

// 🌐 ROOT
app.get("/", (_: Request, res: Response) => {
  res.send("API is running 🚀")
})

// 🗄️ DATABASE HEALTH CHECK
app.get("/api/health/db", async (_: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT NOW()")

    res.json({
      status: "ok",
      database: "connected",
      time: result.rows[0].now,
    })
  } catch (error) {
    console.error("Database health check failed:", error)

    res.status(500).json({
      status: "error",
      database: "disconnected",
    })
  }
})

/* =========================
   USERS / AUTH
========================= */

// 👤 CURRENT USER
app.get(
  "/api/users/me",
  requireAuth,
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest
    const userId = authReq.userId

    if (!userId || !Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    try {
      const user = await findUserById(userId)
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      return res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email ?? null,
          phone: user.phone ?? null,
          role: user.role,
        },
      })
    } catch (error) {
      logError("Failed to fetch authenticated user", {
        route: "/api/users/me",
        method: "GET",
        userId,
        error,
      })
      return res.status(500).json({ message: "Failed to fetch user" })
    }
  },
)

// 🔑 USER REGISTER
app.post("/api/users/register", authLimiter, async (req: Request, res: Response) => {
  try {
    const { name, email, phone, password } = req.body

    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ message: "Name is required" })
    }

    if (!email || typeof email !== "string" || email.trim() === "") {
      return res.status(400).json({ message: "Email is required" })
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long" })
    }

    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPhone =
      typeof phone === "string" && phone.trim() ? phone.trim() : null

    const existingUser = await findUserByEmail(trimmedEmail)
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" })
    }

    const passwordHash = await hashPassword(password)

    const user = await createUser({
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      passwordHash,
    })

    const token = signAuthToken(user.id, user.role)
    res.cookie("auth_token", token, COOKIE_OPTIONS)

    return res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email ?? null,
        phone: user.phone ?? null,
      },
    })
  } catch (error) {
    logError("Failed to register user", {
      route: "/api/users/register",
      method: "POST",
      error,
    })
    return res.status(500).json({ message: "Failed to register user" })
  }
})

// 🔐 USER LOGIN
app.post("/api/users/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, phone, password } = req.body

    if (!password || typeof password !== "string" || password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long" })
    }

    const trimmedEmail =
      typeof email === "string" && email.trim()
        ? email.trim().toLowerCase()
        : null
    const trimmedPhone =
      typeof phone === "string" && phone.trim() ? phone.trim() : null

    if (!trimmedEmail && !trimmedPhone) {
      return res
        .status(400)
        .json({ message: "At least one of email or phone is required" })
    }

    let user = null

    if (trimmedEmail) {
      user = await findUserByEmail(trimmedEmail)
    }

    if (!user && trimmedPhone) {
      user = await findUserByPhone(trimmedPhone)
    }

    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash)
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    const token = signAuthToken(user.id, user.role)
    res.cookie("auth_token", token, COOKIE_OPTIONS)

    const responseUser = {
      id: user.id,
      name: user.name,
      email: user.email ?? null,
      phone: user.phone ?? null,
    }

    return res.status(200).json({ user: responseUser })
  } catch (error) {
    logError("Failed to login user", {
      route: "/api/users/login",
      method: "POST",
      error,
    })
    return res.status(500).json({ message: "Failed to login user" })
  }
})

// 🚪 USER LOGOUT
app.post("/api/users/logout", (_: Request, res: Response) => {
  res.clearCookie("auth_token", {
    httpOnly: true,
    sameSite:
      process.env.NODE_ENV === "production"
        ? ("none" as const)
        : ("lax" as const),
    secure: process.env.NODE_ENV === "production",
  })
  return res.status(200).json({ message: "Logged out" })
})

/* =========================
   CAMPS
========================= */

// 📦 GET ALL CAMPS
app.get("/api/camps", async (_: Request, res: Response) => {
  try {
    const properties = await findAllProperties()

    const camps = properties.map(property => ({
      id: property.id,
      name: property.name,
      price: property.pricePerNight,
      location: property.location,
      rating: property.rating,
      image: property.imageUrl,
    }))

    res.json(camps)
  } catch (error) {
    console.error("Failed to fetch camps:", error)

    res.status(500).json({
      message: "Failed to fetch camps",
    })
  }
})

// 📦 GET SINGLE CAMP
app.get("/api/camps/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id)

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      message: "Invalid camp ID",
    })
  }

  try {
    const property = await findPropertyById(id)

    if (!property) {
      return res.status(404).json({
        message: "Camp not found",
      })
    }

    const camp = {
      id: property.id,
      name: property.name,
      price: property.pricePerNight,
      location: property.location,
      rating: property.rating,
      image: property.imageUrl,
    }

    res.json(camp)
  } catch (error) {
    console.error("Failed to fetch camp:", error)

    res.status(500).json({
      message: "Failed to fetch camp",
    })
  }
})

// 📅 CHECK CAMP AVAILABILITY
app.get("/api/camps/:id/availability", async (req: Request, res: Response) => {
  const propId = Number(req.params.id)

  if (!propId || !Number.isInteger(propId) || propId <= 0) {
    return res.status(400).json({
      message: "Invalid camp/property ID",
    })
  }

  const { checkIn, days } = req.query

  if (!checkIn || typeof checkIn !== "string" || !checkIn.trim()) {
    return res.status(400).json({ message: "Invalid check-in date" })
  }

  const checkInStr = checkIn.trim().split("T")[0]
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(checkInStr)) {
    return res.status(400).json({ message: "Invalid check-in date" })
  }

  const [inYear, inMonth, inDay] = checkInStr.split("-").map(Number)
  const inDateObj = new Date(inYear, inMonth - 1, inDay)
  if (
    isNaN(inDateObj.getTime()) ||
    inDateObj.getFullYear() !== inYear ||
    inDateObj.getMonth() !== inMonth - 1 ||
    inDateObj.getDate() !== inDay
  ) {
    return res.status(400).json({ message: "Invalid check-in date" })
  }

  const now = new Date()
  const todayYear = now.getFullYear()
  const todayMonth = String(now.getMonth() + 1).padStart(2, "0")
  const todayDay = String(now.getDate()).padStart(2, "0")
  const todayStr = `${todayYear}-${todayMonth}-${todayDay}`

  if (checkInStr < todayStr) {
    return res
      .status(400)
      .json({ message: "Check-in date cannot be in the past" })
  }

  if (days === undefined || days === null || String(days).trim() === "") {
    return res.status(400).json({ message: "Days must be a positive integer" })
  }
  const daysNum = Number(days)
  if (!Number.isInteger(daysNum) || daysNum < 1) {
    return res
      .status(400)
      .json({ message: "Days must be a positive integer" })
  }

  const inDate = new Date(inYear, inMonth - 1, inDay)
  inDate.setDate(inDate.getDate() + daysNum)
  const outYear = inDate.getFullYear()
  const outMonth = String(inDate.getMonth() + 1).padStart(2, "0")
  const outDay = String(inDate.getDate()).padStart(2, "0")
  const checkOutStr = `${outYear}-${outMonth}-${outDay}`

  try {
    const property = await findPropertyById(propId)
    if (!property) {
      return res.status(404).json({ message: "Camp not found" })
    }

    const conflict = await findOverlappingBooking(
      property.id,
      checkInStr,
      checkOutStr,
    )

    if (conflict) {
      return res.status(200).json({
        available: false,
        checkIn: checkInStr,
        checkOut: checkOutStr,
        message: "Property is already booked for the selected dates",
      })
    }

    return res.status(200).json({
      available: true,
      checkIn: checkInStr,
      checkOut: checkOutStr,
      message: "Dates are available",
    })
  } catch (error) {
    console.error("Failed to check availability:", error)
    return res.status(500).json({ message: "Failed to check availability" })
  }
})

/* =========================
   BOOKINGS
========================= */

// 🧾 CREATE BOOKING
app.post(
  "/api/bookings",
  requireAuth,
  bookingLimiter,
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest
    const userId = authReq.userId

    if (!userId || !Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    const {
      campId,
      propertyId,
      name,
      phone,
      date,
      checkIn,
      checkOut,
      people,
      guests,
      days,
    } = req.body

    const propId = Number(campId || propertyId)
    if (!propId || !Number.isInteger(propId) || propId <= 0) {
      return res.status(400).json({ message: "Invalid camp/property ID" })
    }

    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ message: "Missing required fields" })
    }

    if (!phone || typeof phone !== "string" || phone.trim() === "") {
      return res.status(400).json({ message: "Missing required fields" })
    }

    const checkInInput = checkIn || date
    if (!checkInInput || typeof checkInInput !== "string" || !checkInInput.trim()) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    const checkInStr = checkInInput.trim().split("T")[0]
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(checkInStr)) {
      return res.status(400).json({ message: "Invalid check-in date" })
    }

    const [inYear, inMonth, inDay] = checkInStr.split("-").map(Number)
    const inDateObj = new Date(inYear, inMonth - 1, inDay)
    if (
      isNaN(inDateObj.getTime()) ||
      inDateObj.getFullYear() !== inYear ||
      inDateObj.getMonth() !== inMonth - 1 ||
      inDateObj.getDate() !== inDay
    ) {
      return res.status(400).json({ message: "Invalid check-in date" })
    }

    const now = new Date()
    const todayYear = now.getFullYear()
    const todayMonth = String(now.getMonth() + 1).padStart(2, "0")
    const todayDay = String(now.getDate()).padStart(2, "0")
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`

    if (checkInStr < todayStr) {
      return res
        .status(400)
        .json({ message: "Check-in date cannot be in the past" })
    }

    const rawGuests = guests !== undefined ? guests : people
    if (rawGuests === undefined || rawGuests === null) {
      return res
        .status(400)
        .json({ message: "Guests must be a positive integer" })
    }
    const guestsNum = Number(rawGuests)
    if (!Number.isInteger(guestsNum) || guestsNum < 1) {
      return res
        .status(400)
        .json({ message: "Guests must be a positive integer" })
    }

    if (days === undefined || days === null) {
      return res
        .status(400)
        .json({ message: "Days must be a positive integer" })
    }
    const daysNum = Number(days)
    if (!Number.isInteger(daysNum) || daysNum < 1) {
      return res
        .status(400)
        .json({ message: "Days must be a positive integer" })
    }

    let checkOutStr = ""
    if (checkOut !== undefined && checkOut !== null && String(checkOut).trim() !== "") {
      const rawOutStr = String(checkOut).trim().split("T")[0]
      if (!dateRegex.test(rawOutStr)) {
        return res.status(400).json({ message: "Invalid check-out date" })
      }

      const [outYear, outMonth, outDay] = rawOutStr.split("-").map(Number)
      const outDateObj = new Date(outYear, outMonth - 1, outDay)
      if (
        isNaN(outDateObj.getTime()) ||
        outDateObj.getFullYear() !== outYear ||
        outDateObj.getMonth() !== outMonth - 1 ||
        outDateObj.getDate() !== outDay
      ) {
        return res.status(400).json({ message: "Invalid check-out date" })
      }

      if (rawOutStr <= checkInStr) {
        return res
          .status(400)
          .json({ message: "Check-out date must be after check-in date" })
      }

      checkOutStr = rawOutStr
    } else {
      const inDate = new Date(inYear, inMonth - 1, inDay)
      inDate.setDate(inDate.getDate() + daysNum)
      const outYear = inDate.getFullYear()
      const outMonth = String(inDate.getMonth() + 1).padStart(2, "0")
      const outDay = String(inDate.getDate()).padStart(2, "0")
      checkOutStr = `${outYear}-${outMonth}-${outDay}`
    }

    try {
      const property = await findPropertyById(propId)
      if (!property) {
        return res.status(404).json({ message: "Camp not found" })
      }

      const totalAmount = property.pricePerNight * guestsNum * daysNum

      const duplicateBooking = await findRecentDuplicateBooking(
        userId,
        property.id,
        checkInStr,
        checkOutStr,
        guestsNum,
        totalAmount,
      )
      if (duplicateBooking) {
        return res
          .status(409)
          .json({ message: "Duplicate booking submission" })
      }

      const result = await createBookingTransaction({
        userId,
        propertyId: propId,
        phone,
        checkIn: checkInStr,
        checkOut: checkOutStr,
        guests: guestsNum,
        days: daysNum,
      })

      if (result.status === "user_not_found") {
        return res.status(404).json({ message: "User not found" })
      }

      if (result.status === "camp_not_found") {
        return res.status(404).json({ message: "Camp not found" })
      }

      if (result.status === "overlap") {
        return res
          .status(409)
          .json({ message: "Property is already booked for the selected dates" })
      }

      const dbBooking = result.booking

      return res.status(201).json({
        message: "Booking saved",
        booking: {
          id: dbBooking.id,
          campId: dbBooking.propertyId,
          name: name.trim(),
          phone: phone.trim(),
          date: dbBooking.checkIn,
          people: dbBooking.guests,
          days: daysNum,
          total: dbBooking.totalAmount,
        },
      })
    } catch (error) {
      logError("Failed to create booking", {
        route: "/api/bookings",
        method: "POST",
        userId,
        error,
      })
      return res.status(500).json({ message: "Failed to create booking" })
    }
  },
)

// 📄 GET BOOKINGS (FOR AUTHENTICATED USER)
app.get(
  "/api/bookings",
  requireAuth,
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest
    const userId = authReq.userId

    if (!userId || !Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    try {
      const user = await findUserById(userId)
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" })
      }

      const dbBookings = await findBookingsByUserId(userId)
      const properties = await findAllPropertiesForAdmin()
      const propertiesMap = new Map(properties.map(p => [p.id, p]))

      const fullBookings = dbBookings.map((b: Booking) => {
        const property = propertiesMap.get(b.propertyId)

        const camp = property
          ? {
              name: property.name,
              image: property.imageUrl || "",
              location: property.location,
            }
          : undefined

        const inTime = new Date(b.checkIn).getTime()
        const outTime = new Date(b.checkOut).getTime()
        const days =
          isNaN(inTime) || isNaN(outTime) || outTime <= inTime
            ? 1
            : Math.max(1, Math.round((outTime - inTime) / (1000 * 60 * 60 * 24)))

        return {
          id: b.id,
          name: user.name,
          phone: user.phone || "",
          date: b.checkIn,
          people: b.guests,
          days,
          total: b.totalAmount,
          status: b.status,
          paymentStatus: b.paymentStatus,
          camp,
        }
      })

      return res.json(fullBookings)
    } catch (error) {
      logError("Failed to fetch bookings", {
        route: "/api/bookings",
        method: "GET",
        userId,
        error,
      })
      return res.status(500).json({ message: "Failed to fetch bookings" })
    }
  },
)

// 🔴 DELETE BOOKING
app.delete(
  "/api/bookings/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest
    const userId = authReq.userId

    if (!userId || !Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid booking ID" })
    }

    try {
      const success = await cancelBookingForUser(id, userId)

      if (!success) {
        return res.status(404).json({ message: "Booking not found" })
      }

      return res.json({ message: "Booking cancelled" })
    } catch (error) {
      console.error("Failed to cancel booking:", error)
      return res.status(500).json({ message: "Failed to cancel booking" })
    }
  },
)

/* =========================
   ADMIN BOOKINGS
========================= */

// 📋 GET ALL BOOKINGS (ADMIN)
app.get(
  "/api/admin/bookings",
  requireAuth,
  requireAdmin,
  async (_: Request, res: Response) => {
    try {
      const bookings = await findAllBookingsWithDetails()
      return res.status(200).json(bookings)
    } catch (error) {
      console.error("Failed to fetch admin bookings:", error)
      return res.status(500).json({ message: "Failed to fetch bookings" })
    }
  },
)

// ✏️ UPDATE BOOKING STATUS (ADMIN)
app.patch(
  "/api/admin/bookings/:id/status",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid booking ID" })
    }

    const { status } = req.body
    const VALID_TARGET_STATUSES = ["confirmed", "completed", "cancelled"]
    if (
      !status ||
      typeof status !== "string" ||
      !VALID_TARGET_STATUSES.includes(status)
    ) {
      return res.status(400).json({ message: "Invalid target status" })
    }

    try {
      const booking = await findBookingById(id)
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" })
      }

      const ALLOWED_TRANSITIONS: Record<string, string[]> = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["completed", "cancelled"],
        completed: [],
        cancelled: [],
      }

      const allowedNext = ALLOWED_TRANSITIONS[booking.status] || []
      if (!allowedNext.includes(status)) {
        return res.status(400).json({ message: "Invalid status transition" })
      }

      const updatedBooking = await updateBookingStatus(
        id,
        booking.status,
        status,
      )
      if (!updatedBooking) {
        return res
          .status(409)
          .json({ message: "Booking status changed by another request" })
      }

      return res.status(200).json({
        message: "Booking status updated",
        booking: updatedBooking,
      })
    } catch (error) {
      console.error("Failed to update booking status:", error)
      return res.status(500).json({ message: "Failed to update booking status" })
    }
  },
)

/* =========================
   ADMIN PROPERTIES
========================= */

// 📦 GET ALL PROPERTIES (ADMIN)
app.get(
  "/api/admin/properties",
  requireAuth,
  requireAdmin,
  async (_: Request, res: Response) => {
    try {
      const properties = await findAllPropertiesForAdmin()
      return res.status(200).json(properties)
    } catch (error) {
      console.error("Failed to fetch admin properties:", error)
      return res.status(500).json({ message: "Failed to fetch properties" })
    }
  },
)

// ➕ CREATE PROPERTY (ADMIN)
app.post(
  "/api/admin/properties",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    const {
      name,
      description,
      propertyType,
      location,
      pricePerNight,
      rating,
      imageUrl,
    } = req.body

    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ message: "Name is required" })
    }

    if (
      !propertyType ||
      typeof propertyType !== "string" ||
      propertyType.trim() === ""
    ) {
      return res.status(400).json({ message: "Property type is required" })
    }

    if (!location || typeof location !== "string" || location.trim() === "") {
      return res.status(400).json({ message: "Location is required" })
    }

    if (
      pricePerNight === undefined ||
      pricePerNight === null ||
      typeof pricePerNight !== "number" ||
      isNaN(pricePerNight) ||
      pricePerNight < 0
    ) {
      return res
        .status(400)
        .json({ message: "Price per night must be a non-negative number" })
    }

    if (
      rating !== undefined &&
      rating !== null &&
      (typeof rating !== "number" || isNaN(rating) || rating < 0 || rating > 5)
    ) {
      return res
        .status(400)
        .json({ message: "Rating must be a number between 0 and 5" })
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({ message: "Description must be a string" })
    }

    if (
      imageUrl !== undefined &&
      imageUrl !== null &&
      typeof imageUrl !== "string"
    ) {
      return res.status(400).json({ message: "Image URL must be a string" })
    }

    try {
      const property = await createProperty({
        name: name.trim(),
        description:
          typeof description === "string" ? description.trim() : null,
        propertyType: propertyType.trim(),
        location: location.trim(),
        pricePerNight,
        rating: rating !== undefined && rating !== null ? rating : undefined,
        imageUrl: typeof imageUrl === "string" ? imageUrl.trim() : null,
      })

      return res.status(201).json({
        message: "Property created",
        property,
      })
    } catch (error) {
      console.error("Failed to create property:", error)
      return res.status(500).json({ message: "Failed to create property" })
    }
  },
)

// ✏️ UPDATE PROPERTY (ADMIN)
app.patch(
  "/api/admin/properties/:id",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid property ID" })
    }

    const {
      name,
      description,
      propertyType,
      location,
      pricePerNight,
      rating,
      imageUrl,
    } = req.body

    if (
      name === undefined &&
      description === undefined &&
      propertyType === undefined &&
      location === undefined &&
      pricePerNight === undefined &&
      rating === undefined &&
      imageUrl === undefined
    ) {
      return res
        .status(400)
        .json({ message: "At least one editable field must be provided" })
    }

    const updatePayload: UpdatePropertyInput = {}

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({ message: "Name must be a non-empty string" })
      }
      updatePayload.name = name.trim()
    }

    if (propertyType !== undefined) {
      if (typeof propertyType !== "string" || propertyType.trim() === "") {
        return res
          .status(400)
          .json({ message: "Property type must be a non-empty string" })
      }
      updatePayload.propertyType = propertyType.trim()
    }

    if (location !== undefined) {
      if (typeof location !== "string" || location.trim() === "") {
        return res
          .status(400)
          .json({ message: "Location must be a non-empty string" })
      }
      updatePayload.location = location.trim()
    }

    if (pricePerNight !== undefined) {
      if (
        typeof pricePerNight !== "number" ||
        isNaN(pricePerNight) ||
        pricePerNight < 0
      ) {
        return res
          .status(400)
          .json({ message: "Price per night must be a non-negative number" })
      }
      updatePayload.pricePerNight = pricePerNight
    }

    if (rating !== undefined) {
      if (
        typeof rating !== "number" ||
        isNaN(rating) ||
        rating < 0 ||
        rating > 5
      ) {
        return res
          .status(400)
          .json({ message: "Rating must be a number between 0 and 5" })
      }
      updatePayload.rating = rating
    }

    if (description !== undefined) {
      if (description !== null && typeof description !== "string") {
        return res
          .status(400)
          .json({ message: "Description must be a string or null" })
      }
      updatePayload.description =
        typeof description === "string" ? description.trim() : null
    }

    if (imageUrl !== undefined) {
      if (imageUrl !== null && typeof imageUrl !== "string") {
        return res
          .status(400)
          .json({ message: "Image URL must be a string or null" })
      }
      updatePayload.imageUrl =
        typeof imageUrl === "string" ? imageUrl.trim() : null
    }

    try {
      const property = await updateProperty(id, updatePayload)
      if (!property) {
        return res.status(404).json({ message: "Property not found" })
      }

      return res.status(200).json({
        message: "Property updated",
        property,
      })
    } catch (error) {
      console.error("Failed to update property:", error)
      return res.status(500).json({ message: "Failed to update property" })
    }
  },
)

// ⚡ ACTIVATE / DEACTIVATE PROPERTY (ADMIN)
app.patch(
  "/api/admin/properties/:id/status",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid property ID" })
    }

    const { isActive } = req.body
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be a boolean" })
    }

    try {
      const property = await setPropertyActive(id, isActive)
      if (!property) {
        return res.status(404).json({ message: "Property not found" })
      }

      return res.status(200).json({
        message: isActive ? "Property activated" : "Property deactivated",
        property,
      })
    } catch (error) {
      console.error("Failed to update property status:", error)
      return res.status(500).json({ message: "Failed to update property status" })
    }
  },
)

/* =========================
   PAYMENTS
========================= */

function getRazorpayInstance(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keyId.trim() || !keySecret || !keySecret.trim()) {
    throw new Error("Razorpay environment variables missing")
  }

  return new Razorpay({
    key_id: keyId.trim(),
    key_secret: keySecret.trim(),
  })
}

// 💳 CREATE PAYMENT ORDER (RAZORPAY)
app.post(
  "/api/payments/create-order",
  requireAuth,
  paymentLimiter,
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest
    const userId = authReq.userId

    if (!userId || !Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    const { bookingId } = req.body
    const parsedBookingId = Number(bookingId)

    if (
      bookingId === undefined ||
      bookingId === null ||
      !Number.isInteger(parsedBookingId) ||
      parsedBookingId <= 0
    ) {
      return res.status(400).json({ message: "Invalid booking ID" })
    }

    try {
      const booking = await findBookingById(parsedBookingId)
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" })
      }

      if (booking.userId !== userId) {
        return res
          .status(403)
          .json({ message: "Booking does not belong to authenticated user" })
      }

      if (booking.status !== "pending") {
        return res
          .status(400)
          .json({ message: "Booking status is not pending" })
      }

      const paymentStatusRes = await pool.query<{ payment_status: string }>(
        `SELECT payment_status FROM bookings WHERE id = $1`,
        [parsedBookingId],
      )
      const paymentStatus =
        paymentStatusRes.rows[0]?.payment_status || "unpaid"

      if (paymentStatus !== "unpaid") {
        return res
          .status(400)
          .json({ message: "Booking is already paid or processing" })
      }

      if (
        typeof booking.totalAmount !== "number" ||
        isNaN(booking.totalAmount) ||
        booking.totalAmount <= 0
      ) {
        return res.status(400).json({ message: "Invalid booking total amount" })
      }

      const amountInPaise = Math.round(booking.totalAmount * 100)
      const receipt = `booking_${booking.id}`

      const razorpay = getRazorpayInstance()
      const rzpOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt,
        notes: {
          bookingId: String(booking.id),
          userId: String(userId),
        },
      })

      await createPaymentRecord({
        bookingId: booking.id,
        userId,
        provider: "razorpay",
        providerOrderId: rzpOrder.id,
        amount: booking.totalAmount,
        currency: "INR",
        status: "created",
      })

      return res.status(200).json({
        orderId: rzpOrder.id,
        amount: amountInPaise,
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID,
      })
    } catch (error) {
      logError("Failed to create Razorpay payment order", {
        route: "/api/payments/create-order",
        method: "POST",
        userId,
        error,
      })
      return res
        .status(500)
        .json({ message: "Payment order creation failed" })
    }
  },
)

// 🔐 VERIFY PAYMENT SIGNATURE (RAZORPAY)
app.post(
  "/api/payments/verify",
  requireAuth,
  paymentLimiter,
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest
    const userId = authReq.userId

    if (!userId || !Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ message: "Unauthorized" })
    }

    const {
      bookingId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body

    const parsedBookingId = Number(bookingId)

    if (
      bookingId === undefined ||
      bookingId === null ||
      !Number.isInteger(parsedBookingId) ||
      parsedBookingId <= 0
    ) {
      return res.status(400).json({ message: "Invalid booking ID" })
    }

    if (
      !razorpay_order_id ||
      typeof razorpay_order_id !== "string" ||
      razorpay_order_id.trim() === "" ||
      !razorpay_payment_id ||
      typeof razorpay_payment_id !== "string" ||
      razorpay_payment_id.trim() === "" ||
      !razorpay_signature ||
      typeof razorpay_signature !== "string" ||
      razorpay_signature.trim() === ""
    ) {
      return res
        .status(400)
        .json({ message: "Missing or invalid payment parameters" })
    }

    try {
      const booking = await findBookingById(parsedBookingId)
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" })
      }

      if (booking.userId !== userId) {
        return res
          .status(403)
          .json({ message: "Booking does not belong to authenticated user" })
      }

      const paymentRecord = await findPaymentByOrderId(razorpay_order_id.trim())
      if (!paymentRecord) {
        return res.status(404).json({ message: "Payment order not found" })
      }

      if (paymentRecord.bookingId !== parsedBookingId) {
        return res
          .status(400)
          .json({ message: "Payment order does not match booking" })
      }

      // Idempotency check: If payment already captured / booking already paid
      if (paymentRecord.status === "captured") {
        return res.status(200).json({
          message: "Payment verified",
          bookingId: parsedBookingId,
          paymentStatus: "paid",
          bookingStatus: "confirmed",
        })
      }

      const keySecret = process.env.RAZORPAY_KEY_SECRET
      if (!keySecret || !keySecret.trim()) {
        return res
          .status(500)
          .json({ message: "Payment verification configuration error" })
      }

      // Signature Verification using HMAC SHA256 & timing-safe comparison
      const text = `${razorpay_order_id.trim()}|${razorpay_payment_id.trim()}`
      const generatedSignature = crypto
        .createHmac("sha256", keySecret.trim())
        .update(text)
        .digest("hex")

      const sigBuffer = Buffer.from(razorpay_signature.trim())
      const genBuffer = Buffer.from(generatedSignature)

      const isValid =
        sigBuffer.length === genBuffer.length &&
        crypto.timingSafeEqual(sigBuffer, genBuffer)

      if (!isValid) {
        return res.status(400).json({ message: "Invalid payment signature" })
      }

      // Atomic update of payments and bookings tables
      await capturePaymentAndConfirmBooking(
        paymentRecord.id,
        parsedBookingId,
        razorpay_payment_id.trim(),
        razorpay_signature.trim(),
      )

      return res.status(200).json({
        message: "Payment verified",
        bookingId: parsedBookingId,
        paymentStatus: "paid",
        bookingStatus: "confirmed",
      })
    } catch (error) {
      logError("Failed to verify payment signature", {
        route: "/api/payments/verify",
        method: "POST",
        userId,
        error,
      })
      return res.status(500).json({ message: "Payment verification failed" })
    }
  },
)

/* =========================
   404 HANDLER
========================= */

app.use((_: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" })
})

/* =========================
   SERVER & STARTUP VALIDATION
========================= */

export function validateStartupEnvironment(): void {
  const requiredEnvVars = [
    "JWT_SECRET",
    "DATABASE_URL",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
  ]

  for (const varName of requiredEnvVars) {
    const val = process.env[varName]
    if (!val || typeof val !== "string" || val.trim() === "") {
      throw new Error(
        `FATAL: Required environment variable ${varName} is missing or empty.`,
      )
    }
  }
}

const PORT = process.env.PORT || 4000

// Vercel runs this file as a serverless function — it imports the
// exported `app` and never needs a long-running listener. Calling
// app.listen() unconditionally would try (and fail) to bind a port
// inside the serverless runtime, so we only do it outside Vercel.
if (process.env.VERCEL !== "1") {
  validateStartupEnvironment()
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`)
  })
}

export default app