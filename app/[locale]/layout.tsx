import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

async function getMessages(locale: Locale) {
  try {
    if (locale === "zh") {
      return (await import("@/messages/zh.json")).default;
    }

    return (await import("@/messages/en.json")).default;
  } catch {
    // Fail-safe for production: never crash locale pages because of i18n loading.
    return {};
  }
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  const messages = await getMessages(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
