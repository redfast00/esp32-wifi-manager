// save some bytes
const gel = (e) => document.getElementById(e);

const wifi_div = gel("wifi");
const connect_div = gel("connect");
const connect_manual_div = gel("connect_manual");
const connect_wait_div = gel("connect-wait");
const connect_details_div = gel("connect-details");

function docReady(fn) {
  // see if DOM is already available
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    // call on next available tick
    setTimeout(fn, 1);
  } else {
    document.addEventListener("DOMContentLoaded", fn);
  }
}

var selectedSSID = "";
var selectedAuthmode = null;
var refreshAPInterval = null;
var checkStatusInterval = null;

function stopCheckStatusInterval() {
  if (checkStatusInterval != null) {
    clearInterval(checkStatusInterval);
    checkStatusInterval = null;
  }
}

function stopRefreshAPInterval() {
  if (refreshAPInterval != null) {
    clearInterval(refreshAPInterval);
    refreshAPInterval = null;
  }
}

function startCheckStatusInterval() {
  checkStatusInterval = setInterval(checkStatus, 950);
}

function startRefreshAPInterval() {
  refreshAPInterval = setInterval(refreshAP, 3800);
}

docReady(async function () {
  gel("wifi-status").addEventListener(
    "click",
    () => {
      wifi_div.style.display = "none";
      document.getElementById("connect-details").style.display = "block";
    },
    false
  );

  gel("manual_add").addEventListener(
    "click",
    (e) => {
      selectedSSID = e.target.innerText;

      gel("ssid-pwd").textContent = selectedSSID;
      wifi_div.style.display = "none";
      connect_manual_div.style.display = "block";
      connect_div.style.display = "none";

      gel("connect-success").display = "none";
      gel("connect-fail").display = "none";
    },
    false
  );

  gel("wifi-list").addEventListener(
    "click",
    (e) => {
      // Find the parent element with data attributes
      let target = e.target;
      while (target && !target.hasAttribute("data-ssid")) {
        target = target.parentElement;
      }

      if (target && target.hasAttribute("data-ssid")) {
        selectedSSID = target.getAttribute("data-ssid");
        selectedAuthmode = parseInt(target.getAttribute("data-authmode")) || 0;

        // Show connect dialog for all networks
        gel("ssid-pwd").textContent = selectedSSID;

        // For open networks, hide password input and show password button
        if (selectedAuthmode === 0) {
          // Open network - hide password field and toggle button
          gel("pwd").style.display = "none";
          gel("togglepwd").style.display = "none";
          // Update header text for open networks
          document.querySelector("#connect header h1").textContent =
            "Connect to Network";
          document.querySelector(
            "#connect h2"
          ).textContent = `Connect to ${selectedSSID}`;
        } else {
          // Password-protected network - show password field and toggle button
          gel("pwd").style.display = "block";
          gel("togglepwd").style.display = "block";
          // Reset header text for password-protected networks
          document.querySelector("#connect header h1").textContent =
            "Enter Password";
          document.querySelector(
            "#connect h2"
          ).textContent = `Password for ${selectedSSID}`;
          // Clear password field
          gel("pwd").value = "";
        }

        connect_div.style.display = "block";
        wifi_div.style.display = "none";
      }
    },
    false
  );

  function cancel() {
    selectedSSID = "";
    selectedAuthmode = null;
    // Reset password field visibility
    gel("pwd").style.display = "block";
    gel("togglepwd").style.display = "block";
    // Reset header text
    document.querySelector("#connect header h1").textContent = "Enter Password";
    connect_div.style.display = "none";
    connect_manual_div.style.display = "none";
    wifi_div.style.display = "block";
  }

  gel("cancel").addEventListener("click", cancel, false);

  gel("manual_cancel").addEventListener("click", cancel, false);

  gel("join").addEventListener("click", performConnect, false);

  gel("manual_join").addEventListener(
    "click",
    (e) => {
      performConnect("manual");
    },
    false
  );

  gel("togglepwd").addEventListener(
    "click",
    (e) => {
      if (gel("pwd").type == "password") {
        gel("pwd").type = "text";
      } else {
        gel("pwd").type = "password";
      }
    },
    false
  );

  gel("manual_togglepwd").addEventListener(
    "click",
    (e) => {
      if (gel("manual_pwd").type == "password") {
        gel("manual_pwd").type = "text";
      } else {
        gel("manual_pwd").type = "password";
      }
    },
    false
  );

  gel("ok-details").addEventListener(
    "click",
    () => {
      connect_details_div.style.display = "none";
      wifi_div.style.display = "block";
    },
    false
  );

  gel("ok-credits").addEventListener(
    "click",
    () => {
      gel("credits").style.display = "none";
      gel("app").style.display = "block";
    },
    false
  );

  gel("acredits").addEventListener(
    "click",
    () => {
      event.preventDefault();
      gel("app").style.display = "none";
      gel("credits").style.display = "block";
    },
    false
  );

  gel("ok-connect").addEventListener(
    "click",
    () => {
      connect_wait_div.style.display = "none";
      wifi_div.style.display = "block";
    },
    false
  );

  gel("disconnect").addEventListener(
    "click",
    () => {
      gel("diag-disconnect").style.display = "block";
      gel("connect-details-wrap").classList.add("blur");
    },
    false
  );

  gel("no-disconnect").addEventListener(
    "click",
    () => {
      gel("diag-disconnect").style.display = "none";
      gel("connect-details-wrap").classList.remove("blur");
    },
    false
  );

  gel("yes-disconnect").addEventListener("click", async () => {
    stopCheckStatusInterval();
    selectedSSID = "";

    document.getElementById("diag-disconnect").style.display = "none";
    gel("connect-details-wrap").classList.remove("blur");

    await fetch("connect.json", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: { timestamp: Date.now() },
    });

    startCheckStatusInterval();

    connect_details_div.style.display = "none";
    wifi_div.style.display = "block";
  });

  //first time the page loads: attempt get the connection status and start the wifi scan
  await refreshAP();
  startCheckStatusInterval();
  startRefreshAPInterval();
});

