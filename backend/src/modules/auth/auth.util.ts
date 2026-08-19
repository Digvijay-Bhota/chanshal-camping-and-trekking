import jwt, { JwtPayload } from "jsonwebtoken"

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.trim() === "") {
    throw new Error(
      "FATAL: JWT_SECRET environment variable is missing or empty.",
    )
  }
  return secret.trim()
}

export type AuthTokenPayload = JwtPayload & {
  userId: number
  role: string
}

export function signAuthToken(userId: number, role: string): string {
  const secret = getJwtSecret()
  return jwt.sign({ userId, role }, secret, {
    algorithm: "HS256",
    expiresIn: "7d",
  })
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const secret = getJwtSecret()
  const decoded = jwt.verify(token, secret, {
    algorithms: ["HS256"],
  })

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    !("userId" in decoded) ||
    !("role" in decoded)
  ) {
    throw new Error("Invalid token payload structure")
  }

  const payload = decoded as AuthTokenPayload
  if (
    typeof payload.userId !== "number" ||
    !Number.isInteger(payload.userId) ||
    payload.userId <= 0 ||
    typeof payload.role !== "string" ||
    payload.role.trim() === ""
  ) {
    throw new Error("Invalid token payload structure")
  }

  return {
    userId: payload.userId,
    role: payload.role.trim(),
  }
}
