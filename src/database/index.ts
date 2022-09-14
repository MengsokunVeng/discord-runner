import redis from "redis";
import config from "../config";
import logger from "../utils/logger";
import CouchDbClient from "./CouchDbClient";
import RedisClient from "./RedisClient";

const client = redis.createClient({ url: config.redisHost });

client.on("ready", () => {
  logger.info("Redis connection estabilished.");
});

client.on("error", (err) => {
  logger.error(`Connection error: ${err.code}.`);
  throw new Error(`Connection error: ${err.code}.`);
});

const redisClient = new RedisClient(client);

const couchDbClient = new CouchDbClient();

export { redisClient, couchDbClient };