async function performConnect(conntype) {
  //stop the status refresh. This prevents a race condition where a status
  //request would be refreshed with wrong ip info from a previous connection
  //and the request would automatically shows as succesful.
  stopCheckStatusInterval();

  //stop refreshing wifi list
  stopRefreshAPInterval();

  var pwd = "";
  if (conntype == "manual") {
    //Grab the manual SSID and PWD
    selectedSSID = gel("manual_ssid").value;
    pwd = gel("manual_pwd").value;
  } else {
    // For open networks (authmode == 0), use empty password
    // For password-protected networks, get password from input field
    if (selectedAuthmode === 0) {
      pwd = ""; // Open network, no password needed
    } else {
      pwd = gel("pwd").value;
    }
  }
  //reset connection
  gel("loading").style.display = "block";
  gel("connect-success").style.display = "none";
  gel("connect-fail").style.display = "none";

  gel("ok-connect").disabled = true;
  gel("ssid-wait").textContent = selectedSSID;
  connect_div.style.display = "none";
  connect_manual_div.style.display = "none";
  connect_wait_div.style.display = "block";

  await fetch("connect.json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Custom-ssid": selectedSSID,
      "X-Custom-pwd": pwd,
    },
    body: { timestamp: Date.now() },
  });

  //now we can re-set the intervals regardless of result
  startCheckStatusInterval();
  startRefreshAPInterval();
}

function rssiToIcon(rssi) {
  if (rssi >= -60) {
    return "w0";
  } else if (rssi >= -67) {
    return "w1";
  } else if (rssi >= -75) {
    return "w2";
  } else {
    return "w3";
  }
}

async function refreshAP(url = "ap.json") {
  try {
    var res = await fetch(url);
    var access_points = await res.json();
    if (access_points.length > 0) {
      //sort by signal strength
      access_points.sort((a, b) => {
        var x = a["rssi"];
        var y = b["rssi"];
        return x < y ? 1 : x > y ? -1 : 0;
      });
      refreshAPHTML(access_points);
    }
  } catch (e) {
    console.info("Access points returned empty from /ap.json!");
  }
}

