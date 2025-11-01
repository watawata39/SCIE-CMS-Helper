if (!document.querySelector('#my-script-marker')) {


function showFadingAlert(message, duration = 3000) {
    let alertBox = document.createElement("div");
    alertBox.textContent = message;
    alertBox.style.position = "fixed";
    alertBox.style.top = "20px";
    alertBox.style.left = "50%";
    alertBox.style.transform = "translateX(-50%)";
    alertBox.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
    alertBox.style.color = "white";
    alertBox.style.padding = "10px 20px";
    alertBox.style.borderRadius = "5px";
    alertBox.style.zIndex = "9999";
    alertBox.style.fontSize = "16px";
    alertBox.style.boxShadow = "0px 4px 10px rgba(0, 0, 0, 0.2)";
    alertBox.style.transition = "opacity 0.5s ease-in-out";
    document.body.appendChild(alertBox);
    setTimeout(() => {
        alertBox.style.opacity = "0"; // Start fade out effect
        setTimeout(() => alertBox.remove(), 500); // Remove after fade-out
    }, duration);
}

function isPastDate(dateString) {
    let givenDate = new Date(dateString);
    let today = new Date();
    today.setHours(0, 0, 0, 0);
    return givenDate < today; // Returns true if givenDate is in the past
}

let url = window.location.pathname; 
let match = url.match(/\/s(\d+)\/classroom/); // Regex for student number
let student_id = '';
if (match) {
    student_id = match[1];
} else {
    console.log("Unexpected Error: Student Number not found in URL");
}

// Create marker (used for identifying whether the script is already injected)
const marker = document.createElement('div');
marker.id = 'my-script-marker';
marker.style.display = 'none';
document.body.appendChild(marker);

console.log("CMS Helper: Content script injecting...");

document.addEventListener('mousedown', function(event) {
  const roomClass = 'searchable-select-item';
  const dateClass = 'ui-state-default'
  if (event.target.classList.contains(roomClass) || event.target.classList.contains(dateClass)) {
    pressCheck(150);
  }
});

function pressCheck(timeout = 150) {
  if (timeout == null || typeof timeout != "number") return;
  setTimeout(() => {
    try {
      const button = document.querySelector('body > div.main1 > div:nth-child(3) > div:nth-child(2) > div:nth-child(8) > input.action-button'); 

      if (button) {
        console.log("CMS Helper: Pressing check...");
        button.click();
      } else {
        console.error('CMS Helper: Check button not found!');
      }
    }
    catch(err) {
      console.log("CMS Helper: Error executing getclass.");
      console.log("CMS Helper: " + err.name);
      console.log("CMS Helper: " + err.message);
    }
  }, timeout);
}

// Double click cell to delete booking
document.getElementById("tt_table").addEventListener("dblclick", function(event) {
    let td = event.target.closest("td");
    if (!td) return;

    if (!td.innerHTML.includes(student_id)) {
      showFadingAlert("Invalid cell. \nYou can only cancel your own bookings. \nDo not click on the column and row headings.", 7500);
      return; // If the cell doesn't contain user's student id, terminate
    }

    let table = document.getElementById("tt_table");
    let headerRow = table.querySelector("tr.t_14");

    let cellIndex = Array.from(td.parentNode.children).indexOf(td);
    if (cellIndex == 0) return; // Ignore the first column (Week/Period column)

    let headerCell = headerRow.children[cellIndex];
    let dateSpan = headerCell.querySelector("span[id^='date_']");
    
    if (!dateSpan) {
        showFadingAlert("Unexpected error: cannot find date of this item. ");
        return;
    }

    const date = dateSpan.textContent.trim(); // Date of the booking
    if (isPastDate(date)) {
      showFadingAlert("This booking is in the past!");
      return;
    }
    const period = td.id.split('_')[2]; // Period of the booking
    const room = document.querySelector("#searchtable-select-build-s_room > div.searchable-select-holder").textContent.split(' ')[0]; // room of booking

    // Send message to background script to perform subsequent operations 
    chrome.runtime.sendMessage({
      message: 'cancel-booking',
      data: {date: date, room: room, period: period}
    });
});

console.log("CMS Helper: Gathering info for potential operations...");
chrome.runtime.sendMessage({
  message: 'booking-info',
  data: {cookie: document.cookie, student_id: student_id}
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // get the booking id from the data sent by the background script
    if (request.message === "parseHTML") {
        let booking_id = '';
        let parser = new DOMParser();
        let doc = parser.parseFromString(request.html, "text/html");
        let rows = doc.querySelectorAll("table.teachertb tr");
        for (let row of rows) {
            let targetTd = row.querySelector("td.teaherev.t_left.tafeyl_ay > span");
            if (targetTd && targetTd.textContent.includes(request.period)) {
                let lastTd = row.querySelector("td.teaherev.t_center.tafeyl_ay.ca a[href^='/user/s']");
                if (lastTd) {
                    let href = lastTd.getAttribute("href");
                    let match = href.match(/\/(\d+)\/$/);
                    if (match) {
                        booking_id = match[1];
                    }
                }
            }
        }
        sendResponse({ success: true, booking_id: booking_id});
    }
    else if (request.message === "showAlert") {
      showFadingAlert(request.content, request.duration);
    }
    else if (request.message === "pressCheck") {
      pressCheck(request.timeout);
    }
});

// prevent this error: The page keeping the extension port is moved into back/forward cache, so the message channel is closed.
window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
        chrome.runtime.sendMessage({ action: "reconnect" }).catch(() => {});
    }
});






}