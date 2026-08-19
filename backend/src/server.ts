import express, { Request, Response } from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import { pool } from "./db"
import {
  findAllProperties,
  findPropertyById,
  findAllPropertiesForAdmin,
  createProperty,
  updateProperty,
  UpdatePropertyInput,
  setPropertyActive,
} from "./modules/properties/property.repository"
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
app.use(express.json())
app.use(cookieParser())

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
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
    try {
      const authReq = req as AuthenticatedRequest
      const userId = authReq.userId

      if (!userId || !Number.isInteger(userId) || userId <= 0) {
        return res.status(401).json({ message: "Unauthorized" })
      }

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
      console.error("Failed to fetch authenticated user:", error)
      return res.status(500).json({ message: "Failed to fetch user" })
    }
  },
)

// 🔑 USER REGISTER
app.post("/api/users/register", async (req: Request, res: Response) => {
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
    console.error("Failed to register user:", error)
    return res.status(500).json({ message: "Failed to register user" })
  }
})

// 🔐 USER LOGIN
app.post("/api/users/login", async (req: Request, res: Response) => {
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
    console.error("Failed to login user:", error)
    return res.status(500).json({ message: "Failed to login user" })
  }
})

// 🚪 USER LOGOUT
app.post("/api/users/logout", (_: Request, res: Response) => {
  res.clearCookie("auth_token", {
    httpOnly: true,
    sameSite: "lax",
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
      console.error("Failed to create booking:", error)
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
          camp,
        }
      })

      return res.json(fullBookings)
    } catch (error) {
      console.error("Failed to fetch bookings:", error)
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
   404 HANDLER
========================= */

app.use((_: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" })
})

/* =========================
   SERVER
========================= */

const PORT = process.env.PORT || 4000

// Vercel runs this file as a serverless function — it imports the
// exported `app` and never needs a long-running listener. Calling
// app.listen() unconditionally would try (and fail) to bind a port
// inside the serverless runtime, so we only do it outside Vercel.
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`)
  })
}

export default app