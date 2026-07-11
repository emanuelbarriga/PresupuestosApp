export default function CompanyLoading() {
  return (
    <div className="flex h-screen w-full bg-[#F4F6F8] overflow-hidden">
      {/* Sidebar skeleton */}
      <aside className="bg-white border-r border-slate-200 w-64 flex flex-col p-4 animate-pulse">
        <div className="h-4 w-20 bg-slate-200 rounded mb-6" />
        <div className="space-y-3">
          <div className="h-10 bg-slate-100 rounded-lg" />
          <div className="h-10 bg-slate-100 rounded-lg" />
          <div className="h-10 bg-slate-100 rounded-lg" />
        </div>
      </aside>
      {/* Content skeleton */}
      <main className="flex-1 p-6 space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 rounded" />
        <div className="h-4 w-96 bg-slate-100 rounded" />
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="h-32 bg-slate-100 rounded-xl" />
          <div className="h-32 bg-slate-100 rounded-xl" />
          <div className="h-32 bg-slate-100 rounded-xl" />
        </div>
      </main>
    </div>
  );
}
