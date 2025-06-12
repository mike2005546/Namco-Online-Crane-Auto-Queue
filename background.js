const ALARM_NAME = 'namcoQueueCheck';
const DEFAULT_CHECK_INTERVAL = 1; // seconds
const MAX_RETRIES = 3;

// Function to manage tabs and check if the target page is full.
async function checkAndManageTabs(retryCount = 0) {
	try {
		// 1. Get the target URL and check interval from storage.
		const { targetUrl, checkInterval = DEFAULT_CHECK_INTERVAL } = await chrome.storage.local.get(['targetUrl', 'checkInterval']);
		if (!targetUrl) {
			stopAlarm();
			return;
		}

		// 2. Find all tabs on the Namco domain to manage them.
		const allNamcoTabs = await chrome.tabs.query({ url: "https://app.online-crane.namco.co.jp/*" });

		// 3. Find if our specific target tab is already open.
		const targetTab = allNamcoTabs.find(tab => tab.url && tab.url.split('#')[0] === targetUrl);

		if (targetTab) {
			// --- CASE A: The target tab already exists. ---
			console.log(`Target tab found (ID: ${targetTab.id}). Checking status.`);

			// Clean up by closing any other Namco tabs that might be open.
			const otherTabs = allNamcoTabs.filter(t => t.id !== targetTab.id);
			if (otherTabs.length > 0) {
				const tabIdsToClose = otherTabs.map(t => t.id);
				console.log(`Closing ${otherTabs.length} duplicate/extra Namco tabs.`);
				await chrome.tabs.remove(tabIdsToClose);
			}

			// Check if the target tab's booth is full by injecting a content script.
			try {
				const results = await chrome.scripting.executeScript({
					target: { tabId: targetTab.id },
					func: () => {
						document.body.innerText.includes('満員') ||
							document.body.innerText.includes('エラー')
					}
				});

				if (results && results[0] && results[0].result === true) {
					console.log('Booth is full. Reloading tab...');
					await chrome.tabs.reload(targetTab.id);
				} else {
					console.log('Booth is available or page content not ready.');
					// Notify user when booth becomes available
					chrome.notifications.create({
						type: 'basic',
						iconUrl: 'images/icon48.png',
						title: 'Namco Auto Queue',
						message: 'Booth is now available!',
						priority: 2
					});
				}
			} catch (e) {
				console.error(`Failed to inject script into tab ${targetTab.id}. It might be loading or protected.`, e);
				if (retryCount < MAX_RETRIES) {
					setTimeout(() => checkAndManageTabs(retryCount + 1), 1000);
				}
			}
		} else {
			// --- CASE B: The target tab does NOT exist. ---
			console.log("Target tab not found. Deciding how to proceed.");

			if (allNamcoTabs.length > 0) {
				const tabToReuse = allNamcoTabs[0];
				console.log(`Reusing existing Namco tab (ID: ${tabToReuse.id}) and navigating to target URL.`);
				await chrome.tabs.update(tabToReuse.id, { url: targetUrl, active: true });

				const extraTabs = allNamcoTabs.slice(1);
				if (extraTabs.length > 0) {
					const tabIdsToClose = extraTabs.map(t => t.id);
					console.log(`Closing ${extraTabs.length} extra Namco tabs.`);
					await chrome.tabs.remove(tabIdsToClose);
				}
			} else {
				console.log('No Namco tabs found. Opening a new tab with the target URL.');
				await chrome.tabs.create({ url: targetUrl });
			}
		}
	} catch (error) {
		console.error('Error in checkAndManageTabs:', error);
		if (retryCount < MAX_RETRIES) {
			setTimeout(() => checkAndManageTabs(retryCount + 1), 1000);
		}
	}
}

// Creates an alarm that fires periodically to run the check.
function createAlarm() {
	chrome.storage.local.get(['targetUrl', 'checkInterval'], ({ targetUrl, checkInterval = DEFAULT_CHECK_INTERVAL }) => {
		if (!targetUrl) return;

		chrome.alarms.get(ALARM_NAME, (alarm) => {
			if (!alarm) {
				console.log(`Creating new ${checkInterval} second alarm for Namco Auto Queue.`);
				chrome.alarms.create(ALARM_NAME, { periodInMinutes: checkInterval / 60 });
				checkAndManageTabs();
			}
		});
	});
}

// Stops the alarm.
function stopAlarm() {
	chrome.alarms.clear(ALARM_NAME, (wasCleared) => {
		if (wasCleared) console.log("Auto-queue alarm stopped.");
	});
}

// --- Event Listeners ---

// Listen for when the alarm fires.
chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name === ALARM_NAME) {
		checkAndManageTabs();
	}
});

// Listen for messages from the popup UI (e.g., when the user saves or resets the URL).
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	console.log('Received message:', message);

	if (message.action === "startCheck") {
		createAlarm();
		sendResponse({ success: true });
	} else if (message.action === "stopCheck") {
		stopAlarm();
		sendResponse({ success: true });
	} else if (message.action === "updateInterval") {
		console.log('Updating interval to:', message.interval);
		chrome.storage.local.set({ checkInterval: message.interval }, () => {
			if (chrome.runtime.lastError) {
				console.error('Error saving interval:', chrome.runtime.lastError);
				sendResponse({ success: false, error: chrome.runtime.lastError });
			} else {
				console.log('Interval saved, updating alarm');
				stopAlarm();
				createAlarm();
				sendResponse({ success: true });
			}
		});
		return true; // Keep the message channel open for the async response
	}
});

// Listen for the keyboard shortcut to reset the URL.
chrome.commands.onCommand.addListener(async (command) => {
	if (command === "reset-url") {
		await chrome.storage.local.remove('targetUrl');
		stopAlarm();
		chrome.notifications.create({
			type: 'basic',
			iconUrl: 'images/icon48.png',
			title: 'Namco Auto Queue',
			message: 'Target URL has been reset. The auto-queue has stopped.'
		});
	}
});

// When the browser first starts, check if we need to set up the alarm.
chrome.runtime.onStartup.addListener(() => {
	console.log("Browser startup: Initializing Namco Auto Queue.");
	createAlarm();
});

// When the extension is installed or updated, also check.
chrome.runtime.onInstalled.addListener(() => {
	console.log("Extension installed/updated: Initializing Namco Auto Queue.");
	createAlarm();
});
