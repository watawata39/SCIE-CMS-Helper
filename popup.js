// SCIE CMS Helper Popup Script

document.addEventListener('DOMContentLoaded', function() {
    const reasonInput = document.getElementById('reasonInput');
    const status = document.getElementById('status');

    // Load saved reason from storage
    loadSavedReason();

    // Handle reason input blur (when user finishes typing)
    reasonInput.addEventListener('blur', function() {
        if (this.value.trim()) {
            saveReason(this.value.trim());
        }
    });

    // Load saved reason from Chrome storage
    function loadSavedReason() {
        chrome.storage.sync.get(['bookingReason'], function(result) {
            if (result.bookingReason) {
                reasonInput.value = result.bookingReason;
            } else {
                // Default to practice if nothing is saved
                reasonInput.value = 'practice';
                saveReason('practice');
            }
        });
    }

    // Save reason to Chrome storage
    function saveReason(reason) {
        chrome.storage.sync.set({ bookingReason: reason }, function() {
            showStatus('Reason saved!', 'success');
        });
    }

    // Show status message
    function showStatus(message, type = 'success') {
        status.textContent = message;
        status.className = `status ${type}`;
        setTimeout(() => {
            status.textContent = '';
            status.className = 'status';
        }, 2000);
    }

});
