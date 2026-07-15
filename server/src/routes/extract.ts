import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { uploadDir } from "./upload.js";

const client = new Anthropic();

function fieldSchema(valueType: "string" | "number") {
  return {
    type: "object",
    properties: {
      value: { type: valueType },
      confidence: {
        type: "number",
        description: "0 to 1 confidence that this value is correctly extracted from the document.",
      },
      reasoning: {
        type: "string",
        description:
          "If the document doesn't use this exact field label, explain which alternately-labeled field the value was taken from (e.g. 'sender address' used for shipper_address) and why. If confidence is lowered for another reason (blurry scan, ambiguous formatting, value inferred rather than explicit), explain that instead. Empty string if the value was found clearly under a matching label with no issues.",
      },
    },
    required: ["value", "confidence", "reasoning"],
    additionalProperties: false,
  };
}

const lineItemSchema = {
  type: "object",
  properties: {
    quantity: fieldSchema("number"),
    description: fieldSchema("string"),
    value: fieldSchema("number"),
    hts_code: fieldSchema("string"),
  },
  required: ["quantity", "description", "value", "hts_code"],
  additionalProperties: false,
};

const extractionSchema = {
  type: "object",
  properties: {
    bill_of_lading_number: fieldSchema("string"),
    invoice_number: fieldSchema("string"),
    shipper_name: fieldSchema("string"),
    shipper_address: fieldSchema("string"),
    consignee_name: fieldSchema("string"),
    consignee_address: fieldSchema("string"),
    line_items: { type: "array", items: lineItemSchema },
    total_value_of_goods: fieldSchema("number"),
  },
  required: [
    "bill_of_lading_number",
    "invoice_number",
    "shipper_name",
    "shipper_address",
    "consignee_name",
    "consignee_address",
    "line_items",
    "total_value_of_goods",
  ],
  additionalProperties: false,
};

const router = Router();

router.post("/:filename", async (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(uploadDir, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  try {
    const base64 = fs.readFileSync(filePath).toString("base64");

    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: extractionSchema },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            },
            {
              type: "text",
              text: "Extract the bill of lading number, invoice number, shipper name and address, consignee name and address, line items (quantity, description, value, HTS code), and total value of goods from this document. Documents don't always use these exact labels — for example an address field might be labeled 'sender address' instead of 'shipper address', or 'buyer'/'receiver' instead of 'consignee'. Before leaving a field blank, look for a semantically equivalent label and use that value instead. Only use an empty string or 0 if truly nothing plausible exists anywhere in the document. For every field, report a confidence score from 0 to 1 and a reasoning string: if you used an alternately-labeled field, name which label you used and why; if confidence is lowered for another reason (blurry scan, ambiguous formatting, inferred value), explain that instead; leave reasoning empty only if the value was found clearly under a matching label.",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      res.status(502).json({ error: "No extraction result returned" });
      return;
    }

    res.json(JSON.parse(textBlock.text));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Extraction failed" });
  }
});

export default router;
