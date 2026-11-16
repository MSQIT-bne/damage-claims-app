"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import type { SessionUser } from "@/lib/auth";

const roleBadge: Record<string, string> = {
  ADMINISTRATOR: "bg-purple-100 text-purple-800",
  CLAIMS_MANAGER: "bg-blue-100 text-blue-800",
  CLAIMS_STAFF: "bg-gray-100 text-gray-700",
};

export function NavBar({ user }: { user: SessionUser }) {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-semibold text-gray-900">
              Claims Portal
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Queue
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadge[user.role] ?? roleBadge.CLAIMS_STAFF}`}
            >
              {user.role.replace(/_/g, " ")}
            </span>
            <span className="text-sm text-gray-700">{user.name ?? user.email}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
