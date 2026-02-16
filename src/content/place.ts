// gmaps-tidy content script for google.com/maps/place/*
// Extracts business status, category, and address from rendered DOM.

browser.runtime.onMessage.addListener((message, _sender) => {
  console.log("place content script received message:", message);
  return undefined;
});
