import { useParams, useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { motion } from "framer-motion"
import { useAuth } from "../context/AuthContext"

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "")

type Camp = {
  id: number
  name: string
  price: number
  location: string
  rating: number
  image: string
}

/* 🎬 CONTENT REVEAL ANIMATION */
const contentVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { delay: 0.25, duration: 0.4 },
  },
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

function Booking() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  const [camp, setCamp] = useState<Camp | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [availability, setAvailability] = useState<{
    available: boolean
    availableCapacity?: number
    capacity?: number
    message?: string
    blocked?: boolean
  } | null>(null)

  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    date: "",
    people: 1,
    days: 1,
  })

  useEffect(() => {
    if (user?.name && !form.name) {
      setForm(prev => ({ ...prev, name: user.name }))
    }
  }, [user?.name, form.name])

  useEffect(() => {
    if (!id) return

    fetch(`${API}/api/camps/${id}`)
      .then(res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(data => setCamp(data))
      .catch(() => toast.error("Failed to load camp"))
      .finally(() => setLoading(false))
  }, [id])

  // 🔍 CHECK AVAILABILITY
  useEffect(() => {
    if (!id || !form.date || !form.days || form.days < 1) {
      setAvailability(null)
      return
    }

    const [inYear, inMonth, inDay] = form.date.split("-").map(Number)
    const inDateObj = new Date(inYear, inMonth - 1, inDay)
    inDateObj.setDate(inDateObj.getDate() + form.days)

    const outYear = inDateObj.getFullYear()
    const outMonth = String(inDateObj.getMonth() + 1).padStart(2, "0")
    const outDay = String(inDateObj.getDate()).padStart(2, "0")
    const checkOutStr = `${outYear}-${outMonth}-${outDay}`

    const controller = new AbortController()
    setCheckingAvailability(true)

    fetch(
      `${API}/api/properties/${id}/availability?checkIn=${encodeURIComponent(form.date)}&checkOut=${encodeURIComponent(checkOutStr)}`,
      {
        credentials: "include",
        signal: controller.signal,
      }
    )
      .then(async res => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.message || "Failed to check availability")
        }
        return res.json()
      })
      .then(data => {
        setAvailability({
          available: Boolean(data.available),
          availableCapacity: data.availableCapacity,
          capacity: data.capacity,
          blocked: Boolean(data.blocked),
        })
      })
      .catch(err => {
        if (err.name !== "AbortError") {
          toast.error(err.message || "Failed to check availability")
          setAvailability(null)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCheckingAvailability(false)
        }
      })

    return () => controller.abort()
  }, [id, form.date, form.days])

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-xl animate-pulse">
        ⛺ Loading Camp...
      </div>
    )

  if (!camp)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Camp not found ❌
      </div>
    )

  const total =
    camp.price *
    Number(form.people || 1) *
    Number(form.days || 1)

  const today = new Date().toISOString().split("T")[0]

  const isSubmitDisabled =
    submitting ||
    checkingAvailability ||
    (availability !== null && (!availability.available || form.people > (availability.availableCapacity ?? 0)))

  const handleSubmit = async () => {
    if (!isAuthenticated || !user) {
      toast.error("Please login to create a booking")
      return
    }

    if (!form.name || !form.phone || !form.date) {
      toast.error("Please fill all fields")
      return
    }

    setSubmitting(true)

    try {
      // 1. Create Booking
      const res = await fetch(`${API}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          campId: id,
          total,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        if (res.status === 409 && errorData.message === "Not enough capacity available for the selected dates") {
          throw new Error("These dates no longer have enough capacity. Please adjust your dates or guest count.")
        }
        if (res.status === 409 && errorData.message === "Property is closed for the selected dates") {
          throw new Error("Property is closed for the selected dates. Please choose different dates.")
        }
        throw new Error(errorData.message || "Booking creation failed")
      }

      const bookingData = await res.json()
      const newBookingId = bookingData.booking?.id

      if (!newBookingId) {
        throw new Error("Invalid booking response from server")
      }

      // 2. Create Razorpay Payment Order
      const orderRes = await fetch(`${API}/api/payments/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bookingId: newBookingId }),
      })

      if (!orderRes.ok) {
        const orderError = await orderRes.json().catch(() => ({}))
        toast.error(orderError.message || "Booking created, but payment initialization failed.")
        navigate("/my-bookings")
        return
      }

      const orderData = await orderRes.json()

      // 3. Load Razorpay Script
      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded || !window.Razorpay) {
        toast.error("Razorpay SDK failed to load. Please complete payment in My Bookings.")
        navigate("/my-bookings")
        return
      }

      // 4. Open Razorpay Checkout Modal
      const options: RazorpayOptions = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: camp.name,
        description: `Booking #${newBookingId} - ${camp.name}`,
        image: camp.image,
        order_id: orderData.orderId,
        prefill: {
          name: form.name,
          email: user.email || "",
          contact: form.phone,
        },
        notes: {
          bookingId: String(newBookingId),
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
                bookingId: newBookingId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            })

            const verifyData = await verifyRes.json().catch(() => ({}))

            if (verifyRes.ok) {
              toast.success("Payment successful & booking confirmed! 🎉")
              navigate(`/booking/success/${newBookingId}`)
            } else {
              toast.error(verifyData.message || "Payment verification failed")
              navigate("/my-bookings")
            }
          } catch {
            toast.error("Network error during payment verification")
            navigate("/my-bookings")
          } finally {
            setSubmitting(false)
          }
        },
        modal: {
          ondismiss: () => {
            toast.error("Checkout closed. You can complete payment anytime in My Bookings.")
            setSubmitting(false)
            navigate("/my-bookings")
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Booking failed"
      toast.error(message)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen pt-24 p-6 bg-white text-black dark:bg-gray-900 dark:text-white">

      {/* 🔙 BACK */}
      <button
        onClick={() => navigate(-1)}
        className="mb-6 bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded"
      >
        ⬅ Back
      </button>

      <motion.div
        layout
        className="max-w-3xl mx-auto bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg"
      >

        {/* 🖼 IMAGE */}
        <motion.img
          layoutId={`camp-image-${camp.id}`}
          src={camp.image}
          alt={camp.name}
          className="w-full h-64 object-cover"
        />

        {/* 🎬 CONTENT */}
        <motion.div
          variants={contentVariants}
          initial="hidden"
          animate="show"
          className="p-6"
        >

          <h1 className="text-3xl font-bold">{camp.name}</h1>
          <p className="mt-2">📍 {camp.location}</p>
          <p>⭐ {camp.rating}</p>

          <p className="text-green-500 text-xl font-bold">
            ₹{camp.price}
          </p>

          {/* 📝 FORM */}
          <div className="mt-6 space-y-4 pb-28">

            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-200">
                👤 Full Name
              </label>
              <input
                placeholder="Your Name"
                value={form.name}
                onChange={e =>
                  setForm({ ...form, name: e.target.value })
                }
                className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 outline-none focus:border-green-500 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-200">
                📞 Phone Number
              </label>
              <input
                placeholder="Phone Number"
                value={form.phone}
                onChange={e =>
                  setForm({ ...form, phone: e.target.value })
                }
                className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 outline-none focus:border-green-500 transition"
              />
            </div>

            {/* 📅 STAY PARAMETERS SECTION */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-300 mb-2">
                Stay Details
              </h3>

              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-200">
                  📅 Check-in Date
                </label>
                <input
                  type="date"
                  min={today}
                  value={form.date}
                  onChange={e =>
                    setForm({ ...form, date: e.target.value })
                  }
                  className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:[color-scheme:dark] outline-none focus:border-green-500 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-200">
                    👥 Number of Guests
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.people}
                    onChange={e =>
                      setForm({
                        ...form,
                        people: Number(e.target.value),
                      })
                    }
                    className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-500 transition"
                    placeholder="Number of People"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-200">
                    🗓 Duration (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.days}
                    onChange={e =>
                      setForm({
                        ...form,
                        days: Number(e.target.value),
                      })
                    }
                    className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-500 transition"
                    placeholder="Days"
                  />
                </div>
              </div>

              {/* 🔍 AVAILABILITY STATUS BADGE */}
              {(checkingAvailability || availability !== null) && (
                <div className="pt-1">
                  {checkingAvailability ? (
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 animate-pulse">
                      Checking availability...
                    </span>
                  ) : availability !== null ? (
                    <span
                      className={`text-xs font-bold ${
                        availability.available && form.people <= (availability.availableCapacity ?? 0)
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {!availability.available
                        ? availability.blocked
                          ? "Property is closed for the selected dates."
                          : "Not available for these dates"
                        : form.people > (availability.availableCapacity ?? 0)
                        ? `Only ${availability.availableCapacity} guests are available for these dates.`
                        : `Available — ${availability.availableCapacity} guests remaining`}
                    </span>
                  ) : null}
                </div>
              )}
            </div>

          </div>

          {/* 💰 STICKY TOTAL BAR */}
          <div className="sticky bottom-0 bg-gray-100/90 dark:bg-gray-800/90 backdrop-blur pt-4 border-t border-gray-300 dark:border-gray-700">

            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-green-500">₹ {total}</span>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              className="w-full mt-3 bg-green-500 py-3 rounded text-lg hover:bg-green-600 transition disabled:opacity-50 font-semibold"
            >
              {submitting ? "Initializing Payment..." : "Proceed to Payment 💳"}
            </button>

          </div>

        </motion.div>
      </motion.div>
    </div>
  )
}

export default Booking
