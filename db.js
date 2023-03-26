const mongoose = require("mongoose");

const connectDB = async () => {
  mongoose.set("strictQuery", false);
  const conn = await mongoose.connect(process.env.MONGO_URI, {
    useUnifiedTopology: true,
  });
  console.log(`MongoDB Connected ${conn.connection.host}`);
};

module.exports = connectDB;
