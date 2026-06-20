const getApiBaseUrl = () => {
  const envApiUrl = import.meta.env.VITE_API_URL;

  if (envApiUrl && envApiUrl !== "auto") {
    return envApiUrl;
  }

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const apiHostname = hostname === "localhost" ? "127.0.0.1" : hostname;

  return `${protocol}//${apiHostname}:8000`;
};

export const API_BASE_URL = getApiBaseUrl();
export const API_URL = API_BASE_URL;
