import express, { Request, Response } from "express"
import cors from "cors"
import { pool } from "./db"
import {
  findAllProperties,
  findPropertyById,
} from "./modules/properties/property.repository"
import {
  findUserById,
  findUserByEmail,
  findUserByPhone,
  createUser,
} from "./modules/users/user.repository"
import {
  createBooking,
  findAllBookings,
  deleteBooking,
} from "./modules/bookings/booking.repository"

const app = express()

// Comment
app.use(cors())
app.use(express.json())

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

// 🔐 USER LOGIN / REGISTER
app.post("/api/users/login", async (req: Request, res: Response) => {
  try {
    const { name, email, phone } = req.body

    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ message: "Name is required" })
    }

    const trimmedName = name.trim()
    const trimmedEmail = typeof email === "string" && email.trim() ? email.trim() : null
    const trimmedPhone = typeof phone === "string" && phone.trim() ? phone.trim() : null

    if (!trimmedEmail && !trimmedPhone) {
      return res
        .status(400)
        .json({ message: "At least one of email or phone is required" })
    }

    let user = null
    let isNewUser = false

    if (trimmedEmail) {
      user = await findUserByEmail(trimmedEmail)
    }

    if (!user && trimmedPhone) {
      user = await findUserByPhone(trimmedPhone)
    }

    if (!user) {
      user = await createUser({
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
      })
      isNewUser = true
    }

    const responseUser = {
      id: user.id,
      name: user.name,
      email: user.email ?? null,
      phone: user.phone ?? null,
    }

    const statusCode = isNewUser ? 201 : 200
    return res.status(statusCode).json({ user: responseUser })
  } catch (error) {
    console.error("Failed to login or create user:", error)
    return res.status(500).json({ message: "Failed to login or create user" })
  }
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

/* =========================
   BOOKINGS
========================= */

// 🧾 CREATE BOOKING
app.post("/api/bookings", async (req: Request, res: Response) => {
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
    userId,
    user_id,
  } = req.body

  const rawUserId = userId || user_id
  const parsedUserId = Number(rawUserId)

  if (!rawUserId || !Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    return res.status(400).json({ message: "Valid userId is required" })
  }

  const propId = Number(campId || propertyId)
  if (!propId || isNaN(propId) || !name || !phone || (!date && !checkIn)) {
    return res.status(400).json({ message: "Missing required fields" })
  }

  try {
    const user = await findUserById(parsedUserId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const property = await findPropertyById(propId)
    if (!property) {
      return res.status(404).json({ message: "Camp not found" })
    }

    const guestsNum = Number(guests || people || 1)
    const daysNum = Math.max(1, Number(days || 1))
    const checkInStr = (checkIn || date).toString()

    let checkOutStr = (checkOut || "").toString()
    if (!checkOutStr) {
      const inDate = new Date(checkInStr)
      if (isNaN(inDate.getTime())) {
        return res.status(400).json({ message: "Invalid check-in date" })
      }
      const outDate = new Date(inDate)
      outDate.setDate(outDate.getDate() + daysNum)
      checkOutStr = outDate.toISOString().split("T")[0]
    }

    // Calculate total on the server only: property.pricePerNight * guests * days
    const totalAmount = property.pricePerNight * guestsNum * daysNum

    const dbBooking = await createBooking({
      userId: user.id,
      propertyId: property.id,
      checkIn: checkInStr,
      checkOut: checkOutStr,
      guests: guestsNum,
      totalAmount,
      status: "pending",
    })

    return res.status(201).json({
      message: "Booking saved",
      booking: {
        id: dbBooking.id,
        campId: dbBooking.propertyId,
        name,
        phone,
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
})

// 📄 GET BOOKINGS (WITH CAMP & USER DETAILS FROM POSTGRESQL)
app.get("/api/bookings", async (_: Request, res: Response) => {
  try {
    const dbBookings = await findAllBookings()
    const properties = await findAllProperties()
    const propertiesMap = new Map(properties.map(p => [p.id, p]))

    const fullBookings = await Promise.all(
      dbBookings.map(async b => {
        const user = await findUserById(b.userId)
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
          name: user ? user.name : "Guest",
          phone: user && user.phone ? user.phone : "",
          date: b.checkIn,
          people: b.guests,
          days,
          total: b.totalAmount,
          camp,
        }
      })
    )

    return res.json(fullBookings)
  } catch (error) {
    console.error("Failed to fetch bookings:", error)
    return res.status(500).json({ message: "Failed to fetch bookings" })
  }
})

// 🔴 DELETE BOOKING
app.delete("/api/bookings/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id)

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "Invalid booking ID" })
  }

  try {
    const success = await deleteBooking(id)

    if (!success) {
      return res.status(404).json({ message: "Booking not found" })
    }

    return res.json({ message: "Booking cancelled" })
  } catch (error) {
    console.error("Failed to delete booking:", error)
    return res.status(500).json({ message: "Failed to cancel booking" })
  }
})

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