// src/utils/province.ts

// Tabella province italiane: nome -> sigla
export const PROVINCE_SIGLE: Record<string, string> = {
  "AGRIGENTO": "AG", "ALESSANDRIA": "AL", "ANCONA": "AN", "AOSTA": "AO", "AREZZO": "AR", "ASCOLI PICENO": "AP",
  "ASTI": "AT", "AVELLINO": "AV", "BARI": "BA", "BARLETTA-ANDRIA-TRANI": "BT", "BELLUNO": "BL", "BENEVENTO": "BN",
  "BERGAMO": "BG", "BIELLA": "BI", "BOLOGNA": "BO", "BOLZANO": "BZ", "BRESCIA": "BS", "BRINDISI": "BR", "CAGLIARI": "CA",
  "CALTANISSETTA": "CL", "CAMPOBASSO": "CB", "CARBONIA-IGLESIAS": "CI", "CASERTA": "CE", "CATANIA": "CT", "CATANZARO": "CZ",
  "CHIETI": "CH", "COMO": "CO", "COSENZA": "CS", "CREMONA": "CR", "CROTONE": "KR", "CUNEO": "CN", "ENNA": "EN",
  "FERMO": "FM", "FERRARA": "FE", "FIRENZE": "FI", "FOGGIA": "FG", "FORLÌ-CESENA": "FC", "FORLI-CESENA": "FC",
  "FROSINONE": "FR", "GENOVA": "GE", "GORIZIA": "GO", "GROSSETO": "GR", "IMPERIA": "IM", "ISERNIA": "IS",
  "LA SPEZIA": "SP", "L'AQUILA": "AQ", "LAQUILA": "AQ", "LATINA": "LT", "LECCE": "LE", "LECCO": "LC", "LIVORNO": "LI",
  "LODI": "LO", "LUCCA": "LU", "MACERATA": "MC", "MANTOVA": "MN", "MASSA-CARRARA": "MS", "MASSA CARRARA": "MS",
  "MATERA": "MT", "MESSINA": "ME", "MILANO": "MI", "MODENA": "MO", "MONZA E DELLA BRIANZA": "MB", "MONZA DELLA BRIANZA": "MB",
  "NAPOLI": "NA", "NOVARA": "NO", "NUORO": "NU", "OGLIASTRA": "OG", "ORISTANO": "OR", "PADOVA": "PD", "PALERMO": "PA",
  "PARMA": "PR", "PAVIA": "PV", "PERUGIA": "PG", "PESARO E URBINO": "PU", "PESARO URBINO": "PU", "PESCARA": "PE",
  "PIACENZA": "PC", "PISA": "PI", "PISTOIA": "PT", "PORDENONE": "PN", "POTENZA": "PZ", "PRATO": "PO", "RAGUSA": "RG",
  "RAVENNA": "RA", "REGGIO CALABRIA": "RC", "REGGIO EMILIA": "RE", "RIETI": "RI", "RIMINI": "RN", "ROMA": "RM", "ROVIGO": "RO",
  "SALERNO": "SA", "SASSARI": "SS", "SAVONA": "SV", "SIENA": "SI", "SIRACUSA": "SR", "SONDRIO": "SO", "TARANTO": "TA",
  "TERAMO": "TE", "TERNI": "TR", "TORINO": "TO", "TRAPANI": "TP", "TRENTO": "TN", "TREVISO": "TV", "TRIESTE": "TS",
  "UDINE": "UD", "VARESE": "VA", "VENEZIA": "VE", "VERBANIA": "VB", "VERBANO-CUSIO-OSSOLA": "VB", "VERCELLI": "VC",
  "VERONA": "VR", "VIBO VALENTIA": "VV", "VICENZA": "VI", "VITERBO": "VT"
};

// Normalizza nome/sigla provincia (Accetta sia "FI" che "Firenze" ecc)
export function normalizeProvince(nameOrSigla: string): string {
  if (!nameOrSigla) return "";
  const input = nameOrSigla.replace(/'/g, "").replace(/\s+/g, " ").trim().toUpperCase();
  if (input.length === 2) return input;
  if (PROVINCE_SIGLE[input]) return PROVINCE_SIGLE[input];
  if (PROVINCE_SIGLE[input.replace(/[^\w]/g, "")]) return PROVINCE_SIGLE[input.replace(/[^\w]/g, "")];
  return input.slice(0, 2);
}

// Estrae la sigla provincia da address_components Google
export function getGoogleProvinceSigla(ac: any[]): string {
  const provObj = ac.find(c => c.types.includes("administrative_area_level_2"));
  if (provObj?.short_name && provObj.short_name.length === 2) {
    const sigla = provObj.short_name.toUpperCase();
    if (Object.values(PROVINCE_SIGLE).includes(sigla)) {
      return sigla;
    }
  }
  if (provObj?.long_name) {
    const normalized = normalizeProvince(provObj.long_name);
    if (Object.values(PROVINCE_SIGLE).includes(normalized)) {
      return normalized;
    }
  }
  const prov1Obj = ac.find(c => c.types.includes("administrative_area_level_1"));
  if (prov1Obj?.short_name && prov1Obj.short_name.length === 2) {
    const sigla = prov1Obj.short_name.toUpperCase();
    if (Object.values(PROVINCE_SIGLE).includes(sigla)) {
      return sigla;
    }
  }
  if (prov1Obj?.long_name) {
    const normalized = normalizeProvince(prov1Obj.long_name);
    if (Object.values(PROVINCE_SIGLE).includes(normalized)) {
      return normalized;
    }
  }
  return "";
}
