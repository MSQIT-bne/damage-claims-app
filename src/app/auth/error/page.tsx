import Link from "next/link";

const messages: Record<string, string> = {
  Configuration: "There is a problem with the server configuration. Please contact your administrator.",
  AccessDenied: "You do not have permission to access this application.",
  Verification: "The sign-in link has expired or has already been used.",
  Default: "An unexpected error occurred during sign in.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = messages[error ?? "Default"] ?? messages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm max-w-sm w-full text-center">
        <div className="mb-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Sign-in error</h1>
          <p className="mt-2 text-sm text-gray-500">{message}</p>
          {error && (
            <p className="mt-1 text-xs text-gray-400 font-mono">Code: {error}</p>
          )}
        </div>
        <Link
          href="/auth/signin"
          className="inline-block w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
