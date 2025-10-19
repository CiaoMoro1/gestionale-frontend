/* src/app/AppProviders.tsx */
import { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import queryClient from "./queryClient";
// import { ReactQueryDevtools } from "@tanstack/react-query-devtools"; // opzionale

type Props = {
  children: ReactNode;
};

export default function AppProviders({ children }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* <ReactQueryDevtools initialIsOpen={false} position="bottom-right" /> */}
    </QueryClientProvider>
  );
}
