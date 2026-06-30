import express, { Request, Response } from "express"
import cors from "cors"

const app = express()

//Comment
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

/* =========================
   CAMPS
========================= */

// 📦 GET ALL CAMPS
app.get("/api/camps", (_: Request, res: Response) => {
  res.json(camps)
})

// 📦 GET SINGLE CAMP
app.get("/api/camps/:id", (req: Request, res: Response) => {
  const id = Number(req.params.id)

  const camp = camps.find(c => c.id === id)

  if (!camp) {
    return res.status(404).json({ message: "Camp not found" })
  }

  res.json(camp)
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
