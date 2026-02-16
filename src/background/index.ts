// gmaps-tidy background script (event page)
// Orchestrates audit workflow, manages status-check queue, persists state to IndexedDB.

browser.runtime.onInstalled.addListener(() => {
  console.log("gmaps-tidy installed");
});

browser.runtime.onMessage.addListener((message, _sender) => {
  console.log("background received message:", message);
  return undefined;
});

browser.alarms.onAlarm.addListener((alarm) => {
  console.log("alarm fired:", alarm.name);
});
