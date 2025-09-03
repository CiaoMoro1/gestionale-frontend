import React, { useState } from 'react';
import axios from 'axios';

export default function GeneraNotaCreditoDaXmlPage() {
  const [file, setFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert('Seleziona un file XML!');
    setGenerating(true);
    const formData = new FormData();
    formData.append('file', file);

    const res = await axios.post('/api/notecredito/genera-da-xml', formData, { responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace('.xml', '_NC.xml');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setGenerating(false);
  };

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Genera Nota di Credito da XML Fattura</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input type="file" accept=".xml" onChange={handleFileChange} />
        <button type="submit" disabled={generating || !file} className="btn btn-primary">
          {generating ? 'Generazione…' : 'Genera Nota di Credito'}
        </button>
      </form>
    </div>
  );
}
