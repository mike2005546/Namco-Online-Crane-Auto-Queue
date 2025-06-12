document.addEventListener('DOMContentLoaded', () => {
	const urlInput = document.getElementById('urlInput');
	const saveButton = document.getElementById('saveButton');
	const resetButton = document.getElementById('resetButton');
	const statusMessage = document.getElementById('statusMessage');
	const intervalSlider = document.getElementById('intervalSlider');
	const intervalValue = document.getElementById('intervalValue');
	const statusIndicator = document.getElementById('statusIndicator');
	const statusText = document.getElementById('statusText');

	// Load saved settings from storage
	chrome.storage.local.get(['targetUrl', 'checkInterval'], (result) => {
		if (result.targetUrl) {
			urlInput.value = result.targetUrl;
			updateStatus(true);
		}
		if (result.checkInterval) {
			intervalSlider.value = result.checkInterval;
			intervalValue.textContent = result.checkInterval;
		}
	});

	// Update interval value display
	intervalSlider.addEventListener('input', () => {
		const value = intervalSlider.value;
		intervalValue.textContent = value;
	});

	// Save interval when slider is released
	intervalSlider.addEventListener('change', () => {
		const value = parseInt(intervalSlider.value);
		console.log('Sending interval update:', value);
		chrome.runtime.sendMessage({
			action: "updateInterval",
			interval: value
		}, (response) => {
			if (chrome.runtime.lastError) {
				console.error('Error updating interval:', chrome.runtime.lastError);
				statusMessage.style.color = 'rgb(220 38 38)';
				statusMessage.textContent = 'Failed to update interval';
			} else {
				console.log('Interval updated successfully');
				statusMessage.style.color = 'rgb(34 197 94)';
				statusMessage.textContent = `Check interval set to ${value} seconds`;
				setTimeout(() => {
					statusMessage.textContent = '';
				}, 2000);
			}
		});
	});

	// Function to update status indicator
	function updateStatus(isActive) {
		if (isActive) {
			statusIndicator.className = 'status-indicator status-active';
			statusText.textContent = 'Active';
			statusText.className = 'text-sm text-green-600';
		} else {
			statusIndicator.className = 'status-indicator status-inactive';
			statusText.textContent = 'Inactive';
			statusText.className = 'text-sm text-gray-600';
		}
	}

	// Save the new target URL to storage when the "Save" button is clicked.
	saveButton.addEventListener('click', () => {
		const url = urlInput.value.trim();
		// Basic validation for the URL format
		if (url && url.startsWith('https://app.online-crane.namco.co.jp/play?')) {
			chrome.storage.local.set({ targetUrl: url }, () => {
				statusMessage.textContent = 'URL saved!';
				updateStatus(true);
				// Signal the background script to start the check immediately
				chrome.runtime.sendMessage({ action: "startCheck" });
				setTimeout(() => window.close(), 750); // Close popup after a short delay
			});
		} else {
			statusMessage.style.color = 'rgb(220 38 38)'; // red-600
			statusMessage.textContent = 'Invalid Namco play URL.';
		}
	});

	// Clear the saved URL from storage when the "Reset" button is clicked.
	resetButton.addEventListener('click', () => {
		chrome.storage.local.remove(['targetUrl'], () => {
			urlInput.value = '';
			statusMessage.textContent = 'URL reset. Auto-queue is now off.';
			updateStatus(false);
			// Signal the background script to stop the check
			chrome.runtime.sendMessage({ action: "stopCheck" });
		});
	});
});
