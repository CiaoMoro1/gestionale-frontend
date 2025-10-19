@echo off
REM Vai nella cartella del file .bat (gestisce anche spazi nel percorso)
pushd "%~dp0"

REM Controlla che npm sia disponibile
where npm >nul 2>&1
if errorlevel 1 (
  echo Errore: "npm" non trovato nel PATH. Installa Node.js o riapri il terminale.
  pause
  exit /b 1
)

REM Avvia il dev server (Vite/Next/etc.)
npm run dev

REM Se npm esce (per errore o Ctrl+C), resta visibile
pause
