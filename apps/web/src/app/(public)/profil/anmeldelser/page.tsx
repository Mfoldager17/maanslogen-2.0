import { redirect } from "next/navigation";

export default function MyReviewsPage() {
  // Anmeldelserne står på profilsiden; denne sti findes kun for menuen.
  redirect("/profil");
}
