let cookie = '';
let student_id = '';
let reasonForBooking = "practice"; // Default value, will be updated from storage

// Load saved booking reason from storage
function loadBookingReason() {
  chrome.storage.sync.get(['bookingReason'], function(result) {
    if (result.bookingReason) {
      reasonForBooking = result.bookingReason;
      console.log("Booking reason loaded:", reasonForBooking);
    }
  });
}

// Load reason on startup
loadBookingReason();

// Listen for storage changes to update reason in real-time
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (changes.bookingReason) {
    reasonForBooking = changes.bookingReason.newValue;
    console.log("Booking reason updated:", reasonForBooking);
  }
});

// Inject script to page that automates changing room/date
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const regex = /^https:\/\/www\.alevel\.com\.cn\/.*\/booking\/arrangement\/$/;
  if (changeInfo.status === 'complete' && regex.test(tab.url)) {
    console.log("injecting content script");
    chrome.scripting.executeScript({
      target: {tabId: tabId},
      files: ['content.js']
    });
  }
});

function show_alert(message, duration = 3000) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;
      chrome.tabs.sendMessage(tabs[0].id, { message: "showAlert", content: message, duration: duration });
  });
}

// Automates room booking
chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        const url = details.url;

        const regex = /^https:\/\/www\.alevel\.com\.cn\/.*\/booking\/.*-.*-.*$/;

        if (!regex.test(url)) {
          // Is not target url (the booking info page), pass
          return;
        }

        if (cookie == '') {
          show_alert("Unexcepted Error, try again later.");
          console.log("Fail to sent request due to lack of necessary info.");
          return;
        }

        // collect necessary info to send request

        // for Headers
        var platform; //sec-ch-ua-platform
        chrome.runtime.getPlatformInfo((info) => {
          var platform = info.os;

          if (platform === 'mac') {
            platform = 'macOS';
          } else if (platform === 'win') {
            platform = 'Windows';
          } else {
            // Other platforms, not in consideration
          }
        });

        cheaders = {
          "accept": "application/json, text/javascript, */*; q=0.01",
          "accept-encoding": "gzip, deflate, br, zstd",
          "accept-language": "en-GB,en-US;q=0.9,en;q=0.8,zh-TW;q=0.7,zh;q=0.6",
          "connection": "keep-alive",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "cookie": cookie,
          "host": "www.alevel.com.cn",
          "origin": "https://www.alevel.com.cn",
          "referer": url,
          "sec-ch-ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": platform,
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "user-agent": navigator.userAgent,
          "x-requested-with": "XMLHttpRequest"
        }

        // for Payload

        const splitUrl = url.split('/');
        const info = splitUrl[splitUrl.length-2];
        const infoArr = info.split('-');
        const room = infoArr[0];
        const period = infoArr[1].replace("and", "");
        const bookday = infoArr[2].substring(0,4) + '-' + infoArr[2].substring(4,6) + '-' + infoArr[2].substring(6,8);

        cpayload = {
          "classroom": room,
          "weeknum": period,
          "weeknum_select": period,
          "applicant": '',
          "bookday": bookday,
          "reason": reasonForBooking
        }

        // for url

        const destinationUrl = splitUrl.slice(0,splitUrl.length-2).join('/') + "/save/";

        // Send request to book room
        fetch(destinationUrl, {
          method: "POST",
          headers: cheaders,
          body: new URLSearchParams(cpayload).toString(),
        })
          .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
                show_alert("A network error has occurred.");
            }
            return response.json();
          })
          .then(data => {
            console.log(data);
            if (data.status == "fail") {
              show_alert("You can only book 2 days per day per room.");
              return;
            }
            show_alert("Booking successful!");
          })
          .catch(error => console.error("Error:", error));
    },
    { urls: ["*://*.alevel.com.cn/*"] }
);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    // Go back to last page: complement for function above
    const pattern = /^https:\/\/www\.alevel\.com\.cn\/.*\/booking\/.*-.*-.*$/;
    if (pattern.test(changeInfo.url)) {
      chrome.tabs.goBack();
      return;
    }

    // Refresh timetable
    const regex = /^https:\/\/www\.alevel\.com\.cn\/.*\/booking\/arrangement\/$/;
    if (regex.test(changeInfo.url)) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) return;
        chrome.tabs.sendMessage(tabs[0].id, { message: "pressCheck", timeout: 150 })
        .catch(() => {}); // there will be an error when first visiting the page on a tab, with the content script not yet injected
      });
    }
  }
});

async function cancel_booking(date, room, period) {
  // STEP 1: send request to get the id of the booking
  const request_headers = {
    "content-type": "application/x-www-form-urlencoded",
    "cookie": cookie,
    "host": "www.alevel.com.cn",
    "origin": "https://www.alevel.com.cn",
    "referer": "https://www.alevel.com.cn/user/s"+student_id+"/classroom/booking/list/"
  }
  const request_payload = {
    "s_page": 1,
    "s_date": date,
    "s_room": room,
    "s_state": '-1',
    "search": "Search"
  }
  const destinationUrl = "https://www.alevel.com.cn/user/s"+student_id+"/classroom/booking/list/";

  let booking_id = '';
  await fetch(destinationUrl, { method: "POST", headers: request_headers, body: new URLSearchParams(request_payload).toString() })
    .then(response => response.text())
    .then(html => {
        // send response to content script to process
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { message: "parseHTML", html: html, period: period }, (response) => {
                booking_id = response.booking_id;
                if (booking_id === '') {
                  show_alert("Failed to obtain booking id. Cancelling failed. Try again later.", 4000);
                  return;
                }

                // STEP 2: Send request to cancel the booking
                const request_headers2 = {
                  "content-type": "application/x-www-form-urlencoded",
                  "cookie": cookie,
                  "host": "www.alevel.com.cn",
                  "origin": "https://www.alevel.com.cn",
                  "referer": "https://www.alevel.com.cn/user/s"+student_id+"/classroom/booking/list/"
                }
                const request_payload2 = {
                  "cb_id": booking_id
                }
                const destinationUrl2 = "https://www.alevel.com.cn/user/s"+student_id+"/classroom/booking/delete/";

                fetch(destinationUrl2, {
                    method: "POST",
                    headers: request_headers2,
                    body: new URLSearchParams(request_payload2).toString(),
                })
                    .then(response => {
                        if (!response.ok) {
                            console.error("Fetch request failed with status:", response.status, response.statusText);
                            show_alert("Cancellation failed.");
                            throw new Error('Network response was not ok ' + response.statusText);
                        }
                        console.log(`Cancelling operation is successful. Cancelled booking of room ${room} on period ${period} of ${date}`);
                        show_alert("Your booking is cancelled!");
                        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {if (tabs.length === 0) return;chrome.tabs.sendMessage(tabs[0].id, { message: "pressCheck", timeout: 150 });});
                        return response.text();
                    })
                    .then(data => {
                        console.log("Response text received:", data);
                    })
                    .catch(error => {
                        console.error("Fetch error:", error);
                    });
            });
        });
    })
    .catch(error => console.error("Error fetching data:", error));
}

// Listens for the messages being sent by the content-script
chrome.runtime.onMessage.addListener(
  async function(message, sender, sendResponse) {
      // basic data for potential operations
      if (message.message === 'booking-info') {
        let data = message.data;
        cookie = data.cookie;
        student_id = data.student_id;
      }

      // request to cancel the booking for a room
      else if (message.message === 'cancel-booking') {
        await cancel_booking(message.data.date, message.data.room, message.data.period);
      }
  }
);