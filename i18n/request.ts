import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale } from "../i18n";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : defaultLocale;

  const messages =
    locale === "zh"
      ? (await import("../messages/zh.json")).default
      : (await import("../messages/en.json")).default;

  return {
    locale,
    messages,
  };
});
