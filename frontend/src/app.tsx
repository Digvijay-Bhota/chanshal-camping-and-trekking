import { Routes, Route, useLocation } from "react-router-dom"
import { AnimatePresence } from "framer-motion"
import { useEffect } from "react"

import Navbar from "./components/Navbar"
import PageWrapper from "./components/PageWrapper"
import ProtectedRoute from "./components/ProtectedRoute"
import AdminRoute from "./components/AdminRoute"

import Home from "./pages/Home"
import Booking from "./pages/Booking"
import MyBookings from "./pages/MyBookings"
import Login from "./pages/Login"
import AdminDashboard from "./pages/AdminDashboard"
import AdminProperties from "./pages/AdminProperties"
import PaymentSuccess from "./pages/PaymentSuccess"

/* ================= SCROLL TO TOP ================= */

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [pathname])

  return null
}

/* ================= APP ================= */

function App() {
  const location = useLocation()

  return (
    <>
      <Navbar />
      <ScrollToTop />

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>

          {/* 🏠 HOME */}
          <Route
            path="/"
            element={
              <PageWrapper>
                <Home />
              </PageWrapper>
            }
          />

          {/* 📖 BOOKING */}
          <Route
            path="/booking/:id"
            element={
              <PageWrapper>
                <Booking />
              </PageWrapper>
            }
          />

          {/* 🔒 MY BOOKINGS */}
          <Route
            path="/my-bookings"
            element={
              <ProtectedRoute>
                <PageWrapper>
                  <MyBookings />
                </PageWrapper>
              </ProtectedRoute>
            }
          />

          {/* 🎉 PAYMENT SUCCESS / RECEIPT */}
          <Route
            path="/booking/success/:bookingId"
            element={
              <ProtectedRoute>
                <PageWrapper>
                  <PaymentSuccess />
                </PageWrapper>
              </ProtectedRoute>
            }
          />

          {/* 🔐 LOGIN */}
          <Route
            path="/login"
            element={
              <PageWrapper>
                <Login />
              </PageWrapper>
            }
          />

          {/* 🛡️ ADMIN BOOKINGS */}
          <Route
            path="/admin/bookings"
            element={
              <AdminRoute>
                <PageWrapper>
                  <AdminDashboard />
                </PageWrapper>
              </AdminRoute>
            }
          />

          {/* ⛺ ADMIN PROPERTIES */}
          <Route
            path="/admin/properties"
            element={
              <AdminRoute>
                <PageWrapper>
                  <AdminProperties />
                </PageWrapper>
              </AdminRoute>
            }
          />

          {/* ❌ 404 */}
          <Route
            path="*"
            element={
              <PageWrapper>
                <div className="text-center text-2xl py-20">
                  404 — Page not found
                </div>
              </PageWrapper>
            }
          />

        </Routes>
      </AnimatePresence>
    </>
  )
}

export default App