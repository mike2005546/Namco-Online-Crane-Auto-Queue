// ==UserScript==
// @name         Namco Online Crane Auto Queue
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Auto-reload and auto-queue for Namco Online Crane when booth is full, with user input for target URL
// @author       546
// @match        https://app.online-crane.namco.co.jp/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'namco_target_url';

    // Helper to get or prompt for the target URL
    function getTargetUrl() {
        let url = localStorage.getItem(STORAGE_KEY);
        if (!url || url === 'reset') {
            url = prompt(
                "Enter the full target play URL you want to auto-queue for:\n(e.g. https://app.online-crane.namco.co.jp/play?pi=xxxx&sc=xxxx)\n\nType 'reset' to set again next time.",
                url && url !== 'reset' ? url : ''
            );
            if (url) {
                localStorage.setItem(STORAGE_KEY, url);
            }
        }
        return url;
    }

    // Helper to check if we are on the correct play page
    function isOnTargetPage(targetUrl) {
        return window.location.href.split('#')[0] === targetUrl;
    }

    // Helper to check if '満員' is present in the page
    function isFull() {
        return document.body && document.body.innerText.includes('満員');
    }

    // Main logic
    const targetUrl = getTargetUrl();
    if (!targetUrl || targetUrl === 'reset') {
        alert('No target URL set. Please reload the page to set it.');
        return;
    }

    let foundFull = false;
    let interval = setInterval(() => {
        if (!isOnTargetPage(targetUrl)) {
            // Not on the play page, open new tab and close this one
            window.open(targetUrl, '_blank');
            window.close();
            clearInterval(interval);
            return;
        }
        if (isFull()) {
            foundFull = true;
        }
    }, 500);

    setInterval(() => {
        if (!isOnTargetPage(targetUrl) || foundFull) {
            window.open(targetUrl, '_blank');
            window.close();
        }
        foundFull = false; // reset for next 5s window
    }, 5000);

    // Optional: Add a keyboard shortcut to reset the URL (Ctrl+Shift+U)
    window.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'u') {
            localStorage.setItem(STORAGE_KEY, 'reset');
            alert('Target URL reset. Reload the page to set a new URL.');
        }
    });
})();