function refreshAPHTML(data) {
  var h = "";
  data.forEach(function (e, idx, array) {
    let ap_class = idx === array.length - 1 ? "" : " brdb";
    let rssicon = rssiToIcon(e.rssi);
    // Check authmode - 0 means open network (no password)
    // Use authmode if available, otherwise fall back to auth
    let authmode =
      e.authmode !== undefined
        ? e.authmode
        : e.auth !== undefined
        ? e.auth
        : -1;
    let isOpen = authmode === 0;
    let auth = isOpen ? "" : "pw";
    // Store authmode in data attribute for click handler
    h += `<div class="ape${ap_class}" data-authmode="${authmode}" data-ssid="${e.ssid}"><div class="${rssicon}"><div class="${auth}">${e.ssid}</div></div></div>\n`;
  });

  gel("wifi-list").innerHTML = h;
}

async function checkStatus(url = "status.json") {
  try {
    var response = await fetch(url);
    var data = await response.json();
    if (data && data.hasOwnProperty("ssid") && data["ssid"] != "") {
      if (data["ssid"] === selectedSSID) {
        // Attempting connection
        switch (data["urc"]) {
          case 0:
            console.info("Got connection!");
            let connectedSpan = document.querySelector(
              "#connected-to div div div span"
            );
            let connectedDiv = document.querySelector(
              "#connected-to div div div"
            );
            if (connectedSpan) {
              connectedSpan.textContent = data["ssid"];
            }
            // Update lock icon based on authmode (remove pw class if open network)
            if (connectedDiv) {
              if (selectedAuthmode === 0) {
                connectedDiv.classList.remove("pw");
              } else {
                connectedDiv.classList.add("pw");
              }
            }
            document.querySelector("#connect-details h1").textContent =
              data["ssid"];
            gel("ip").textContent = data["ip"];
            gel("netmask").textContent = data["netmask"];
            gel("gw").textContent = data["gw"];
            gel("wifi-status").style.display = "block";

            //unlock the wait screen if needed
            gel("ok-connect").disabled = false;

            //update wait screen
            gel("loading").style.display = "none";
            gel("connect-success").style.display = "block";
            gel("connect-fail").style.display = "none";
            break;
          case 1:
            console.info("Connection attempt failed!");
            document.querySelector(
              "#connected-to div div div span"
            ).textContent = data["ssid"];
            document.querySelector("#connect-details h1").textContent =
              data["ssid"];
            gel("ip").textContent = "0.0.0.0";
            gel("netmask").textContent = "0.0.0.0";
            gel("gw").textContent = "0.0.0.0";

            //don't show any connection
            gel("wifi-status").display = "none";

            //unlock the wait screen
            gel("ok-connect").disabled = false;

            //update wait screen
            gel("loading").display = "none";
            gel("connect-fail").style.display = "block";
            gel("connect-success").style.display = "none";
            break;
        }
      } else if (data.hasOwnProperty("urc") && data["urc"] === 0) {
        console.info("Connection established");
        //ESP32 is already connected to a wifi without having the user do anything
        if (
          gel("wifi-status").style.display == "" ||
          gel("wifi-status").style.display == "none"
        ) {
          let connectedSpan = document.querySelector(
            "#connected-to div div div span"
          );
          let connectedDiv = document.querySelector(
            "#connected-to div div div"
          );
          if (connectedSpan) {
            connectedSpan.textContent = data["ssid"];
          }
          // For pre-existing connections, we don't know the authmode, so keep default (pw class)
          // This is a limitation - we'd need authmode in status.json to fix this properly
          document.querySelector("#connect-details h1").textContent =
            data["ssid"];
          gel("ip").textContent = data["ip"];
          gel("netmask").textContent = data["netmask"];
          gel("gw").textContent = data["gw"];
          gel("wifi-status").style.display = "block";
        }
      }
    } else if (data.hasOwnProperty("urc") && data["urc"] === 2) {
      console.log("Manual disconnect requested...");
      if (gel("wifi-status").style.display == "block") {
        gel("wifi-status").style.display = "none";
      }
    }
  } catch (e) {
    console.info("Was not able to fetch /status.json");
  }
}
