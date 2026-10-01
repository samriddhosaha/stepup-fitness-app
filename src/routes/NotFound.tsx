import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className="min-h-dvh bg-canvas flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <h1 className="font-display font-semibold text-3xl mb-3">Page not found.</h1>
        <p className="text-faint mb-6">There’s nothing at this address. Nothing to worry about.</p>
        <Link to="/" className="inline-block font-semibold underline underline-offset-4 min-h-12 leading-[3rem]">
          Back to StepUp
        </Link>
      </div>
    </main>
  )
}
