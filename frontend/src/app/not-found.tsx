import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <h1 className="text-lg font-bold">Page Not Found</h1>
      <p className="text-sm text-muted-foreground mt-1">
        The page you are looking for does not exist.
      </p>
      <Link
        href="/"
        className="mt-6 text-sm underline underline-offset-4 text-primary"
      >
        Go Home
      </Link>
    </div>
  )
}
