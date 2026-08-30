import { redirect } from "next/navigation";

export const runtime = "edge";

export default function EmailSignup() {
  redirect("/sign-up");
}
