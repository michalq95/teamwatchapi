const express = require("express");
const dotenv = require("dotenv");
const io = require("./socket");
const cors = require("cors");
const bodyParser = require("body-parser");
const connectDB = require("./db.js");

dotenv.config({ path: "./config.env" });
connectDB();

const app = express();
app.use(bodyParser.json());
app.use(cors());

app.get("/", (req, res) => {
  res.sendStatus(200);
});
app.use("/api/user", require("./models/user.routes"));

const port = 5000;
const server = app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

io.attach(server);

process.on("unhandledRejection", (err, promise) => {
  console.error(`Error: ${err.message}`);
  server.close(() => process.exit(1));
});
