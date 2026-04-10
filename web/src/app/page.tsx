import { SearchSection } from "@/components/search-section";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
      <div className="space-y-2 text-center sm:text-left">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Find papers that matter
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Semantic Scholar search with filters, load more, optional AI-guided
          queries, and research chat over a corpus you build from results.
        </p>
      </div>
      <SearchSection />
    </main>
  );
}
