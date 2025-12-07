const express = require("express");
const { connectToDb } = require("./data/store");
const shoppingListRoutes = require("./routes/shoppingList");
const itemRoutes = require("./routes/item");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// simple console log for debugging requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use("/shoppingList", shoppingListRoutes);
app.use("/item", itemRoutes);

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Shopping List API is running.", uuAppErrorMap: {} });
});

// fallback for unknown routes
app.use((req, res) => {
  res.status(404).json({
    uuAppErrorMap: {
      "system/endpointNotFound": {
        type: "error",
        message: "Requested endpoint does not exist.",
        paramMap: { method: req.method, url: req.url }
      }
    }
  });
});

const start = async () => {
  try {
    await connectToDb();
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

start();

module.exports = app;
