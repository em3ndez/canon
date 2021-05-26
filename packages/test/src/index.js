// Get the app
const app = require("./app.js");

const port = process.env.CANON_TEST_PORT || 3000;

// Start the server listening for requests
app.listen(port,
  () => console.log(`[canon-test] Canon-test server is running in port ${port}`));
