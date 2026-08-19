import { useEffect, useState, useCallback } from "react"
import toast from "react-hot-toast"
import { useAuth } from "../context/AuthContext"

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

const API = (
  import.meta.env.VITE_API_URL || "http://localhost:4000"
).replace(/\/$/, "")

function MyBookings() {
  const { isAuthenticated, loading: authLoading } = useAuth()

  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const fetchBookings = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`${API}/api/bookings`, {
        credentials: "include",
        signal,
      })

      if (!res.ok) {
        throw new Error("Failed to load bookings")
      }

      const data: Booking[] = await res.json()
      const sorted = [...data].reverse()

      setBookings(sorted)
      setError(false)
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(true)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // ✅ LOAD BOOKINGS
  useEffect(() => {
    if (authLoading || !isAuthenticated) return

    const controller = new AbortController()
    fetchBookings(controller.signal)

    return () => controller.abort()
  }, [authLoading, isAuthenticated, fetchBookings])

  // 🔴 CANCEL BOOKING
  const cancelBooking = async (id: number) => {
    try {
      setDeletingId(id)

      const res = await fetch(`${API}/api/bookings/${id}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || "Failed to cancel booking")
      }

      toast.success("Booking cancelled ❌")
      await fetchBookings()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel booking"
      toast.error(message)
    } finally {
      setDeletingId(null)
    }
  }

  // 💰 TOTAL
  const totalSpent = bookings.reduce((sum, b) => sum + b.total, 0)

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN").format(amount)

  // ⛺ LOADING
  if (authLoading || loading)
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

              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300 mb-3">
                <p className="font-medium text-gray-800 dark:text-gray-200">👤 {b.name}</p>
                <p>📞 {b.phone}</p>
              </div>

              {/* 📊 STAY DETAILS BADGES */}
              <div className="grid grid-cols-3 gap-2 my-3">
                <div className="bg-white dark:bg-gray-700/80 p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300 mb-0.5">
                    Date
                  </span>
                  <span className="block text-xs font-bold text-gray-800 dark:text-white truncate">
                    📅 {b.date}
                  </span>
                </div>

                <div className="bg-white dark:bg-gray-700/80 p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300 mb-0.5">
                    Guests
                  </span>
                  <span className="block text-xs font-bold text-gray-800 dark:text-white">
                    👥 {b.people} {b.people === 1 ? "Person" : "People"}
                  </span>
                </div>

                <div className="bg-white dark:bg-gray-700/80 p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-300 mb-0.5">
                    Duration
                  </span>
                  <span className="block text-xs font-bold text-gray-800 dark:text-white">
                    🗓 {b.days || 1} {b.days === 1 ? "Day" : "Days"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-gray-500 dark:text-gray-300 uppercase font-semibold">Total</span>
                <span className="text-green-500 dark:text-green-400 font-bold text-lg">
                  ₹ {formatCurrency(b.total)}
                </span>
              </div>

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
