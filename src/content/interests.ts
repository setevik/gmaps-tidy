// gmaps-tidy content script for google.com/interests/saved
// Reads list names and place entries. Executes move operations via native UI.

browser.runtime.onMessage.addListener((message, _sender) => {
  console.log("interests content script received message:", message);
  return undefined;
});
