import { useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import toast from "react-hot-toast"
import { Eye, EyeOff } from "lucide-react"
import { useAuth } from "../context/AuthContext"

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "")

function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const { isAuthenticated, refreshUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // 🎯 where to go after auth
  const from = location.state?.from?.pathname || "/my-bookings"

  // ✅ REDIRECT IF ALREADY LOGGED IN
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, from])

  // ✅ HANDLE LOGIN / REGISTER
  const handleSubmit = async () => {
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()

    if (isRegister && !trimmedName) {
      toast.error("Please enter your name")
      return
    }

    if (!trimmedEmail) {
      toast.error("Please enter your email")
      return
    }

    if (!password) {
      toast.error("Please enter your password")
      return
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long")
      return
    }

    setLoading(true)

    const endpoint = isRegister ? "/api/users/register" : "/api/users/login"
    const payload = isRegister
      ? { name: trimmedName, email: trimmedEmail, password }
      : { email: trimmedEmail, password }

    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(
          data.message || (isRegister ? "Registration failed" : "Login failed")
        )
      }

      if (data.user) {
        await refreshUser()
        toast.success(`Welcome ${data.user.name} 🎉`)
        navigate(from, { replace: true })
      } else {
        throw new Error("Invalid response from server")
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : isRegister
          ? "Registration failed"
          : "Login failed"
      toast.error(message)
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
          {isRegister ? "Create Account 🚀" : "Welcome 👋"}
        </h1>

        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
          {isRegister
            ? "Register to start booking camps"
            : "Login to view your bookings"}
        </p>

        {/* INPUTS */}
        <div className="space-y-4">
          {isRegister && (
            <input
              autoFocus
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              className="w-full p-3 rounded
                         bg-white dark:bg-gray-700
                         outline-none"
            />
          )}

          <input
            autoFocus={!isRegister}
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            className="w-full p-3 rounded
                       bg-white dark:bg-gray-700
                       outline-none"
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password (min 8 chars)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              className="w-full p-3 rounded
                         bg-white dark:bg-gray-700
                         outline-none pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2
                         text-gray-500 hover:text-gray-700
                         dark:text-gray-400 dark:hover:text-gray-200"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* BUTTON */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full mt-4 bg-green-500 py-3 rounded
                     hover:bg-green-600 transition
                     disabled:opacity-50 font-semibold text-white"
        >
          {loading
            ? isRegister
              ? "Registering..."
              : "Logging in..."
            : isRegister
            ? "Register"
            : "Login"}
        </button>

        {/* MODE TOGGLE */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm text-gray-500 hover:text-green-500
                       dark:text-gray-400 dark:hover:text-green-400 transition"
          >
            {isRegister
              ? "Already have an account? Login"
              : "Don't have an account? Register"}
          </button>
        </div>

      </div>
    </div>
  )
}

export default Login