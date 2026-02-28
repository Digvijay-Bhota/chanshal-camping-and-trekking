function CampCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden shadow-lg bg-gray-200 dark:bg-gray-700 animate-pulse">

      <div className="h-48 w-full bg-gray-300 dark:bg-gray-600" />

      <div className="p-4 space-y-3">
        <div className="h-5 w-3/4 bg-gray-300 dark:bg-gray-600 rounded" />
        <div className="h-4 w-1/2 bg-gray-300 dark:bg-gray-600 rounded" />

        <div className="flex justify-between pt-2">
          <div className="h-5 w-16 bg-gray-300 dark:bg-gray-600 rounded" />
          <div className="h-9 w-20 bg-gray-300 dark:bg-gray-600 rounded-lg" />
        </div>
      </div>

    </div>
  )
}

export default CampCardSkeleton