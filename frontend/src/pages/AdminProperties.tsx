import { useEffect, useState, useCallback } from "react"
import toast from "react-hot-toast"
import { Plus, Edit3, Power, MapPin, Star, RefreshCw, X, ShieldCheck, PowerOff } from "lucide-react"

export interface Property {
  id: number
  name: string
  description: string | null
  propertyType: string
  location: string
  pricePerNight: number
  rating: number
  imageUrl: string | null
  isActive: boolean
}

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "")

function AdminProperties() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false)
  const [editingProperty, setEditingProperty] = useState<Property | null>(null)
  const [deactivatingProperty, setDeactivatingProperty] = useState<Property | null>(null)

  // Add form state
  const [addForm, setAddForm] = useState({
    name: "",
    description: "",
    propertyType: "camp",
    location: "",
    pricePerNight: 1000,
    rating: 4.5,
    imageUrl: "",
  })

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    propertyType: "camp",
    location: "",
    pricePerNight: 1000,
    rating: 4.5,
    imageUrl: "",
  })

  const fetchProperties = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/properties`, {
        credentials: "include",
      })

      if (res.status === 401 || res.status === 403) {
        toast.error("Access denied: Admin role required")
        setProperties([])
        return
      }

      if (!res.ok) {
        throw new Error("Failed to fetch properties")
      }

      const data: Property[] = await res.json()
      setProperties(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load properties"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProperties()
  }, [fetchProperties])

  // CREATE PROPERTY
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!addForm.name.trim() || !addForm.location.trim() || !addForm.propertyType.trim()) {
      toast.error("Please fill all required fields")
      return
    }

    if (addForm.pricePerNight < 0) {
      toast.error("Price per night must be non-negative")
      return
    }

    if (addForm.rating < 0 || addForm.rating > 5) {
      toast.error("Rating must be between 0 and 5")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${API}/api/admin/properties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: addForm.name.trim(),
          description: addForm.description.trim() || null,
          propertyType: addForm.propertyType.trim(),
          location: addForm.location.trim(),
          pricePerNight: Number(addForm.pricePerNight),
          rating: Number(addForm.rating),
          imageUrl: addForm.imageUrl.trim() || null,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.status === 201) {
        toast.success(data.message || "Property created successfully 🎉")
        setShowAddModal(false)
        setAddForm({
          name: "",
          description: "",
          propertyType: "camp",
          location: "",
          pricePerNight: 1000,
          rating: 4.5,
          imageUrl: "",
        })
        await fetchProperties()
      } else if (res.status === 401 || res.status === 403) {
        toast.error("Unauthorized: Admin access required")
      } else {
        toast.error(data.message || "Failed to create property")
      }
    } catch {
      toast.error("Network error creating property")
    } finally {
      setSubmitting(false)
    }
  }

  // OPEN EDIT MODAL
  const openEditModal = (property: Property) => {
    setEditingProperty(property)
    setEditForm({
      name: property.name,
      description: property.description || "",
      propertyType: property.propertyType,
      location: property.location,
      pricePerNight: property.pricePerNight,
      rating: property.rating,
      imageUrl: property.imageUrl || "",
    })
  }

  // EDIT PROPERTY
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProperty) return

    if (!editForm.name.trim() || !editForm.location.trim() || !editForm.propertyType.trim()) {
      toast.error("Please fill all required fields")
      return
    }

    if (editForm.pricePerNight < 0) {
      toast.error("Price per night must be non-negative")
      return
    }

    if (editForm.rating < 0 || editForm.rating > 5) {
      toast.error("Rating must be between 0 and 5")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${API}/api/admin/properties/${editingProperty.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim() || null,
          propertyType: editForm.propertyType.trim(),
          location: editForm.location.trim(),
          pricePerNight: Number(editForm.pricePerNight),
          rating: Number(editForm.rating),
          imageUrl: editForm.imageUrl.trim() || null,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.status === 200) {
        toast.success(data.message || "Property updated successfully ✨")
        setEditingProperty(null)
        await fetchProperties()
      } else if (res.status === 404) {
        toast.error("Property not found")
      } else if (res.status === 401 || res.status === 403) {
        toast.error("Unauthorized: Admin access required")
      } else {
        toast.error(data.message || "Failed to update property")
      }
    } catch {
      toast.error("Network error updating property")
    } finally {
      setSubmitting(false)
    }
  }

  // TOGGLE STATUS (ACTIVATION / DEACTIVATION)
  const handleToggleStatus = async (property: Property) => {
    const targetStatus = !property.isActive
    setUpdatingId(property.id)

    try {
      const res = await fetch(`${API}/api/admin/properties/${property.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: targetStatus }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.status === 200) {
        toast.success(data.message || (targetStatus ? "Property activated" : "Property deactivated"))
        setDeactivatingProperty(null)
        await fetchProperties()
      } else if (res.status === 404) {
        toast.error("Property not found")
      } else if (res.status === 401 || res.status === 403) {
        toast.error("Unauthorized: Admin access required")
      } else {
        toast.error(data.message || "Failed to update status")
      }
    } catch {
      toast.error("Network error updating status")
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-16 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-200">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              ⛺ Admin Camp & Property Management
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Create, edit, activate, and deactivate properties across the platform.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchProperties}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700 shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-sm transition"
            >
              <Plus size={18} />
              Add New Camp
            </button>
          </div>
        </div>

        {/* PROPERTY LIST */}
        {loading ? (
          <div className="py-20 text-center text-gray-500 dark:text-gray-400 font-medium">
            Loading properties...
          </div>
        ) : properties.length === 0 ? (
          <div className="py-20 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              No properties found. Click "Add New Camp" to create one.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map(p => {
              const isUpdating = updatingId === p.id

              return (
                <div
                  key={p.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl border overflow-hidden shadow-sm transition flex flex-col justify-between ${
                    p.isActive
                      ? "border-gray-200 dark:border-gray-700"
                      : "border-rose-200 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10"
                  }`}
                >
                  <div>
                    {/* IMAGE & BADGES */}
                    <div className="relative h-48 bg-gray-100 dark:bg-gray-700 overflow-hidden">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className={`w-full h-full object-cover ${!p.isActive ? "grayscale opacity-75" : ""}`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500 font-medium">
                          No Image Available
                        </div>
                      )}

                      {/* STATUS BADGE */}
                      <div className="absolute top-3 left-3">
                        {p.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-md">
                            <ShieldCheck size={12} /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-600 text-white shadow-md">
                            <PowerOff size={12} /> Deactivated
                          </span>
                        )}
                      </div>

                      {/* RATING BADGE */}
                      <div className="absolute top-3 right-3 bg-white/90 dark:bg-gray-900/90 text-gray-900 dark:text-white text-xs px-2 py-1 rounded-lg font-semibold shadow-md flex items-center gap-1">
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        {p.rating}
                      </div>
                    </div>

                    {/* CONTENT */}
                    <div className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-1">
                          {p.name}
                        </h2>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-semibold uppercase tracking-wider">
                          {p.propertyType}
                        </span>
                      </div>

                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <MapPin size={14} className="text-red-500 shrink-0" />
                        {p.location}
                      </p>

                      {p.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                          {p.description}
                        </p>
                      )}

                      <div className="pt-2 text-lg font-extrabold text-green-600 dark:text-green-400">
                        ₹{p.pricePerNight} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">/ night</span>
                      </div>
                    </div>
                  </div>

                  {/* ACTION BAR */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                    <button
                      onClick={() => openEditModal(p)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 shadow-sm transition"
                    >
                      <Edit3 size={14} /> Edit
                    </button>

                    {p.isActive ? (
                      <button
                        onClick={() => setDeactivatingProperty(p)}
                        disabled={isUpdating}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-900/60 rounded-lg disabled:opacity-50 transition"
                      >
                        <Power size={14} /> Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleStatus(p)}
                        disabled={isUpdating}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 rounded-lg disabled:opacity-50 transition"
                      >
                        <Power size={14} /> Reactivate
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ================= ADD PROPERTY MODAL ================= */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-700 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  ➕ Add New Camp / Property
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Camp Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chanshal Meadow Camp"
                    value={addForm.name}
                    onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                    className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                      Property Type *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. camp, homestay, lodge"
                      value={addForm.propertyType}
                      onChange={e => setAddForm({ ...addForm, propertyType: e.target.value })}
                      className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                      Location *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Chanshal Valley"
                      value={addForm.location}
                      onChange={e => setAddForm({ ...addForm, location: e.target.value })}
                      className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                      Price per Night (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={addForm.pricePerNight}
                      onChange={e => setAddForm({ ...addForm, pricePerNight: Number(e.target.value) })}
                      className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                      Rating (0 to 5)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={addForm.rating}
                      onChange={e => setAddForm({ ...addForm, rating: Number(e.target.value) })}
                      className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Image URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={addForm.imageUrl}
                    onChange={e => setAddForm({ ...addForm, imageUrl: e.target.value })}
                    className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Camp features, amenities, and details..."
                    value={addForm.description}
                    onChange={e => setAddForm({ ...addForm, description: e.target.value })}
                    className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {submitting ? "Creating..." : "Create Property"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= EDIT PROPERTY MODAL ================= */}
        {editingProperty && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-700 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  ✏️ Edit Property (#{editingProperty.id})
                </h3>
                <button
                  onClick={() => setEditingProperty(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Camp Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                      Property Type *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.propertyType}
                      onChange={e => setEditForm({ ...editForm, propertyType: e.target.value })}
                      className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                      Location *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.location}
                      onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                      className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                      Price per Night (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={editForm.pricePerNight}
                      onChange={e => setEditForm({ ...editForm, pricePerNight: Number(e.target.value) })}
                      className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                      Rating (0 to 5)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={editForm.rating}
                      onChange={e => setEditForm({ ...editForm, rating: Number(e.target.value) })}
                      className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Image URL
                  </label>
                  <input
                    type="url"
                    value={editForm.imageUrl}
                    onChange={e => setEditForm({ ...editForm, imageUrl: e.target.value })}
                    className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-green-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setEditingProperty(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= DEACTIVATION CONFIRMATION MODAL ================= */}
        {deactivatingProperty && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700 shadow-2xl space-y-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                ⚠️ Confirm Deactivation
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-300">
                Are you sure you want to deactivate <strong className="text-gray-900 dark:text-white">{deactivatingProperty.name}</strong>?
                This property will no longer appear in customer listings or accept new bookings. Existing bookings will remain intact.
              </p>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setDeactivatingProperty(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleStatus(deactivatingProperty)}
                  className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700"
                >
                  Deactivate Property
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default AdminProperties
