// src/components/confermaordine/AddressSuggestion.tsx
import { getGoogleProvinceSigla } from "../../utils/province";

// Tipi minimi per Google Geocoding (quanto basta per il tuo uso)
type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GeoSuggestion = {
  formatted_address?: string;
  address_components?: AddressComponent[];
  types?: string[];
  partial_match?: boolean;
  error?: unknown;
};

type OrderForm = {
  shipping_address: string;
  shipping_zip: string;
  shipping_city: string;
  shipping_province: string;
  shipping_country: string;
};

type AddressSuggestionProps = {
  formData: OrderForm;
  geoSuggestion: GeoSuggestion | null;
  geoLoading: boolean;
  onAcceptSuggestion: (newForm: OrderForm) => void;
  setBadge: (badge: { type: "success" | "error"; message: string } | null) => void;
};

// ------- Score/quality calcolato sul suggerimento -------
function computeAddressScore(userInput: OrderForm, suggestion: GeoSuggestion) {
  if (!suggestion || (suggestion as GeoSuggestion).error) {
    return { status: "error" as const, score: 0, message: "Indirizzo non trovato" };
  }

  const types = suggestion.types ?? [];
  if (
    types.includes("country") ||
    types.includes("administrative_area_level_1") ||
    types.includes("locality") ||
    types.includes("postal_town")
  ) {
    return {
      status: "error" as const,
      score: 0,
      message: "Indirizzo troppo generico o non trovato",
    };
  }

  if (suggestion.partial_match) {
    return {
      status: "warning" as const,
      score: 60,
      message: "Indirizzo trovato ma non perfettamente corrispondente",
    };
  }

  const ac = suggestion.address_components ?? [];
  const findType = (type: string) =>
    ac.find((c: AddressComponent) => c.types.includes(type))?.long_name ?? "";

  const postal = findType("postal_code");
  const locality = findType("locality").toLowerCase();
  const postalTown = findType("postal_town").toLowerCase();

  const capOk =
    Boolean(userInput.shipping_zip) &&
    Boolean(postal) &&
    postal.startsWith(userInput.shipping_zip);

  const cityOk =
    Boolean(userInput.shipping_city) &&
    (locality === userInput.shipping_city.toLowerCase() ||
      postalTown === userInput.shipping_city.toLowerCase());

  if (capOk && cityOk) {
    return { status: "ok" as const, score: 100, message: "Indirizzo perfetto" };
  }
  if (capOk || cityOk) {
    return {
      status: "warning" as const,
      score: 75,
      message: "Indirizzo trovato, ma alcuni campi non corrispondono",
    };
  }
  return {
    status: "warning" as const,
    score: 50,
    message: "Indirizzo trovato, ma diversi campi non corrispondono",
  };
}

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

      {/* Semaforo qualità */}
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
        <b>Indirizzo:</b> {geoSuggestion.formatted_address ?? ""}
      </div>

      <button
        className="mt-2 bg-green-700 hover:bg-green-800 text-white rounded-xl px-4 py-3 text-fluid-base font-semibold shadow w-full sm:w-auto"
        onClick={() => {
          const ac = geoSuggestion.address_components ?? [];

          const get = (t: string) =>
            ac.find((c: AddressComponent) => c.types.includes(t));

          const route = get("route")?.long_name;
          const streetNumber = get("street_number")?.long_name;
          const subpremise = get("subpremise")?.long_name;
          const postalCode = get("postal_code")?.long_name;
          const locality = get("locality")?.long_name;
          const postalTown = get("postal_town")?.long_name;
          const countryShort = get("country")?.short_name?.toUpperCase() ?? "";

          const prov = getGoogleProvinceSigla
            ? getGoogleProvinceSigla(ac)
            : formData.shipping_province;

          const country =
            (countryShort || formData.shipping_country).slice(0, 2);

          const nextForm: OrderForm = {
            ...formData,
            shipping_address:
              [route, streetNumber, subpremise].filter(Boolean).join(", ") ||
              formData.shipping_address,
            shipping_zip: postalCode || formData.shipping_zip,
            shipping_city: locality || postalTown || formData.shipping_city,
            shipping_province: prov,
            shipping_country: country,
          };

          onAcceptSuggestion(nextForm);
          setBadge({ type: "success", message: "Indirizzo Google copiato nei campi (formato BRT)!" });
          setTimeout(() => setBadge(null), 2000);
        }}
      >
        Usa suggerimento
      </button>
    </div>
  );
}
