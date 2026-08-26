export function validateServerUrl(serverUrl: unknown): string {
  if (typeof serverUrl !== "string" || serverUrl.trim() === "") {
    throw new Error("serverUrl is required");
  }
  let url: URL;
  try {
    url = new URL(serverUrl);
  } catch {
    throw new Error(`"${serverUrl}" is not a valid URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("serverUrl must use http or https");
  }
  return url.toString();
}
