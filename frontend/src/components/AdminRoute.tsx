import { Navigate, useLocation } from "react-router-dom"
import type { ReactNode } from "react"
import { useAuth } from "../context/AuthContext"

type Props = {
  children: ReactNode
}

function AdminRoute({ children }: Props) {
  const location = useLocation()
  const { user, isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-black dark:bg-gray-900 dark:text-white">
        <div className="text-lg font-medium text-gray-600 dark:text-gray-300">
          Loading...
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    )
  }

  if (user.role !== "admin") {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export default AdminRoute
