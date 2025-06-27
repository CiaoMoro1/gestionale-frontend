import React from "react";

export function Card({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`rounded-2xl shadow-md bg-white p-6 ${className}`}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}
