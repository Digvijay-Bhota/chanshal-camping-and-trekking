import { useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import toast from "react-hot-toast"

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "")

function Login() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()

  // 🎯 where to go after login
  const from = location.state?.from?.pathname || "/my-bookings"

  // ✅ REDIRECT IF ALREADY LOGGED IN
  useEffect(() => {
    const user = localStorage.getItem("user")
    if (user) navigate(from, { replace: true })
  }, [navigate, from])

  // ✅ HANDLE LOGIN
  const handleLogin = async () => {
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName) {
      toast.error("Please enter your name")
      return
    }

    if (!trimmedEmail) {
      toast.error("Please enter your email")
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`${API}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || "Login failed")
      }

      if (data.user) {
        localStorage.setItem("user", data.user.name)
        localStorage.setItem("user_id", String(data.user.id))
        if (data.user.email) {
          localStorage.setItem("user_email", data.user.email)
        }

        toast.success(`Welcome ${data.user.name} 🎉`)
        navigate(from, { replace: true })
      } else {
        throw new Error("Invalid response from server")
      }
    } catch (err: any) {
      toast.error(err.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center
                    bg-white text-black
                    dark:bg-gray-900 dark:text-white p-6">

      <div className="w-full max-w-sm
                      bg-gray-100 dark:bg-gray-800
                      p-6 rounded-xl shadow-lg">

        <h1 className="text-2xl font-bold mb-2 text-center">
          Welcome 👋
        </h1>

        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
          Login to view your bookings
        </p>

        {/* INPUTS */}
        <div className="space-y-4">
          <input
            autoFocus
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            className="w-full p-3 rounded
                       bg-white dark:bg-gray-700
                       outline-none"
          />

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            className="w-full p-3 rounded
                       bg-white dark:bg-gray-700
                       outline-none"
          />
        </div>

        {/* BUTTON */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full mt-4 bg-green-500 py-3 rounded
                     hover:bg-green-600 transition
                     disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

      </div>
    </div>
  )
}

export default Login