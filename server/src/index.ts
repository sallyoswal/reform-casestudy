import "dotenv/config";
import express from "express";
import cors from "cors";
import healthRouter from "./routes/health.js";
import uploadRouter from "./routes/upload.js";
import extractRouter from "./routes/extract.js";

const app = express();
const port = process.env.PORT ?? 4001;

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/extract", extractRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(400).json({ error: err.message });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
