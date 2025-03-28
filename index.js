// Get the user agent string
const userAgent = navigator.userAgent.toLowerCase();

// Function to check if the device is an iPhone
function isIPhone() {
  return /iphone/.test(userAgent);
}

// Function to check if the browser is Safari
function isSafari() {
  return /safari/.test(userAgent) && !/chrome/.test(userAgent);
}

// Function to check if the browser is Chrome
function isChrome() {
  return /chrome/.test(userAgent);
}

// Function to check if the device is Android
function isAndroid() {
  return /android/.test(userAgent);
}

// Function to check if the platform is Windows
function isWindows() {
  return /windows/.test(userAgent);
}

// Main conditional logic
if (isChrome() || isWindows() || isAndroid()) {
  // For Chrome (any device), Windows (any browser), or Android
  document.body.style.backgroundColor = 'red';
} else if (isSafari() || isIPhone()) {
  // For Safari or iPhone
  document.body.style.backgroundColor = 'green';
} else {
  // Fallback for other browsers/devices
  console.log('Unknown browser or device');
  document.body.style.backgroundColor = 'gray'; // Default fallback color
}
