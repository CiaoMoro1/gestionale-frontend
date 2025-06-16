type AddressSuggestionProps = {
  formData: {
    shipping_address: string;
    shipping_zip: string;
    shipping_city: string;
    shipping_province: string;
    shipping_country: string;
  };
  geoSuggestion: any;
  geoLoading: boolean;
  onAcceptSuggestion: (newForm: any) => void;
  setBadge: (badge: { type: "success" | "error"; message: string } | null) => void;
};

function computeAddressScore(userInput: any, suggestion: any) {
  if (!suggestion || suggestion.error) {
    return { status: "error", score: 0, message: "Indirizzo non trovato" };
  }
  const types = suggestion.types || [];
  if (
    types.includes("country") ||
    types.includes("administrative_area_level_1") ||
    types.includes("locality") ||
    types.includes("postal_town")
  ) {
    return { status: "error", score: 0, message: "Indirizzo troppo generico o non trovato" };
  }
  if (suggestion.partial_match) {
    return { status: "warning", score: 60, message: "Indirizzo trovato ma non perfettamente corrispondente" };
  }
  const ac = suggestion.address_components || [];
  const findType = (type: string) =>
    (ac.find((c: any) => c.types.includes(type))?.long_name || "");

  const capOk =
    userInput.shipping_zip &&
    findType("postal_code") &&
    findType("postal_code").startsWith(userInput.shipping_zip);

  const cityOk =
    userInput.shipping_city &&
    (
      findType("locality").toLowerCase() === userInput.shipping_city.toLowerCase() ||
      findType("postal_town").toLowerCase() === userInput.shipping_city.toLowerCase()
    );

  if (capOk && cityOk) {
    return { status: "ok", score: 100, message: "Indirizzo perfetto" };
  }
  if (capOk || cityOk) {
    return { status: "warning", score: 75, message: "Indirizzo trovato, ma alcuni campi non corrispondono" };
  }
  return { status: "warning", score: 50, message: "Indirizzo trovato, ma diversi campi non corrispondono" };
}

import { getGoogleProvinceSigla } from "../../utils/province"; // Se serve!

export default function AddressSuggestion({
  formData,
  geoSuggestion,
  geoLoading,
  onAcceptSuggestion,
  setBadge,
}: AddressSuggestionProps) {
  if (geoLoading) {
    return (
      <div className="text-fluid-sm text-gray-400 mb-2">
        Ricerca indirizzo su Google…
      </div>
    );
  }

  if (!geoSuggestion) return null;

  const quality = computeAddressScore(formData, geoSuggestion);

  return (
    <div className="mt-4 border border-blue-200 bg-blue-50 rounded-2xl shadow p-5">
      <div className="font-bold text-blue-900 text-fluid-base mb-2">
        Suggerimento Google Maps (Geocoding):
      </div>
      {/* SEMAFORO */}
      <div className="mb-3">
        {quality.status === "ok" && (
          <div className="flex items-center text-green-700 font-bold text-fluid-base gap-2">
            <span role="img" aria-label="ok">🟢</span>
            {quality.message} ({quality.score}%)
          </div>
        )}
        {quality.status === "warning" && (
          <div className="flex items-center text-yellow-700 font-bold text-fluid-base gap-2">
            <span role="img" aria-label="warning">🟡</span>
            {quality.message} ({quality.score}%)
          </div>
        )}
        {quality.status === "error" && (
          <div className="flex items-center text-red-700 font-bold text-fluid-base gap-2">
            <span role="img" aria-label="error">🔴</span>
            {quality.message}
          </div>
        )}
      </div>
      <div className="text-fluid-sm mb-2">
        <b>Indirizzo:</b> {geoSuggestion.formatted_address}
      </div>
      <button
        className="mt-2 bg-green-700 hover:bg-green-800 text-white rounded-xl px-4 py-3 text-fluid-base font-semibold shadow w-full sm:w-auto"
        onClick={() => {
          const ac = geoSuggestion.address_components || [];
          const prov = getGoogleProvinceSigla
            ? getGoogleProvinceSigla(ac)
            : (formData.shipping_province || "");
          const country =
            ac.find((c: any) => c.types.includes("country"))?.short_name?.toUpperCase().slice(0, 2) ||
            formData.shipping_country;
          onAcceptSuggestion({
            ...formData,
            shipping_address: [
              ac.find((c: any) => c.types.includes("route"))?.long_name,
              ac.find((c: any) => c.types.includes("street_number"))?.long_name,
              ac.find((c: any) => c.types.includes("subpremise"))?.long_name
            ].filter(Boolean).join(", ") || formData.shipping_address,
            shipping_zip: ac.find((c: any) => c.types.includes("postal_code"))?.long_name || formData.shipping_zip,
            shipping_city:
              ac.find((c: any) => c.types.includes("locality"))?.long_name ||
              ac.find((c: any) => c.types.includes("postal_town"))?.long_name ||
              formData.shipping_city,
            shipping_province: prov,
            shipping_country: country,
          });

          setBadge({ type: "success", message: "Indirizzo Google copiato nei campi (formato BRT)!" });
          setTimeout(() => setBadge(null), 2000);
        }}
      >
        Usa suggerimento
      </button>
    </div>
  );
}
