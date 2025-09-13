// utils/loadAdobeSDK.ts
export function loadAdobeSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    // If already loaded, resolve immediately
    if (window.AdobeDC) {
      resolve();
      return;
    }

    // Prevent loading script multiple times
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://documentcloud.adobe.com/view-sdk/main.js"]'
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", () => reject());
      return;
    }

    // Inject script dynamically
    const script = document.createElement("script");
    script.src = "https://documentcloud.adobe.com/view-sdk/main.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Adobe SDK"));
    document.body.appendChild(script);
  });
}
