import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { getPaddleServerConfig } from "./config";

const { apiKey, environment } = getPaddleServerConfig();
const sdkEnvironment =
  environment === "production" ? Environment.production : Environment.sandbox;

export const paddleServer = new Paddle(apiKey, { environment: sdkEnvironment });
