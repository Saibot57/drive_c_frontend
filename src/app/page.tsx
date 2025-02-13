export default function Home() {
  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">Welcome to Your Personal Dashboard</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Drive Catalog Card */}
        <div className="neo-brutalist-card">
          <div className="neo-brutalist-content">
            <h2 className="text-xl font-bold mb-2">Drive Catalog</h2>
            <p className="text-gray-600 mb-4">Browse and manage your Google Drive documents with tags and categories.</p>
            <a href="/drive" className="text-[#ff6b6b] hover:underline">Open Drive Catalog →</a>
          </div>
        </div>

        {/* Calendar Card */}
        <div className="neo-brutalist-card">
          <div className="neo-brutalist-content">
            <h2 className="text-xl font-bold mb-2">Calendar</h2>
            <p className="text-gray-600 mb-4">Manage your schedule and set reminders for important events.</p>
            <a href="/calendar" className="text-[#ff6b6b] hover:underline">Open Calendar →</a>
          </div>
        </div>
      </div>
    </div>
  )
}