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

function Booking() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  const [camp, setCamp] = useState<Camp | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

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
        throw new Error(errorData.message || "Booking failed")
      }

      toast.success("Booking successful 🎉")
      navigate("/my-bookings")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Booking failed"
      toast.error(message)
    } finally {
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
              disabled={submitting}
              className="w-full mt-3 bg-green-500 py-3 rounded text-lg hover:bg-green-600 transition disabled:opacity-50"
            >
              {submitting ? "Processing..." : "Confirm Booking"}
            </button>

          </div>

        </motion.div>
      </motion.div>
    </div>
  )
}

export default Booking
