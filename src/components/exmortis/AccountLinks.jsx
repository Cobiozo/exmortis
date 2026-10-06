import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

// „Zaloguj” / „Moje konto” (+ „Panel” dla admina) w menu.
export default function AccountLinks({ className }) {
  const { user } = useAuth();
  if (!user) return <Link to="/login" className={className}>Zaloguj</Link>;
  return (
    <>
      <Link to="/konto" className={className}>Moje konto</Link>
      {user.role === "admin" && <Link to="/admin" className={className}>Panel</Link>}
    </>
  );
}