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
  status?: string
  paymentStatus?: string
  camp?: Camp
}

/* RAZORPAY TYPES */
interface RazorpaySuccessResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  description?: string
  image?: string
  order_id: string
  handler: (response: RazorpaySuccessResponse) => void
  prefill?: {
    name?: string
    email?: string
    contact?: string
  }
  notes?: Record<string, string>
  theme?: {
    color?: string
  }
  modal?: {
    ondismiss?: () => void
  }
}

interface RazorpayInstance {
  open: () => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (window.Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

const API = (
  import.meta.env.VITE_API_URL || "http://localhost:4000"
).replace(/\/$/, "")

function MyBookings() {
  const { user, isAuthenticated, loading: authLoading } = useAuth()

  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [payingId, setPayingId] = useState<number | null>(null)

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

  // 💳 PAY NOW (RAZORPAY CHECKOUT FOR UNPAID BOOKING)
  const handlePayNow = async (booking: Booking) => {
    setPayingId(booking.id)
    try {
      // 1. Create Payment Order
      const orderRes = await fetch(`${API}/api/payments/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bookingId: booking.id }),
      })

      if (!orderRes.ok) {
        const orderError = await orderRes.json().catch(() => ({}))
        throw new Error(orderError.message || "Payment initialization failed")
      }

      const orderData = await orderRes.json()

      // 2. Load Script
      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error("Failed to load Razorpay payment SDK")
      }

      // 3. Open Modal
      const options: RazorpayOptions = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: booking.camp?.name || "Camp Booking",
        description: `Booking #${booking.id}`,
        image: booking.camp?.image,
        order_id: orderData.orderId,
        prefill: {
          name: booking.name || user?.name || "",
          email: user?.email || "",
          contact: booking.phone || user?.phone || "",
        },
        notes: {
          bookingId: String(booking.id),
        },
        theme: {
          color: "#22c55e",
        },
        handler: async (response: RazorpaySuccessResponse) => {
          try {
            const verifyRes = await fetch(`${API}/api/payments/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                bookingId: booking.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            })

            const verifyData = await verifyRes.json().catch(() => ({}))

            if (verifyRes.ok) {
              toast.success("Payment verified & booking confirmed! 🎉")
              await fetchBookings()
            } else {
              toast.error(verifyData.message || "Payment verification failed")
            }
          } catch {
            toast.error("Network error during payment verification")
          } finally {
            setPayingId(null)
          }
        },
        modal: {
          ondismiss: () => {
            toast.error("Checkout closed")
            setPayingId(null)
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment initialization failed"
      toast.error(message)
      setPayingId(null)
    }
  }

  // 💰 TOTAL (Excluding cancelled bookings from total spent calculation)
  const totalSpent = bookings.reduce(
    (sum, b) => (b.status === "cancelled" ? sum : sum + b.total),
    0
  )

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

        {bookings.map(b => {
          const isCancelled = b.status === "cancelled"
          const isConfirmed = b.status === "confirmed"
          const isCompleted = b.status === "completed"
          const isPaid = b.paymentStatus === "paid"

          return (
            <div
              key={b.id}
              className="bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg hover:scale-[1.02] transition flex flex-col justify-between"
            >
              <div>
                {/* 🖼 CAMP IMAGE */}
                {b.camp?.image && (
                  <img
                    src={b.camp.image}
                    alt={b.camp.name}
                    className="h-40 w-full object-cover"
                  />
                )}

                <div className="p-5">

                  {/* 🏕 CAMP NAME & BADGES */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    {b.camp?.name && (
                      <h2 className="text-xl font-bold line-clamp-1">{b.camp.name}</h2>
                    )}

                    <div className="flex flex-wrap items-center gap-1 justify-end shrink-0">
                      {/* RESERVATION STATUS BADGE */}
                      <span
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-full capitalize ${
                          isCancelled
                            ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800"
                            : isConfirmed
                            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800"
                            : isCompleted
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800"
                        }`}
                      >
                        {isCancelled
                          ? "Cancelled"
                          : isConfirmed
                          ? "Confirmed"
                          : isCompleted
                          ? "Completed"
                          : "Pending"}
                      </span>

                      {/* PAYMENT STATUS BADGE */}
                      <span
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-full capitalize ${
                          isPaid
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                        }`}
                      >
                        {isPaid ? "Paid" : "Unpaid"}
                      </span>
                    </div>
                  </div>

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

                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="p-5 pt-0 space-y-2">
                {!isPaid && !isCancelled && (
                  <button
                    onClick={() => handlePayNow(b)}
                    disabled={payingId === b.id}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 py-2 rounded transition disabled:opacity-50 text-white text-sm font-semibold shadow-sm"
                  >
                    {payingId === b.id ? "Opening Checkout..." : "Pay Now 💳"}
                  </button>
                )}

                {isCancelled ? (
                  <button
                    disabled
                    className="w-full bg-gray-300 dark:bg-gray-700/80 py-2 rounded text-gray-500 dark:text-gray-400 cursor-not-allowed text-sm font-semibold"
                  >
                    Cancelled
                  </button>
                ) : (
                  <button
                    onClick={() => cancelBooking(b.id)}
                    disabled={deletingId === b.id || payingId === b.id}
                    className="w-full bg-red-500 py-2 rounded hover:bg-red-600 transition disabled:opacity-50 text-white text-sm font-semibold"
                  >
                    {deletingId === b.id ? "Cancelling..." : "Cancel Booking"}
                  </button>
                )}
              </div>

            </div>
          )
        })}

      </div>
    </div>
  )
}

export default MyBookings
