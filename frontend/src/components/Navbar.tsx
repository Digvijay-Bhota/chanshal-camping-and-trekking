import { useEffect, useState, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Sun, Moon, User, Menu, X } from "lucide-react"

function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()

  const [scrolled, setScrolled] = useState(false)
  const [dark, setDark] = useState(false)
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)

  const user = localStorage.getItem("user")

  /* ================= THEME ================= */

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme")

    const systemDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches

    const isDark = savedTheme
      ? savedTheme === "dark"
      : systemDark

    document.documentElement.classList.toggle("dark", isDark)
    setDark(isDark)
  }, [])

  const toggleTheme = () => {
    const newDark = !dark
    document.documentElement.classList.toggle("dark", newDark)
    localStorage.setItem("theme", newDark ? "dark" : "light")
    setDark(newDark)
  }

  /* ================= SCROLL ================= */

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  /* ================= CLOSE MOBILE ON ROUTE CHANGE ================= */

  useEffect(() => {
    setMobile(false)
    setOpen(false)
  }, [location.pathname])

  /* ================= LOCK BODY SCROLL ================= */

  useEffect(() => {
    document.body.style.overflow = mobile ? "hidden" : "auto"
  }, [mobile])

  /* ================= OUTSIDE CLICK ================= */

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClick)
    return () =>
      document.removeEventListener("mousedown", handleClick)
  }, [])

  /* ================= LOGOUT ================= */

  const handleLogout = () => {
    localStorage.removeItem("user")
    navigate("/")
  }

  /* ================= ACTIVE LINK ================= */

  const linkStyle = (path: string) =>
    location.pathname.startsWith(path)
      ? "text-green-500 font-semibold"
      : "hover:text-green-500"

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all
      ${
        scrolled
          ? "bg-white/70 dark:bg-gray-900/70 backdrop-blur-lg shadow-lg"
          : "bg-transparent"
      }`}
    >
      <div className="container flex justify-between items-center p-4
                      text-gray-900 dark:text-white">

        {/* LOGO */}
        <button
          onClick={() => navigate("/")}
          className="text-xl font-bold"
        >
          🏕️ Chanshal
        </button>

        {/* DESKTOP */}
        <div className="hidden md:flex items-center gap-6">

          <button onClick={() => navigate("/")} className={linkStyle("/")}>
            Home
          </button>

          {user && (
            <button
              onClick={() => navigate("/my-bookings")}
              className={linkStyle("/my-bookings")}
            >
              My Bookings
            </button>
          )}

          {/* THEME */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* USER MENU */}
          <div className="relative" ref={menuRef}>
            <User
              className="cursor-pointer"
              onClick={() => setOpen(prev => !prev)}
            />

            {open && (
              <div className="absolute right-0 mt-3 w-44
                              bg-white dark:bg-gray-800
                              p-3 rounded-lg shadow-lg">

                {user ? (
                  <>
                    <p className="mb-2 font-semibold">{user}</p>

                    <button
                      onClick={() => navigate("/my-bookings")}
                      className="block w-full text-left hover:text-green-500"
                    >
                      My Bookings
                    </button>

                    <button
                      onClick={handleLogout}
                      className="block w-full text-left hover:text-red-500 mt-2"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => navigate("/login")}
                    className="block w-full text-left hover:text-green-500"
                  >
                    Login
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* MOBILE BUTTON */}
        <button
          className="md:hidden"
          onClick={() => setMobile(prev => !prev)}
          aria-label="Toggle menu"
        >
          {mobile ? <X /> : <Menu />}
        </button>
      </div>

      {/* MOBILE MENU */}
      {mobile && (
        <div className="md:hidden bg-white dark:bg-gray-900 p-4 space-y-3">

          <button onClick={() => navigate("/")}>Home</button>

          {user && (
            <button onClick={() => navigate("/my-bookings")}>
              My Bookings
            </button>
          )}

          <button onClick={toggleTheme}>
            {dark ? "Light Mode" : "Dark Mode"}
          </button>

          {user ? (
            <button
              onClick={handleLogout}
              className="text-red-500"
            >
              Logout
            </button>
          ) : (
            <button onClick={() => navigate("/login")}>
              Login
            </button>
          )}

        </div>
      )}
    </nav>
  )
}

export default Navbar