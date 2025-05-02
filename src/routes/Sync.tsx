import SyncButton from "../components/SyncButton";
import DevLogin from "../components/DevLogin";

export default function SyncPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-700">Sincronizza Prodotti</h1>
      <DevLogin />
      <SyncButton />
    </div>
  );
}
