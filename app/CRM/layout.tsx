import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CRM Pórtate Mal | Valentina",
  description:
    "CRM de WhatsApp para Pórtate Mal: conversaciones, leads y seguimiento comercial.",
};

export default function CRMLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
