import React, { useEffect, useState } from "react"
import toast from "react-hot-toast"

type Camp = {
  name: string
  image: string
  location: string
}

type Booking = {
  id: number
  name: string
  phone: string
  date: string
  people: number
  days: number
  total: number
  camp?: Camp
}

function MyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // ✅ LOAD BOOKINGS
  useEffect(() => {
    const controller = new AbortController()

    const local = localStorage.getItem("bookings")
    
    if (local) {
      try {
        setBookings(JSON.parse(local))
      } catch {
        localStorage.removeItem("bookings")
      }
    }

   const API = import.meta.env.VITE_API_URL || "http://localhost:4000"
fetch(`${API}/api/bookings`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then(data => {
        const sorted = [...data].reverse()

        setBookings(sorted)
        localStorage.setItem("bookings", JSON.stringify(sorted))
        setLoading(false)
      })
      .catch(err => {
        if (err.name !== "AbortError") {
          setError(true)
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [])

  // 🔴 CANCEL BOOKING
  const cancelBooking = async (id: number) => {
    try {
      setDeletingId(id)

     await fetch(`${API}/api/bookings/${id}`, {
        method: "DELETE",
      })

      const updated = bookings.filter(b => b.id !== id)

      setBookings(updated)
      localStorage.setItem("bookings", JSON.stringify(updated))

      toast.success("Booking cancelled ❌")
    } catch {
      toast.error("Failed to cancel booking")
    } finally {
      setDeletingId(null)
    }
  }

  // 💰 TOTAL
  const totalSpent = bookings.reduce((sum, b) => sum + b.total, 0)

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN").format(amount)

  // ⛺ LOADING
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-xl">
        ⛺ Loading bookings...
      </div>
    )

  // ❌ ERROR
  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500 text-xl">
        Failed to load bookings
      </div>
    )

  // 😢 EMPTY
  if (bookings.length === 0)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-xl">
        No bookings yet 😢
      </div>
    )

  return (
    <div className="min-h-screen bg-white text-black dark:bg-gray-900 dark:text-white p-6">

      <h1 className="text-3xl font-bold mb-2">My Bookings 📋</h1>

      <h2 className="text-green-500 font-bold mb-6 text-lg">
        Total Spent: ₹ {formatCurrency(totalSpent)}
      </h2>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">

        {bookings.map(b => (
          <div
            key={b.id}
            className="bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg hover:scale-105 transition"
          >
            {/* 🖼 CAMP IMAGE */}
            {b.camp?.image && (
              <img
                src={b.camp.image}
                className="h-40 w-full object-cover"
              />
            )}

            <div className="p-5">

              {/* 🏕 CAMP NAME */}
              {b.camp?.name && (
                <h2 className="text-xl font-bold">{b.camp.name}</h2>
              )}

              {b.camp?.location && (
                <p className="text-sm text-gray-400 mb-2">
                  📍 {b.camp.location}
                </p>
              )}

              <p>👤 {b.name}</p>
              <p>📞 {b.phone}</p>
              <p>📅 {b.date}</p>
              <p>👥 People: {b.people}</p>

              {b.days && <p>🗓 Days: {b.days}</p>}

              <p className="text-green-500 font-bold text-lg">
                ₹ {formatCurrency(b.total)}
              </p>

              <button
                onClick={() => cancelBooking(b.id)}
                disabled={deletingId === b.id}
                className="mt-3 w-full bg-red-500 py-2 rounded hover:bg-red-600 transition disabled:opacity-50"
              >
                {deletingId === b.id
                  ? "Cancelling..."
                  : "Cancel Booking"}
              </button>

            </div>
          </div>
        ))}

      </div>
    </div>
  )
}

export default MyBookings
