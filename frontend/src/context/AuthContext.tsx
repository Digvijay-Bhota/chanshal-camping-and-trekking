import { createContext, useContext, useEffect, useState, useCallback } from "react"
import type { ReactNode } from "react"

export interface User {
  id: number
  name: string
  email: string | null
  phone: string | null
  role: string
}

export interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  refreshUser: () => Promise<void>
}

export interface AuthProviderProps {
  children: ReactNode
}

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "")

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API}/api/users/me`, {
        credentials: "include",
      })

      if (res.ok) {
        const data: { user: User } = await res.json()
        if (data && data.user) {
          setUser(data.user)
          setIsAuthenticated(true)
        } else {
          setUser(null)
          setIsAuthenticated(false)
        }
      } else {
        setUser(null)
        setIsAuthenticated(false)
      }
    } catch {
      setUser(null)
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export default AuthContext
