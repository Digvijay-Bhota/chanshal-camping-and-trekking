import express, { Request, Response } from "express"
import cors from "cors"
import { pool } from "./db"
import {
  findAllProperties,
  findPropertyById,
} from "./modules/properties/property.repository"
import {
  findUserByEmail,
  findUserByPhone,
  createUser,
} from "./modules/users/user.repository"

const app = express()

// Comment
app.use(cors())
app.use(express.json())

// 🏕️ TYPES
type Camp = {
  id: number
  name: string
  price: number
  location: string
  rating: number
  image: string
}

type Booking = {
  id: number
  campId: number
  name: string
  phone: string
  date: string
  people: number
  days: number
  total: number
}

// 🏕️ DATA
const camps: Camp[] = [
  {
    id: 1,
    name: "Chanshal Trek",
    price: 2500,
    location: "Chopal",
    rating: 4.8,
    image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
  },
  {
    id: 2,
    name: "Bijat Maharaj Camp",
    price: 1800,
    location: "Sarain",
    rating: 4.6,
    image: "https://images.unsplash.com/photo-1526772662000-3f88f10405ff",
  },
]

const bookings: Booking[] = []

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
app.post("/api/bookings", (req: Request, res: Response) => {
  const { campId, people, days, name, phone, date } = req.body

  // ✅ BASIC VALIDATION
  if (!campId || !name || !phone || !date) {
    return res.status(400).json({
      message: "Missing required fields",
    })
  }

  const camp = camps.find(c => c.id === Number(campId))

  if (!camp) {
    return res.status(404).json({ message: "Camp not found" })
  }

  const total =
    camp.price *
    Number(people || 1) *
    Number(days || 1)

  const booking: Booking = {
    id: bookings.length + 1,
    campId: Number(campId),
    name,
    phone,
    date,
    people: Number(people || 1),
    days: Number(days || 1),
    total,
  }

  bookings.push(booking)

  res.status(201).json({
    message: "Booking saved",
    booking,
  })
})

// 📄 GET BOOKINGS (WITH CAMP DETAILS)
app.get("/api/bookings", (_: Request, res: Response) => {
  const fullBookings = bookings.map(b => {
    const camp = camps.find(c => c.id === b.campId)
    return { ...b, camp }
  })

  res.json(fullBookings)
})

// 🔴 DELETE BOOKING
app.delete("/api/bookings/:id", (req: Request, res: Response) => {
  const id = Number(req.params.id)

  const index = bookings.findIndex(b => b.id === id)

  if (index === -1) {
    return res.status(404).json({ message: "Booking not found" })
  }

  bookings.splice(index, 1)

  res.json({ message: "Booking cancelled" })
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