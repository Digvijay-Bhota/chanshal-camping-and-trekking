import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { CheckCircle, ShieldCheck, MapPin, Calendar, Users, ArrowRight, Home } from "lucide-react"
import toast from "react-hot-toast"

interface Camp {
  name: string
  image: string
  location: string
}

interface Booking {
  id: number
  name: string
  phone: string
  date: string
  people: number
  days: number
  total: number
  status: string
  paymentStatus: string
  camp?: Camp
}

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "")

function PaymentSuccess() {
  const { bookingId } = useParams()
  const navigate = useNavigate()

  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const parsedId = Number(bookingId)

  const fetchBooking = useCallback(async () => {
    if (!parsedId || !Number.isInteger(parsedId) || parsedId <= 0) {
      setError("Invalid booking ID")
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API}/api/bookings`, {
        credentials: "include",
      })

      if (res.status === 401) {
        toast.error("Please login to view your booking receipt")
        navigate("/login")
        return
      }

      if (!res.ok) {
        throw new Error("Failed to load booking details")
      }

      const bookings: Booking[] = await res.json()
      const found = bookings.find(b => b.id === parsedId)

      if (!found) {
        setError("Booking not found or does not belong to your account")
      } else if (found.paymentStatus !== "paid") {
        setError("This booking has not been paid yet")
      } else {
        setBooking(found)
        setError(null)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load receipt"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [parsedId, navigate])

  useEffect(() => {
    fetchBooking()
  }, [fetchBooking])

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-16 flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
        <div className="text-center font-medium animate-pulse text-lg">
          ⛺ Loading Payment Receipt...
        </div>
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen pt-24 pb-16 flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full border border-gray-200 dark:border-gray-700 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 flex items-center justify-center mx-auto text-2xl">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Receipt Unavailable
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {error || "Booking not found"}
          </p>
          <div className="pt-4 flex flex-col gap-2">
            <button
              onClick={() => navigate("/my-bookings")}
              className="w-full py-2.5 px-4 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 transition"
            >
              Go to My Bookings
            </button>
            <button
              onClick={() => navigate("/")}
              className="w-full py-2.5 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-semibold text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN").format(amount)

  return (
    <div className="min-h-screen pt-24 pb-16 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-200 p-4">
      <div className="max-w-xl mx-auto space-y-6">

        {/* SUCCESS BANNER CARD */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
          
          <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-6 text-white text-center space-y-2">
            <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-full flex items-center justify-center mx-auto mb-2 text-white">
              <CheckCircle size={32} />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Payment Successful! 🎉
            </h1>
            <p className="text-emerald-100 text-sm font-medium">
              Your reservation has been confirmed and locked.
            </p>
          </div>

          <div className="p-6 space-y-6">

            {/* RECEIPT HEADER METADATA */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400">
                  Booking Reference
                </span>
                <p className="text-xl font-extrabold font-mono text-gray-900 dark:text-white">
                  #{booking.id}
                </p>
              </div>

              {/* BADGES */}
              <div className="flex flex-col items-end gap-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  <CheckCircle size={14} /> Payment: Paid ✅
                </span>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                  <ShieldCheck size={14} /> Reservation: {booking.status.toUpperCase()} ✅
                </span>
              </div>
            </div>

            {/* CAMP DETAILS */}
            {booking.camp && (
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                {booking.camp.image && (
                  <img
                    src={booking.camp.image}
                    alt={booking.camp.name}
                    className="w-20 h-20 rounded-lg object-cover shrink-0"
                  />
                )}
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                    {booking.camp.name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                    <MapPin size={14} className="text-red-500 shrink-0" />
                    {booking.camp.location}
                  </p>
                </div>
              </div>
            )}

            {/* RESERVATION DETAILS GRID */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700/60">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                  <Calendar size={14} /> Check-in Date
                </span>
                <span className="font-bold text-gray-900 dark:text-white text-base">
                  {booking.date}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700/60">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                  <Users size={14} /> Guests & Duration
                </span>
                <span className="font-bold text-gray-900 dark:text-white text-base">
                  {booking.people} {booking.people === 1 ? "Guest" : "Guests"} · {booking.days} {booking.days === 1 ? "Day" : "Days"}
                </span>
              </div>
            </div>

            {/* GUEST INFO */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700/60 space-y-1 text-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Guest Contact
              </p>
              <p className="font-semibold text-gray-900 dark:text-white">👤 {booking.name}</p>
              <p className="text-gray-600 dark:text-gray-300">📞 {booking.phone}</p>
            </div>

            {/* TOTAL PAID SUMMARY */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Total Amount Paid
              </span>
              <span className="text-2xl font-black text-green-600 dark:text-green-400">
                ₹{formatCurrency(booking.total)}
              </span>
            </div>

            {/* NAVIGATION BUTTONS */}
            <div className="pt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate("/my-bookings")}
                className="inline-flex items-center justify-center gap-2 py-3 px-4 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition shadow-md"
              >
                View My Bookings <ArrowRight size={16} />
              </button>

              <button
                onClick={() => navigate("/")}
                className="inline-flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              >
                <Home size={16} /> Back to Home
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}

export default PaymentSuccess
