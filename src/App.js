// src/app.js
const express = require("express");
const shoppingListRoutes = require("./routes/shoppingList");
const itemRoutes = require("./routes/item");

const app = express();
const PORT = process.env.PORT || 3000;

// middleware pro JSON body
app.use(express.json());

// jednoduchý log (volitelné)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// registrace routes
app.use("/shoppingList", shoppingListRoutes);
app.use("/item", itemRoutes);

// jednoduchý health-check endpoint
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Shopping List API is running." });
});

// fallback pro neznámé cesty
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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
