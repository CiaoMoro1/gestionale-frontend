import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function DevLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: "admin@gmail.com",
      password: "admin",
    });

    if (error) {
      setError(error.message);
    } else {
      alert("✅ Login effettuato");
    }

    setLoading(false);
  };

  return (
    <div className="my-4">
      <button
        onClick={handleLogin}
        disabled={loading}
        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition disabled:opacity-50"
      >
        {loading ? "Accesso..." : "Login Admin (dev)"}
      </button>
      {error && <p className="text-red-600 mt-2">❌ {error}</p>}
    </div>
  );
}
