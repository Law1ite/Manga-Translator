const API_KEY = "a502f3a05dmsh376986561f2499cp179e02jsn85b6152db40a";

const apiKeyInput =
    document.getElementById("apiKey");

const saveButton =
    document.getElementById("save");

const translateButton =
    document.getElementById("translate");

const status =
    document.getElementById("status");

chrome.storage.local.get(
    ["googleTranslateApiKey"],
    result => {
        const savedApiKey =
            result.googleTranslateApiKey || API_KEY;

        apiKeyInput.value = savedApiKey;

        chrome.storage.local.set(
            {
                googleTranslateApiKey: savedApiKey
            }
        );
    }
);

saveButton.addEventListener(
    "click",
    () => {
        const apiKey =
            apiKeyInput.value.trim() || API_KEY;

        chrome.storage.local.set(
            {
                googleTranslateApiKey: apiKey
            },
            () => {
                status.textContent =
                    "API key saved.";

                setTimeout(() => {
                    status.textContent =
                        "";
                }, 2000);
            }
        );
    }
);

translateButton.addEventListener(
    "click",
    () => {
        const apiKey =
            apiKeyInput.value.trim() || API_KEY;

        chrome.storage.local.set(
            {
                googleTranslateApiKey: apiKey
            },
            () => {
                chrome.tabs.query(
                    {active: true, currentWindow: true},
                    tabs => {
                        if (!tabs || !tabs[0]) {
                            status.textContent = "No active tab found.";
                            return;
                        }

                        status.textContent = "Translating page...";

                        chrome.tabs.sendMessage(
                            tabs[0].id,
                            {action: "translatePage"},
                            response => {
                                if (chrome.runtime.lastError) {
                                    console.error(chrome.runtime.lastError.message);
                                    status.textContent = "Could not start translation on this page.";
                                    return;
                                }

                                status.textContent = response?.ok ? "Translation started." : "Translation failed.";

                                setTimeout(() => {
                                    status.textContent = "";
                                }, 2500);
                            }
                        );
                    }
                );
            }
        );
    }
);