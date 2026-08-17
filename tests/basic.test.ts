import { describe, expect, it } from "vitest";

import { decoded, encoded } from "../src/definition.js";
import { boolean, float16, uint } from "../src/field.js";
import { message, messageDefinition } from "../src/specification.js";

const type = "custom.Test" as const;

const schema = {
  messages: [
    message({
      id: 1,
      type,
      definition: {
        test1: uint(16),
        test2: boolean(),
        test3: uint(8),
        test4: float16(),
      },
    }),
  ],
  services: [],
} as const;

describe("message roundtrip", () =>
  it("serializes and deserializes message data", () => {
    const value = {
      test1: 12345,
      test2: true,
      test3: 67,
      test4: 1.25,
    };
    const definition = messageDefinition(schema, type);
    const bytes = encoded(definition, value);
    const hex = Array.from(bytes)
      .map(_ => _.toString(16).padStart(2, "0"))
      .join("");
    expect(hex).toEqual("3930a1801e80");
    const result = decoded(definition, bytes);
    expect(result).toEqual(value);
  }));
