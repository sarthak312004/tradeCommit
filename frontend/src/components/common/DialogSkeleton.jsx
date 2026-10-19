function Pulse({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-zinc-200 dark:bg-white/[0.08] ${className}`} />
}

function ContextSkeleton() {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Journal context"
      aria-busy="true"
      className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-2xl dark:border-white/[0.14] dark:bg-panel"
    >
      <span role="status" className="sr-only">Loading journal context…</span>
      <header aria-hidden="true" className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-6 py-4 dark:border-white/[0.08]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/[0.05]" />
          <div className="min-w-0">
            <Pulse className="h-4 w-32" />
            <Pulse className="mt-2 h-3 w-48 bg-zinc-100 dark:bg-white/[0.05]" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Pulse className="hidden h-8 w-8 md:block" />
          <Pulse className="h-8 w-8" />
        </div>
      </header>

      <div aria-hidden="true" className="subtle-scrollbar min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-6">
        <section>
          <div className="mb-3 flex items-start gap-2.5">
            <Pulse className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <Pulse className="h-4 w-20" />
              <Pulse className="mt-2 h-3 w-full max-w-[390px] bg-zinc-100 dark:bg-white/[0.05]" />
            </div>
          </div>
          <div className="rounded-xl border border-zinc-300 bg-zinc-50/60 p-2 dark:border-white/[0.14] dark:bg-white/[0.02]">
            <div className="mb-2 flex h-9 items-center gap-1 border-b border-zinc-200 px-1 dark:border-white/[0.08]">
              {Array.from({ length: 7 }, (_, index) => (
                <Pulse key={index} className={`h-6 ${index === 3 ? 'w-9' : 'w-7'} bg-zinc-100 dark:bg-white/[0.05]`} />
              ))}
            </div>
            <div className="min-h-[260px] space-y-3 px-2 py-3">
              <Pulse className="h-3 w-4/5 bg-zinc-100 dark:bg-white/[0.05]" />
              <Pulse className="h-3 w-full bg-zinc-100 dark:bg-white/[0.05]" />
              <Pulse className="h-3 w-2/3 bg-zinc-100 dark:bg-white/[0.05]" />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <Pulse className="h-3 w-56 bg-zinc-100 dark:bg-white/[0.05]" />
            <Pulse className="h-3 w-12 bg-zinc-100 dark:bg-white/[0.05]" />
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-2.5">
              <Pulse className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <Pulse className="h-4 w-32" />
                <Pulse className="mt-2 h-3 w-full max-w-[420px] bg-zinc-100 dark:bg-white/[0.05]" />
                <Pulse className="mt-1.5 h-3 w-4/5 bg-zinc-100 dark:bg-white/[0.05]" />
              </div>
            </div>
            <Pulse className="h-5 w-10 shrink-0 rounded-full bg-zinc-100 dark:bg-white/[0.05]" />
          </div>
          <div className="border-y border-zinc-200/70 py-4 dark:border-white/[0.06]">
            <Pulse className="h-3 w-full bg-zinc-100 dark:bg-white/[0.05]" />
            <Pulse className="mt-2 h-3 w-4/5 bg-zinc-100 dark:bg-white/[0.05]" />
          </div>
          <Pulse className="mt-3 h-8 w-32 rounded-lg bg-zinc-100 dark:bg-white/[0.05]" />
          <div className="mt-6">
            <Pulse className="mb-3 h-4 w-32 bg-zinc-100 dark:bg-white/[0.05]" />
            <div className="grid gap-2 sm:grid-cols-2">
              {[0, 1].map((option) => (
                <div key={option} className="flex h-11 items-center gap-2.5 rounded-xl border border-zinc-300 px-3 dark:border-white/[0.14]">
                  <Pulse className="h-[18px] w-[18px] shrink-0 rounded-full bg-zinc-100 dark:bg-white/[0.05]" />
                  <Pulse className="h-3 w-28 bg-zinc-100 dark:bg-white/[0.05]" />
                </div>
              ))}
            </div>
            <Pulse className="mt-2 h-3 w-full max-w-[460px] bg-zinc-100 dark:bg-white/[0.05]" />
          </div>
        </section>
      </div>

      <footer aria-hidden="true" className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-200 px-6 py-3 dark:border-white/[0.08]">
        <Pulse className="h-3 w-36 bg-zinc-100 dark:bg-white/[0.05]" />
        <div className="flex shrink-0 items-center gap-2">
          <Pulse className="h-8 w-16 rounded-lg bg-zinc-100 dark:bg-white/[0.05]" />
          <Pulse className="h-8 w-28 rounded-lg" />
        </div>
      </footer>
    </div>
  )
}

function MentorSkeleton() {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mentor review"
      aria-busy="true"
      className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-2xl dark:border-white/[0.14] dark:bg-panel"
    >
      <span role="status" className="sr-only">Loading mentor review…</span>
      <header aria-hidden="true" className="flex shrink-0 items-start justify-between gap-4 px-8 pb-5 pt-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <Pulse className="h-[18px] w-[18px] shrink-0" />
            <Pulse className="h-5 w-32" />
          </div>
          <Pulse className="mt-2 h-3 w-36 bg-zinc-100 dark:bg-white/[0.05]" />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="flex items-center rounded-lg border border-zinc-300 p-0.5 dark:border-white/[0.14]">
            <Pulse className="h-7 w-7 bg-zinc-100 dark:bg-white/[0.05]" />
            <Pulse className="mx-1 h-3 w-28 bg-zinc-100 dark:bg-white/[0.05]" />
            <Pulse className="h-7 w-7 bg-zinc-100 dark:bg-white/[0.05]" />
          </div>
          <Pulse className="ml-1 h-8 w-8 bg-zinc-100 dark:bg-white/[0.05]" />
        </div>
      </header>
      <div aria-hidden="true" className="flex h-10 shrink-0 gap-1 overflow-hidden border-b border-zinc-200 px-8 dark:border-white/[0.08]">
        <div className="flex h-10 items-center border-b-2 border-zinc-900 px-3.5 dark:border-zinc-100">
          <Pulse className="h-3 w-12 bg-zinc-100 dark:bg-white/[0.05]" />
        </div>
        {[0, 1].map((tab) => (
          <div key={tab} className="flex h-10 items-center px-3.5">
            <Pulse className="h-3 w-16 bg-zinc-100 dark:bg-white/[0.05]" />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="quiet-scrollbar min-h-[360px] flex-1 space-y-7 overflow-y-auto overflow-x-hidden px-8 pb-8">
        <div className="pt-6">
          <div className="mb-6 flex items-center gap-2.5">
            <Pulse className="h-4 w-4 bg-zinc-100 dark:bg-white/[0.05]" />
            <Pulse className="h-3 w-44 bg-zinc-100 dark:bg-white/[0.05]" />
          </div>
          <div className="space-y-3">
            {[0, 1, 2, 3, 4, 5, 6].map((line) => (
              <Pulse key={line} className={`h-3 bg-zinc-100 dark:bg-white/[0.05] ${line === 5 ? 'w-4/5' : 'w-full'}`} />
            ))}
          </div>
          <div className="mt-8 space-y-3 rounded-xl border border-zinc-200 p-5 dark:border-white/[0.08]">
            <Pulse className="h-4 w-36 bg-zinc-100 dark:bg-white/[0.05]" />
            <Pulse className="h-3 w-full bg-zinc-100 dark:bg-white/[0.05]" />
            <Pulse className="h-3 w-5/6 bg-zinc-100 dark:bg-white/[0.05]" />
            <Pulse className="h-3 w-2/3 bg-zinc-100 dark:bg-white/[0.05]" />
          </div>
        </div>
      </div>
      <footer aria-hidden="true" className="flex shrink-0 items-center justify-between gap-4 border-t border-zinc-200 px-8 py-3.5 dark:border-white/[0.08]">
        <Pulse className="h-3 w-64 bg-zinc-100 dark:bg-white/[0.05]" />
      </footer>
    </div>
  )
}

function FeedbackSkeleton() {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share your feedback"
      aria-busy="true"
      className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-2xl dark:border-white/[0.14] dark:bg-panel"
    >
      <span role="status" className="sr-only">Loading feedback form…</span>
      <header aria-hidden="true" className="flex shrink-0 items-center justify-between px-7 pt-6">
        <div className="flex items-center gap-2.5">
          <Pulse className="h-7 w-7 rounded-md bg-zinc-100 dark:bg-white/[0.05]" />
          <Pulse className="h-4 w-20 bg-zinc-100 dark:bg-white/[0.05]" />
        </div>
        <Pulse className="h-7 w-7 bg-zinc-100 dark:bg-white/[0.05]" />
      </header>
      <div aria-hidden="true" className="subtle-scrollbar min-h-[380px] flex-1 overflow-y-auto px-7 pb-6 pt-6">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 6 }, (_, step) => (
            <Pulse key={step} className={`h-1 flex-1 rounded-full ${step === 0 ? 'bg-zinc-500 dark:bg-zinc-300' : 'bg-zinc-100 dark:bg-white/[0.05]'}`} />
          ))}
        </div>
        <div className="mt-8">
          <Pulse className="mb-3 h-3 w-28 bg-zinc-100 dark:bg-white/[0.05]" />
          <Pulse className="h-8 w-4/5 bg-zinc-100 dark:bg-white/[0.05]" />
          <Pulse className="mt-2 h-8 w-2/3 bg-zinc-100 dark:bg-white/[0.05]" />
          <Pulse className="mt-3 h-3 w-3/4 bg-zinc-100 dark:bg-white/[0.05]" />
        </div>
        <div className="mt-7 flex min-h-[132px] flex-col items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50/70 py-7 dark:border-white/[0.08] dark:bg-white/[0.02]">
          <div className="flex gap-3">
            {Array.from({ length: 5 }, (_, star) => (
              <Pulse key={star} className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-white/[0.08]" />
            ))}
          </div>
          <Pulse className="mt-3 h-3 w-16 bg-zinc-100 dark:bg-white/[0.05]" />
        </div>
        <div className="mt-8 flex items-center justify-between">
          <Pulse className="h-4 w-12 bg-zinc-100 dark:bg-white/[0.05]" />
          <Pulse className="h-10 w-24 rounded-md" />
        </div>
      </div>
      <footer aria-hidden="true" className="flex shrink-0 items-center justify-between border-t border-zinc-200 px-7 py-3 dark:border-white/[0.08]">
        <Pulse className="h-3 w-24 bg-zinc-100 dark:bg-white/[0.05]" />
        <Pulse className="h-3 w-36 bg-zinc-100 dark:bg-white/[0.05]" />
      </footer>
    </div>
  )
}

function DialogSkeleton({ variant }) {
  if (!['context', 'mentor', 'feedback'].includes(variant)) {
    throw new Error(`Unknown dialog skeleton variant: ${variant}`)
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] ${variant === 'mentor' ? 'p-4 sm:p-6' : 'p-4'}`}>
      {variant === 'context' && <ContextSkeleton />}
      {variant === 'mentor' && <MentorSkeleton />}
      {variant === 'feedback' && <FeedbackSkeleton />}
    </div>
  )
}

export default DialogSkeleton
