import { connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  await connection();
  const session = await auth();
  if (!session) {
    redirect("/auth/signin");
  }
  redirect("/dashboard");
}
