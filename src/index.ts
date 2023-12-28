import { serve } from "@hono/node-server";
import crypto from "@trust/webcrypto";
import { createHash } from "crypto";
import { writeFile } from "fs/promises";
import { Hono } from "hono";
import { cors } from "hono/cors";
import jwt from "jsonwebtoken";
import Users from "./Users.json";

const app = new Hono();

const secret = "R5RIwXnWlDMIk8UxfSWHg7Iqnw4CqI37iat5HAyAAWE=";
const KeyPairs = new Map<string, CryptoKey>();
const sessions = new Map<string, string>();
const expiresIn = 1;

app.use("*", cors());

app.get("/", (c) => c.text("Hello Hono!"));

app.get("/session", (c) => {
  const { email } = c.req.query();
  console.log(email);
  const token = jwt.sign({ email }, secret, { expiresIn: expiresIn });
  console.log(token);
  sessions.set(email, token);
  return c.json({ token });
});

app.post("/signin", async (c) => {
  const { email, data } = await c.req.json();
  const token = sessions.get(email);
  sessions.delete(email);
  if (!token) {
    c.status(400);
    return c.json({ msg: "认证失败！" });
  }

  const user = Users.find((u) => u.email === email);
  if (!user) {
    c.status(400);
    return c.json({ msg: "认证失败！" });
  }

  const hashedData = hash(`${user.password}${token}`);
  console.log("hashedData", hashedData);
  console.log("data", data);
  if (hashedData !== data) {
    c.status(400);
    return c.json({ msg: "认证失败！" });
  } else {
    return c.json({ msg: "认证成功！" });
  }
});

app.get("/publicKey", async (c) => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048, //can be 1024, 2048, or 4096
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: { name: "SHA-1" }, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
    },
    false, //whether the key is extractable (i.e. can be used in exportKey)
    ["encrypt", "decrypt"] //must be ["encrypt", "decrypt"] or ["wrapKey", "unwrapKey"]
  );
  const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  KeyPairs.set(publicKey.n || "", keyPair.privateKey);
  return c.json({ publicKey });
});

app.put("updatePassword", async (c) => {
  console.log(KeyPairs);
  const { email, data, encryptedPassword, publicKeyJwk } = await c.req.json();
  console.log(email, data, encryptedPassword, publicKeyJwk);

  const user = Users.find((u) => u.email === email);
  if (!user) {
    c.status(400);
    return c.json({ msg: "更新失败！" });
  }

  const token = sessions.get(email);
  sessions.delete(email);
  if (!token) {
    c.status(400);
    return c.json({ msg: "更新失败！" });
  }
  const hashedData = hash(`${user.password}${token}`);
  if (hashedData !== data) {
    c.status(400);
    return c.json({ msg: "更新失败！" });
  }

  console.log("身份认证成功");

  const privateKey = KeyPairs.get(publicKeyJwk.n || "");
  KeyPairs.delete(publicKeyJwk.n || "");
  if (!privateKey) {
    c.status(400);
    return c.json({ msg: "更新失败！" });
  }
  const decryptedArray = await crypto.subtle.decrypt(
    {
      name: "RSA-OAEP",
      hash: { name: "SHA-1" },
    } as any,
    privateKey,
    Uint8Array.from(atob(encryptedPassword), (c) => c.charCodeAt(0)).buffer
  );
  const decryptedPassword = new TextDecoder().decode(decryptedArray);
  const hashedPassword = hash(decryptedPassword);
  user.password = hashedPassword;
  console.log(Users);
  await writeFile("./src/Users.json", JSON.stringify(Users, null, 2));
  // eason1
  return c.json({ msg: "更新成功！" });
});

function hash(str: string): string {
  return createHash("sha256").update(str).digest("hex");
}

serve(app);
